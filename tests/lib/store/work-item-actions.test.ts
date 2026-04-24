import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type WorkItem,
} from "@/lib/domain/types"

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

function createItem(id: string, overrides?: Partial<WorkItem>) {
  return {
    ...buildBaseItem(id),
    ...overrides,
  }
}

function buildBaseItem(id: string): WorkItem {
  return {
    id,
    key: `PLA-${id}`,
    teamId: "team_1",
    type: "task" as const,
    title: `Item ${id}`,
    descriptionDocId: `doc_${id}`,
    status: "todo" as const,
    priority: "medium" as const,
    assigneeId: null,
    creatorId: "user_1",
    parentId: null,
    primaryProjectId: null,
    linkedProjectIds: [],
    linkedDocumentIds: [],
    labelIds: [],
    milestoneId: null,
    startDate: null,
    dueDate: null,
    targetDate: null,
    subscriberIds: ["user_1"],
    createdAt: "2026-04-18T10:00:00.000Z",
    updatedAt: "2026-04-18T10:00:00.000Z",
  }
}

function createState() {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    users: [
      {
        id: "user_1",
        name: "Alex",
        handle: "alex",
        email: "alex@example.com",
        avatarUrl: "",
        avatarImageUrl: null,
        workosUserId: null,
        title: "Engineer",
        status: "active" as const,
        statusMessage: "",
        preferences: {
          emailMentions: true,
          emailAssignments: true,
          emailDigest: true,
          theme: "system" as const,
        },
      },
    ],
    teams: [
      {
        id: "team_1",
        workspaceId: "workspace_1",
        slug: "platform",
        name: "Platform",
        icon: "robot",
        settings: {
          joinCode: "JOIN1234",
          summary: "Platform team",
          guestProjectIds: [],
          guestDocumentIds: [],
          guestWorkItemIds: [],
          experience: "software-development" as const,
          features: createDefaultTeamFeatureSettings("software-development"),
          workflow: createDefaultTeamWorkflowSettings("software-development"),
        },
      },
    ],
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "admin" as const,
      },
    ],
    workItems: [
      createItem("parent", {
        status: "todo",
      }),
      createItem("child", {
        parentId: "parent",
        type: "sub-task",
        status: "in-progress",
      }),
    ],
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
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    actions.updateWorkItem("parent", {
      status: "done",
    })

    expect(state.workItems.find((item) => item.id === "parent")?.status).toBe(
      "done"
    )
    expect(state.workItems.find((item) => item.id === "child")?.status).toBe(
      "in-progress"
    )
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith("user_1", "parent", {
      status: "done",
    })
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("requires confirmation before cascading an explicit project change across a hierarchy", async () => {
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    state.projects = [
      {
        id: "project_1",
        scopeType: "team",
        scopeId: "team_1",
        templateType: "project-management",
        name: "Platform roadmap",
        summary: "",
        description: "",
        leadId: "user_1",
        memberIds: [],
        health: "on-track",
        priority: "medium",
        status: "backlog",
        startDate: null,
        targetDate: null,
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
    ]
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    const result = actions.updateWorkItem("parent", {
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
    expect(syncInBackgroundMock).not.toHaveBeenCalled()
  })

  it("applies the project cascade after confirmation", async () => {
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    state.projects = [
      {
        id: "project_1",
        scopeType: "team",
        scopeId: "team_1",
        templateType: "project-management",
        name: "Platform roadmap",
        summary: "",
        description: "",
        leadId: "user_1",
        memberIds: [],
        health: "on-track",
        priority: "medium",
        status: "backlog",
        startDate: null,
        targetDate: null,
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
    ]
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    const result = actions.updateWorkItem(
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
    expect(state.workItems.map((item) => item.primaryProjectId)).toEqual([
      "project_1",
      "project_1",
    ])
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith("user_1", "parent", {
      primaryProjectId: "project_1",
    })
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("requires confirmation before reparenting a hierarchy into a different project", async () => {
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    state.projects = [
      {
        id: "project_1",
        scopeType: "team",
        scopeId: "team_1",
        templateType: "software-delivery",
        name: "Platform roadmap",
        summary: "",
        description: "",
        leadId: "user_1",
        memberIds: [],
        health: "on-track",
        priority: "medium",
        status: "backlog",
        startDate: null,
        targetDate: null,
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
    ]
    state.workItems = [
      createItem("feature-parent", {
        type: "feature",
        title: "Feature",
      }),
      createItem("requirement-middle", {
        type: "requirement",
        title: "Requirement",
        parentId: "feature-parent",
      }),
      createItem("story-child", {
        type: "story",
        title: "Story",
        parentId: "requirement-middle",
      }),
      createItem("new-feature", {
        type: "feature",
        title: "New feature",
        primaryProjectId: "project_1",
      }),
    ]
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    const result = actions.updateWorkItem("requirement-middle", {
      parentId: "new-feature",
    })

    expect(result).toEqual({
      status: "project-confirmation-required",
      cascadeItemCount: 3,
    })
    expect(state.workItems.find((item) => item.id === "requirement-middle")?.parentId).toBe(
      "feature-parent"
    )
    expect(state.workItems.map((item) => item.primaryProjectId)).toEqual([
      null,
      null,
      null,
      "project_1",
    ])
    expect(syncUpdateWorkItemMock).not.toHaveBeenCalled()
    expect(syncInBackgroundMock).not.toHaveBeenCalled()
  })

  it("passes expectedUpdatedAt through sync without storing it on the item", async () => {
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    actions.updateWorkItem("parent", {
      title: "Renamed",
      expectedUpdatedAt: "2026-04-18T10:00:00.000Z",
    })

    expect(state.workItems.find((item) => item.id === "parent")).toMatchObject({
      id: "parent",
      title: "Renamed",
    })
    expect(
      state.workItems.find((item) => item.id === "parent")
    ).not.toHaveProperty("expectedUpdatedAt")
    expect(syncUpdateWorkItemMock).toHaveBeenCalledWith("user_1", "parent", {
      title: "Renamed",
      expectedUpdatedAt: "2026-04-18T10:00:00.000Z",
    })
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("shifts scheduled dates in calendar-day space for timeline moves", async () => {
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    state.workItems = [
      createItem("scheduled", {
        startDate: "2026-03-08",
        dueDate: "2026-03-08",
        targetDate: "2026-03-10",
      }),
    ]
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    actions.shiftTimelineItem("scheduled", "2026-03-09")

    expect(state.workItems.find((item) => item.id === "scheduled")).toMatchObject(
      {
        startDate: "2026-03-09",
        dueDate: "2026-03-09",
        targetDate: "2026-03-11",
      }
    )
    expect(syncShiftTimelineItemMock).toHaveBeenCalledWith(
      "scheduled",
      "2026-03-09"
    )
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("creates labels in the selected workspace instead of the active workspace", async () => {
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    state.labels = [
      {
        id: "label_1",
        workspaceId: "workspace_1",
        name: "Bug",
        color: "red",
      },
    ]
    state.workspaces = [
      {
        id: "workspace_1",
        name: "Primary",
        slug: "primary",
        logoUrl: "",
        logoImageUrl: null,
        createdBy: "user_1",
        workosOrganizationId: null,
        settings: {
          accent: "emerald",
          description: "",
        },
      },
      {
        id: "workspace_2",
        name: "Secondary",
        slug: "secondary",
        logoUrl: "",
        logoImageUrl: null,
        createdBy: "user_1",
        workosOrganizationId: null,
        settings: {
          accent: "blue",
          description: "",
        },
      },
    ]
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    syncCreateLabelMock.mockResolvedValue({
      label: {
        id: "label_2",
        workspaceId: "workspace_2",
        name: "Bug",
        color: "blue",
      },
    })

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    const created = await actions.createLabel("Bug", "workspace_2")

    expect(created).toMatchObject({
      id: "label_2",
      workspaceId: "workspace_2",
      name: "Bug",
    })
    expect(syncCreateLabelMock).toHaveBeenCalledWith({
      workspaceId: "workspace_2",
      name: "Bug",
    })
    expect(state.labels.map((label) => label.id)).toEqual(["label_1", "label_2"])
  })

  it("creates self notifications for assignment and assigned status changes", async () => {
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    actions.updateWorkItem("parent", {
      assigneeId: "user_1",
    })

    actions.updateWorkItem("parent", {
      status: "done",
    })

    expect(state.notifications).toHaveLength(2)
    expect(state.notifications.map((notification) => notification.type)).toEqual([
      "status-change",
      "assignment",
    ])
    expect(state.notifications[0]?.userId).toBe("user_1")
    expect(state.notifications[1]?.userId).toBe("user_1")
    expect(syncUpdateWorkItemMock).toHaveBeenNthCalledWith(1, "user_1", "parent", {
      assigneeId: "user_1",
    })
    expect(syncUpdateWorkItemMock).toHaveBeenNthCalledWith(2, "user_1", "parent", {
      status: "done",
    })
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(2)
  })

  it("creates work items with selected schedule dates", async () => {
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    const createdItemId = actions.createWorkItem({
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
    expect(state.workItems[0]).toMatchObject({
      id: createdItemId,
      title: "Schedule work",
      startDate: "2026-05-01",
      targetDate: "2026-05-10",
    })
    expect(state.documents[0]).toMatchObject({
      kind: "item-description",
      title: "Schedule work description",
      content: "<p></p>",
    })
    expect(syncCreateWorkItemMock).toHaveBeenCalledWith("user_1", {
      id: createdItemId,
      descriptionDocId: state.workItems[0]?.descriptionDocId,
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
    expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
  })

  it("defaults work-item schedule dates from the local calendar day", async () => {
    const previousTimeZone = process.env.TZ
    process.env.TZ = "America/Los_Angeles"
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 20, 23, 30))
    vi.resetModules()

    try {
      const { formatLocalCalendarDate, addLocalCalendarDays } = await import(
        "@/lib/calendar-date"
      )
      const { createWorkItemActions } = await import(
        "@/lib/store/app-store-internal/slices/work-item-actions"
      )

      let state = createState()
      const syncInBackgroundMock = vi.fn()
      const setState = (update: unknown) => {
        const patch =
          typeof update === "function"
            ? update(state as never)
            : update

        state = {
          ...state,
          ...(patch as object),
        }
      }

      const actions = createWorkItemActions({
        get: () => state as never,
        runtime: {
          syncInBackground: syncInBackgroundMock,
        } as never,
        set: setState as never,
      })

      const createdItemId = actions.createWorkItem({
        teamId: "team_1",
        type: "task",
        title: "Schedule work",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
      })

      expect(createdItemId).toBeTruthy()
      expect(state.workItems[0]).toMatchObject({
        id: createdItemId,
        startDate: formatLocalCalendarDate(),
        dueDate: addLocalCalendarDays(7),
        targetDate: addLocalCalendarDays(10),
      })
      expect(syncCreateWorkItemMock).toHaveBeenCalledWith("user_1", {
        id: createdItemId,
        descriptionDocId: state.workItems[0]?.descriptionDocId,
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
      expect(syncInBackgroundMock).toHaveBeenCalledTimes(1)
    } finally {
      process.env.TZ = previousTimeZone
      vi.useRealTimers()
      vi.resetModules()
    }
  })

  it("reconciles optimistic work-item timestamps from the create response", async () => {
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    syncCreateWorkItemMock.mockImplementation(
      async (_userId, input: { id?: string; descriptionDocId?: string }) => ({
        ok: true,
        itemId: input.id ?? null,
        itemUpdatedAt: "2026-04-18T10:05:00.000Z",
        descriptionDocId: input.descriptionDocId ?? null,
        descriptionUpdatedAt: "2026-04-18T10:05:00.000Z",
      })
    )

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    const createdItemId = actions.createWorkItem({
      teamId: "team_1",
      type: "task",
      title: "Reconcile work",
      primaryProjectId: null,
      assigneeId: null,
      priority: "medium",
    })

    await syncInBackgroundMock.mock.calls[0]?.[0]

    expect(state.workItems.find((item) => item.id === createdItemId)).toMatchObject(
      {
        updatedAt: "2026-04-18T10:05:00.000Z",
      }
    )
    expect(
      state.documents.find(
        (document) =>
          document.id ===
          state.workItems.find((item) => item.id === createdItemId)
            ?.descriptionDocId
      )
    ).toMatchObject({
      updatedAt: "2026-04-18T10:05:00.000Z",
    })
  })

  it("rejects work item schedule ranges where the target date is before the start date", async () => {
    const { createWorkItemActions } = await import(
      "@/lib/store/app-store-internal/slices/work-item-actions"
    )

    let state = createState()
    const syncInBackgroundMock = vi.fn()
    const setState = (update: unknown) => {
      const patch =
        typeof update === "function"
          ? update(state as never)
          : update

      state = {
        ...state,
        ...(patch as object),
      }
    }

    const actions = createWorkItemActions({
      get: () => state as never,
      runtime: {
        syncInBackground: syncInBackgroundMock,
      } as never,
      set: setState as never,
    })

    const createdItemId = actions.createWorkItem({
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
    expect(syncInBackgroundMock).not.toHaveBeenCalled()
    expect(state.workItems).toHaveLength(2)
  })
})
