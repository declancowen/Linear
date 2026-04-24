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

  it("maps work-item presence failures to typed application errors", async () => {
    const { clearWorkItemPresenceServer, heartbeatWorkItemPresenceServer } =
      await import("@/lib/server/convex/work")

    mutationMock
      .mockRejectedValueOnce(new Error("Document presence session is already in use"))
      .mockRejectedValueOnce(new Error("You do not have access to this team"))
      .mockRejectedValueOnce(new Error("Work item not found"))
      .mockRejectedValueOnce(new Error("Document presence session is already in use"))
      .mockRejectedValueOnce(new Error("Your current role is read-only"))
      .mockRejectedValueOnce(
        new Error(
          "Could not find public function for 'app:heartbeatWorkItemPresence'. Did you forget to run `npx convex dev`?"
        )
      )

    await expect(
      heartbeatWorkItemPresenceServer({
        currentUserId: "user_1",
        itemId: "item_1",
        workosUserId: "workos_1",
        email: "alex@example.com",
        name: "Alex",
        avatarUrl: "",
        avatarImageUrl: null,
        sessionId: "session_1",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "WORK_ITEM_PRESENCE_SESSION_CONFLICT",
    })

    await expect(
      heartbeatWorkItemPresenceServer({
        currentUserId: "user_1",
        itemId: "item_1",
        workosUserId: "workos_1",
        email: "alex@example.com",
        name: "Alex",
        avatarUrl: "",
        avatarImageUrl: null,
        sessionId: "session_1",
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "WORK_ITEM_ACCESS_DENIED",
    })

    await expect(
      clearWorkItemPresenceServer({
        currentUserId: "user_1",
        itemId: "item_missing",
        workosUserId: "workos_1",
        sessionId: "session_1",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "WORK_ITEM_NOT_FOUND",
    })

    await expect(
      clearWorkItemPresenceServer({
        currentUserId: "user_1",
        itemId: "item_1",
        workosUserId: "workos_1",
        sessionId: "session_1",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "WORK_ITEM_PRESENCE_SESSION_CONFLICT",
    })

    await expect(
      clearWorkItemPresenceServer({
        currentUserId: "user_1",
        itemId: "item_1",
        workosUserId: "workos_1",
        sessionId: "session_1",
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "WORK_ITEM_ACCESS_DENIED",
    })

    await expect(
      heartbeatWorkItemPresenceServer({
        currentUserId: "user_1",
        itemId: "item_1",
        workosUserId: "workos_1",
        email: "alex@example.com",
        name: "Alex",
        avatarUrl: "",
        avatarImageUrl: null,
        sessionId: "session_1",
      })
    ).rejects.toMatchObject({
      status: 503,
      code: "WORK_ITEM_PRESENCE_UNAVAILABLE",
    })
  })

  it("maps core work-item mutation failures to typed application errors", async () => {
    const { createWorkItemServer, shiftTimelineItemServer, updateWorkItemServer } =
      await import("@/lib/server/convex/work")

    mutationMock
      .mockRejectedValueOnce(new Error("Parent item not found"))
      .mockRejectedValueOnce(new Error("Work item is not scheduled"))
      .mockRejectedValueOnce(new Error("Due date must be a valid calendar date"))
      .mockRejectedValueOnce(new Error("Work item id already exists"))
      .mockRejectedValueOnce(new Error("Description document id already exists"))
      .mockRejectedValueOnce(
        new Error("Work item title must be between 2 and 96 characters")
      )
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
      createWorkItemServer({
        currentUserId: "user_1",
        teamId: "team_1",
        type: "task",
        title: "Launch task",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
        dueDate: "not-a-date",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "WORK_ITEM_SCHEDULE_INVALID",
    })

    await expect(
      createWorkItemServer({
        currentUserId: "user_1",
        id: "item_1",
        teamId: "team_1",
        type: "task",
        title: "Launch task",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "WORK_ITEM_ID_CONFLICT",
    })

    await expect(
      createWorkItemServer({
        currentUserId: "user_1",
        descriptionDocId: "doc_1",
        teamId: "team_1",
        type: "task",
        title: "Launch task",
        primaryProjectId: null,
        assigneeId: null,
        priority: "medium",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "WORK_ITEM_DESCRIPTION_DOCUMENT_ID_CONFLICT",
    })

    await expect(
      updateWorkItemServer({
        currentUserId: "user_1",
        itemId: "item_1",
        patch: {
          title: "x",
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "WORK_ITEM_TITLE_INVALID",
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
