import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createTestAppData,
  createTestProject,
  createTestWorkItem,
  createTestWorkspace,
} from "@/tests/lib/fixtures/app-data"
import { withLosAngelesFakeSystemTime } from "@/tests/lib/fixtures/store"

const syncCreateLabelMock = vi.fn()
const syncCreateWorkItemMock = vi.fn()
const syncDeleteWorkItemMock = vi.fn()
const syncShiftTimelineItemMock = vi.fn()
const syncUpdateWorkItemMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncCreateLabel: syncCreateLabelMock,
  syncCreateWorkItem: syncCreateWorkItemMock,
  syncDeleteWorkItem: syncDeleteWorkItemMock,
  syncShiftTimelineItem: syncShiftTimelineItemMock,
  syncUpdateWorkItem: syncUpdateWorkItemMock,
}))

function createState() {
  return createTestAppData({
    workItems: [
      createTestWorkItem("parent", {
        status: "todo",
      }),
      createTestWorkItem("child", {
        parentId: "parent",
        type: "sub-task",
        status: "in-progress",
      }),
    ],
  })
}

async function createWorkItemActionsHarness(state = createState()) {
  const { createWorkItemActions } =
    await import("@/lib/store/app-store-internal/slices/work-item-actions")
  const harness = {
    actions: null as ReturnType<typeof createWorkItemActions> | null,
    state,
    syncInBackgroundMock: vi.fn(),
  }
  const setState = (update: unknown) => {
    const patch =
      typeof update === "function" ? update(harness.state as never) : update

    harness.state = {
      ...harness.state,
      ...(patch as object),
    }
  }

  harness.actions = createWorkItemActions({
    get: () => harness.state as never,
    runtime: {
      syncInBackground: harness.syncInBackgroundMock,
    } as never,
    set: setState as never,
  })

  return harness as typeof harness & {
    actions: ReturnType<typeof createWorkItemActions>
  }
}

describe("work item actions", () => {
  beforeEach(() => {
    syncCreateLabelMock.mockReset()
    syncCreateWorkItemMock.mockReset()
    syncDeleteWorkItemMock.mockReset()
    syncShiftTimelineItemMock.mockReset()
    syncUpdateWorkItemMock.mockReset()
    toastErrorMock.mockReset()
    syncCreateWorkItemMock.mockResolvedValue({
      ok: true,
      itemId: null,
      itemUpdatedAt: null,
      descriptionDocId: null,
      descriptionUpdatedAt: null,
    })
    syncUpdateWorkItemMock.mockResolvedValue({ ok: true })
  })

  it("does not cascade parent status changes into child work items", async () => {
    const harness = await createWorkItemActionsHarness()

    harness.actions.updateWorkItem("parent", {
      status: "done",
    })

    expect(
      harness.state.workItems.find((item) => item.id === "parent")?.status
    ).toBe("done")
    expect(
      harness.state.workItems.find((item) => item.id === "child")?.status
    ).toBe("in-progress")
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith("user_1", "parent", {
      status: "done",
    })
    expect(harness.syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("requires confirmation before cascading an explicit project change across a hierarchy", async () => {
    const state = createState()
    state.projects = [createTestProject()]
    const harness = await createWorkItemActionsHarness(state)

    const result = harness.actions.updateWorkItem("parent", {
      primaryProjectId: "project_1",
    })

    expect(result).toEqual({
      status: "project-confirmation-required",
      cascadeItemCount: 2,
    })
    expect(state.workItems.map((item) => item.primaryProjectId)).toEqual([
      null,
      null,
    ])
    expect(syncUpdateWorkItemMock).not.toHaveBeenCalled()
    expect(harness.syncInBackgroundMock).not.toHaveBeenCalled()
  })

  it("applies the project cascade after confirmation", async () => {
    const state = createState()
    state.projects = [createTestProject()]
    const harness = await createWorkItemActionsHarness(state)

    const result = harness.actions.updateWorkItem(
      "parent",
      {
        primaryProjectId: "project_1",
      },
      {
        confirmProjectCascade: true,
      }
    )

    expect(result).toEqual({
      status: "updated",
    })
    expect(
      harness.state.workItems.map((item) => item.primaryProjectId)
    ).toEqual(["project_1", "project_1"])
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith("user_1", "parent", {
      primaryProjectId: "project_1",
    })
    expect(harness.syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("requires confirmation before reparenting a hierarchy into a different project", async () => {
    const state = createState()
    state.projects = [createTestProject({ templateType: "software-delivery" })]
    state.workItems = [
      createTestWorkItem("feature-parent", {
        type: "feature",
        title: "Feature",
      }),
      createTestWorkItem("requirement-middle", {
        type: "requirement",
        title: "Requirement",
        parentId: "feature-parent",
      }),
      createTestWorkItem("story-child", {
        type: "story",
        title: "Story",
        parentId: "requirement-middle",
      }),
      createTestWorkItem("new-feature", {
        type: "feature",
        title: "New feature",
        primaryProjectId: "project_1",
      }),
    ]
    const harness = await createWorkItemActionsHarness(state)

    const result = harness.actions.updateWorkItem("requirement-middle", {
      parentId: "new-feature",
    })

    expect(result).toEqual({
      status: "project-confirmation-required",
      cascadeItemCount: 3,
    })
    expect(
      state.workItems.find((item) => item.id === "requirement-middle")?.parentId
    ).toBe("feature-parent")
    expect(state.workItems.map((item) => item.primaryProjectId)).toEqual([
      null,
      null,
      null,
      "project_1",
    ])
    expect(syncUpdateWorkItemMock).not.toHaveBeenCalled()
    expect(harness.syncInBackgroundMock).not.toHaveBeenCalled()
  })

  it("passes expectedUpdatedAt through sync without storing it on the item", async () => {
    const harness = await createWorkItemActionsHarness()

    harness.actions.updateWorkItem("parent", {
      title: "Renamed",
      expectedUpdatedAt: "2026-04-18T10:00:00.000Z",
    })

    expect(
      harness.state.workItems.find((item) => item.id === "parent")
    ).toMatchObject({
      id: "parent",
      title: "Renamed",
    })
    expect(
      harness.state.workItems.find((item) => item.id === "parent")
    ).not.toHaveProperty("expectedUpdatedAt")
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith("user_1", "parent", {
      title: "Renamed",
      expectedUpdatedAt: "2026-04-18T10:00:00.000Z",
    })
    expect(harness.syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("shifts scheduled dates in calendar-day space for timeline moves", async () => {
    const state = createState()
    state.workItems = [
      createTestWorkItem("scheduled", {
        startDate: "2026-03-08",
        dueDate: "2026-03-08",
        targetDate: "2026-03-10",
      }),
    ]
    const harness = await createWorkItemActionsHarness(state)

    harness.actions.shiftTimelineItem("scheduled", "2026-03-09")

    expect(
      harness.state.workItems.find((item) => item.id === "scheduled")
    ).toMatchObject({
      startDate: "2026-03-09",
      dueDate: "2026-03-09",
      targetDate: "2026-03-11",
    })
    expect(syncShiftTimelineItemMock).toHaveBeenCalledWith(
      "scheduled",
      "2026-03-09"
    )
    expect(harness.syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("creates labels in the selected workspace instead of the active workspace", async () => {
    const state = createState()
    state.labels = [
      {
        id: "label_1",
        workspaceId: "workspace_1",
        name: "Bug",
        color: "red",
      },
    ]
    state.workspaces = [
      createTestWorkspace({
        name: "Primary",
        slug: "primary",
        workosOrganizationId: null,
        settings: {
          accent: "emerald",
          description: "",
        },
      }),
      createTestWorkspace({
        id: "workspace_2",
        name: "Secondary",
        slug: "secondary",
        workosOrganizationId: null,
        settings: {
          accent: "blue",
          description: "",
        },
      }),
    ]

    syncCreateLabelMock.mockResolvedValue({
      label: {
        id: "label_2",
        workspaceId: "workspace_2",
        name: "Bug",
        color: "blue",
      },
    })
    const harness = await createWorkItemActionsHarness(state)

    const created = await harness.actions.createLabel("Bug", "workspace_2")

    expect(created).toMatchObject({
      id: "label_2",
      workspaceId: "workspace_2",
      name: "Bug",
    })
    expect(syncCreateLabelMock).toHaveBeenCalledWith({
      workspaceId: "workspace_2",
      name: "Bug",
    })
    expect(harness.state.labels.map((label) => label.id)).toEqual([
      "label_1",
      "label_2",
    ])
  })

  it("creates self notifications for assignment and assigned status changes", async () => {
    const harness = await createWorkItemActionsHarness()

    harness.actions.updateWorkItem("parent", {
      assigneeId: "user_1",
    })

    harness.actions.updateWorkItem("parent", {
      status: "done",
    })

    expect(harness.state.notifications).toHaveLength(2)
    expect(
      harness.state.notifications.map((notification) => notification.type)
    ).toEqual(["status-change", "assignment"])
    expect(harness.state.notifications[0]?.userId).toBe("user_1")
    expect(harness.state.notifications[1]?.userId).toBe("user_1")
    expect(syncUpdateWorkItemMock).toHaveBeenNthCalledWith(
      1,
      "user_1",
      "parent",
      {
        assigneeId: "user_1",
      }
    )
    expect(syncUpdateWorkItemMock).toHaveBeenNthCalledWith(
      2,
      "user_1",
      "parent",
      {
        status: "done",
      }
    )
    expect(harness.syncInBackgroundMock).toHaveBeenCalledTimes(2)
  })

  it("creates work items with selected schedule dates", async () => {
    const harness = await createWorkItemActionsHarness()

    const createdItemId = harness.actions.createWorkItem({
      teamId: "team_1",
      type: "task",
      title: "Schedule work",
      primaryProjectId: null,
      assigneeId: null,
      priority: "medium",
      startDate: "2026-05-01",
      targetDate: "2026-05-10",
    })

    expect(createdItemId).toBeTruthy()
    expect(harness.state.workItems[0]).toMatchObject({
      id: createdItemId,
      title: "Schedule work",
      startDate: "2026-05-01",
      targetDate: "2026-05-10",
    })
    expect(harness.state.documents[0]).toMatchObject({
      kind: "item-description",
      title: "Schedule work description",
      content: "<p></p>",
    })
    expect(syncCreateWorkItemMock).toHaveBeenCalledWith("user_1", {
      id: createdItemId,
      descriptionDocId: harness.state.workItems[0]?.descriptionDocId,
      teamId: "team_1",
      type: "task",
      title: "Schedule work",
      primaryProjectId: null,
      assigneeId: null,
      priority: "medium",
      startDate: "2026-05-01",
      dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      targetDate: "2026-05-10",
    })
    expect(harness.syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("defaults work-item schedule dates from the local calendar day", async () => {
    await withLosAngelesFakeSystemTime(async () => {
      const { formatLocalCalendarDate, addLocalCalendarDays } =
        await import("@/lib/calendar-date")
      const harness = await createWorkItemActionsHarness()

      const createdItemId = harness.actions.createWorkItem({
        teamId: "team_1",
        type: "task",
        title: "Schedule work",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
      })

      expect(createdItemId).toBeTruthy()
      expect(harness.state.workItems[0]).toMatchObject({
        id: createdItemId,
        startDate: formatLocalCalendarDate(),
        dueDate: addLocalCalendarDays(7),
        targetDate: addLocalCalendarDays(10),
      })
      expect(syncCreateWorkItemMock).toHaveBeenCalledWith("user_1", {
        id: createdItemId,
        descriptionDocId: harness.state.workItems[0]?.descriptionDocId,
        teamId: "team_1",
        type: "task",
        title: "Schedule work",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
        startDate: formatLocalCalendarDate(),
        dueDate: addLocalCalendarDays(7),
        targetDate: addLocalCalendarDays(10),
      })
      expect(harness.syncInBackgroundMock).toHaveBeenCalledTimes(1)
    })
  })

  it("reconciles optimistic work-item timestamps from the create response", async () => {
    syncCreateWorkItemMock.mockImplementation(
      async (_userId, input: { id?: string; descriptionDocId?: string }) => ({
        ok: true,
        itemId: input.id ?? null,
        itemUpdatedAt: "2026-04-18T10:05:00.000Z",
        descriptionDocId: input.descriptionDocId ?? null,
        descriptionUpdatedAt: "2026-04-18T10:05:00.000Z",
      })
    )
    const harness = await createWorkItemActionsHarness()

    const createdItemId = harness.actions.createWorkItem({
      teamId: "team_1",
      type: "task",
      title: "Reconcile work",
      primaryProjectId: null,
      assigneeId: null,
      priority: "medium",
    })

    await harness.syncInBackgroundMock.mock.calls[0]?.[0]

    expect(
      harness.state.workItems.find((item) => item.id === createdItemId)
    ).toMatchObject({
      updatedAt: "2026-04-18T10:05:00.000Z",
    })
    expect(
      harness.state.documents.find(
        (document) =>
          document.id ===
          harness.state.workItems.find((item) => item.id === createdItemId)
            ?.descriptionDocId
      )
    ).toMatchObject({
      updatedAt: "2026-04-18T10:05:00.000Z",
    })
  })

  it("keeps optimistic item and description ids when callers smuggle ids into the input", async () => {
    const harness = await createWorkItemActionsHarness()

    const createdItemId = harness.actions.createWorkItem({
      teamId: "team_1",
      type: "task",
      title: "Smuggled ids",
      primaryProjectId: null,
      assigneeId: null,
      priority: "medium",
      id: "caller-item-id",
      descriptionDocId: "caller-doc-id",
    } as never)

    expect(createdItemId).toBeTruthy()
    expect(syncCreateWorkItemMock).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        id: createdItemId,
        descriptionDocId: harness.state.workItems[0]?.descriptionDocId,
      })
    )
    expect(syncCreateWorkItemMock).not.toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        id: "caller-item-id",
        descriptionDocId: "caller-doc-id",
      })
    )
  })

  it("rejects work item schedule ranges where the target date is before the start date", async () => {
    const harness = await createWorkItemActionsHarness()

    const createdItemId = harness.actions.createWorkItem({
      teamId: "team_1",
      type: "task",
      title: "Broken schedule",
      primaryProjectId: null,
      assigneeId: null,
      priority: "medium",
      startDate: "2026-05-10",
      targetDate: "2026-05-01",
    })

    expect(createdItemId).toBeNull()
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Target date must be on or after the start date"
    )
    expect(syncCreateWorkItemMock).not.toHaveBeenCalled()
    expect(harness.syncInBackgroundMock).not.toHaveBeenCalled()
    expect(harness.state.workItems).toHaveLength(2)
  })
})
