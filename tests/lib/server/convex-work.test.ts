import { beforeEach, describe, expect, it, vi } from "vitest"

const mutationMock = vi.fn()

vi.mock("@/lib/server/convex/core", () => ({
  getConvexServerClient: () => ({
    mutation: mutationMock,
  }),
  withServerToken: <T extends Record<string, unknown>>(input: T) => input,
}))

describe("convex work server wrappers", () => {
  beforeEach(() => {
    mutationMock.mockReset()
  })

  it("maps work-item mutation failures to typed application errors", async () => {
    const {
      createWorkItemServer,
      shiftTimelineItemServer,
      updateWorkItemServer,
    } = await import("@/lib/server/convex/work")

    mutationMock
      .mockRejectedValueOnce(new Error("Parent item not found"))
      .mockRejectedValueOnce(new Error("Work item is not scheduled"))
      .mockRejectedValueOnce(
        new Error(
          "A work item type in this hierarchy is not allowed for the selected project template"
        )
      )

    await expect(
      createWorkItemServer({
        currentUserId: "user_1",
        teamId: "team_1",
        type: "task",
        title: "Launch task",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "WORK_ITEM_PARENT_NOT_FOUND",
    })

    await expect(
      shiftTimelineItemServer({
        currentUserId: "user_1",
        itemId: "item_1",
        nextStartDate: "2026-05-01",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "WORK_ITEM_SCHEDULE_MISSING",
    })

    await expect(
      updateWorkItemServer({
        currentUserId: "user_1",
        itemId: "item_1",
        patch: {
          primaryProjectId: "project_1",
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "WORK_ITEM_PROJECT_TEMPLATE_HIERARCHY_INVALID",
    })
  })

  it("maps view mutation failures to typed application errors", async () => {
    const {
      clearViewFiltersServer,
      toggleViewFilterValueServer,
      toggleViewDisplayPropertyServer,
    } = await import("@/lib/server/convex/work")

    mutationMock
      .mockRejectedValueOnce(new Error("View not found"))
      .mockRejectedValueOnce(new Error("One or more labels are invalid"))
      .mockRejectedValueOnce(new Error("You do not have access to this view"))

    await expect(
      clearViewFiltersServer({
        currentUserId: "user_1",
        viewId: "view_1",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "VIEW_NOT_FOUND",
    })

    await expect(
      toggleViewFilterValueServer({
        currentUserId: "user_1",
        viewId: "view_1",
        key: "labelIds",
        value: "label_other_workspace",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "VIEW_LABELS_INVALID",
    })

    await expect(
      toggleViewDisplayPropertyServer({
        currentUserId: "user_1",
        viewId: "view_1",
        property: "priority",
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "VIEW_ACCESS_DENIED",
    })
  })

  it("maps label failures to typed application errors", async () => {
    const { createLabelServer } = await import("@/lib/server/convex/work")

    mutationMock.mockRejectedValueOnce(new Error("User not found"))

    await expect(
      createLabelServer({
        currentUserId: "user_1",
        workspaceId: "workspace_1",
        name: "Bug",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "ACCOUNT_NOT_FOUND",
    })
  })
})
