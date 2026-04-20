import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const requireConvexUserMock = vi.fn()
const createWorkItemServerMock = vi.fn()
const updateWorkItemServerMock = vi.fn()
const deleteWorkItemServerMock = vi.fn()
const shiftTimelineItemServerMock = vi.fn()
const heartbeatWorkItemPresenceServerMock = vi.fn()
const clearWorkItemPresenceServerMock = vi.fn()
const createProjectServerMock = vi.fn()
const createViewServerMock = vi.fn()
const updateProjectServerMock = vi.fn()
const updateViewConfigServerMock = vi.fn()
const reorderViewDisplayPropertiesServerMock = vi.fn()
const toggleViewDisplayPropertyServerMock = vi.fn()
const toggleViewHiddenValueServerMock = vi.fn()
const toggleViewFilterValueServerMock = vi.fn()
const clearViewFiltersServerMock = vi.fn()
const enqueueEmailJobsServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
  requireConvexUser: requireConvexUserMock,
}))

vi.mock("@/lib/server/convex", () => ({
  createWorkItemServer: createWorkItemServerMock,
  updateWorkItemServer: updateWorkItemServerMock,
  deleteWorkItemServer: deleteWorkItemServerMock,
  shiftTimelineItemServer: shiftTimelineItemServerMock,
  heartbeatWorkItemPresenceServer: heartbeatWorkItemPresenceServerMock,
  clearWorkItemPresenceServer: clearWorkItemPresenceServerMock,
  createProjectServer: createProjectServerMock,
  createViewServer: createViewServerMock,
  updateProjectServer: updateProjectServerMock,
  updateViewConfigServer: updateViewConfigServerMock,
  reorderViewDisplayPropertiesServer: reorderViewDisplayPropertiesServerMock,
  toggleViewDisplayPropertyServer: toggleViewDisplayPropertyServerMock,
  toggleViewHiddenValueServer: toggleViewHiddenValueServerMock,
  toggleViewFilterValueServer: toggleViewFilterValueServerMock,
  clearViewFiltersServer: clearViewFiltersServerMock,
  enqueueEmailJobsServer: enqueueEmailJobsServerMock,
}))

vi.mock("@/lib/server/email", () => ({
  buildAssignmentEmailJobs: vi.fn(() => []),
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

describe("work route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    requireConvexUserMock.mockReset()
    createWorkItemServerMock.mockReset()
    updateWorkItemServerMock.mockReset()
    deleteWorkItemServerMock.mockReset()
    shiftTimelineItemServerMock.mockReset()
    heartbeatWorkItemPresenceServerMock.mockReset()
    clearWorkItemPresenceServerMock.mockReset()
    createProjectServerMock.mockReset()
    createViewServerMock.mockReset()
    updateProjectServerMock.mockReset()
    updateViewConfigServerMock.mockReset()
    reorderViewDisplayPropertiesServerMock.mockReset()
    toggleViewDisplayPropertyServerMock.mockReset()
    toggleViewHiddenValueServerMock.mockReset()
    toggleViewFilterValueServerMock.mockReset()
    clearViewFiltersServerMock.mockReset()
    enqueueEmailJobsServerMock.mockReset()
    logProviderErrorMock.mockReset()

    requireSessionMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
    requireAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_1",
      },
    })
    requireConvexUserMock.mockResolvedValue({
      currentUser: {
        id: "user_1",
        name: "Alex",
        avatarUrl: "",
        avatarImageUrl: null,
      },
    })
    enqueueEmailJobsServerMock.mockResolvedValue({
      queued: 0,
    })
  })

  it("maps work-item creation failures to typed error responses", async () => {
    const { POST } = await import("@/app/api/items/route")

    createWorkItemServerMock.mockRejectedValue(
      new ApplicationError("Parent item not found", 404, {
        code: "WORK_ITEM_PARENT_NOT_FOUND",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId: "team_1",
          type: "task",
          title: "Launch task",
          primaryProjectId: null,
          assigneeId: null,
          priority: "medium",
        }),
      }) as never
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Parent item not found",
      message: "Parent item not found",
      code: "WORK_ITEM_PARENT_NOT_FOUND",
    })
  })

  it("accepts and forwards dueDate in create-work-item requests", async () => {
    const { POST } = await import("@/app/api/items/route")

    createWorkItemServerMock.mockResolvedValue({
      itemId: "item_1",
    })

    const response = await POST(
      new Request("http://localhost/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId: "team_1",
          type: "task",
          title: "Launch task",
          primaryProjectId: null,
          assigneeId: null,
          priority: "medium",
          dueDate: "2026-04-27",
        }),
      }) as never
    )

    expect(response.status).toBe(200)
    expect(createWorkItemServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      teamId: "team_1",
      type: "task",
      title: "Launch task",
      primaryProjectId: null,
      assigneeId: null,
      priority: "medium",
      dueDate: "2026-04-27",
    })
    await expect(response.json()).resolves.toEqual({
      ok: true,
      itemId: "item_1",
    })
  })

  it("maps work-item update and delete failures to typed error responses", async () => {
    const itemRoute = await import("@/app/api/items/[itemId]/route")

    updateWorkItemServerMock.mockRejectedValue(
      new ApplicationError("Work item not found", 404, {
        code: "WORK_ITEM_NOT_FOUND",
      })
    )
    deleteWorkItemServerMock.mockRejectedValue(
      new ApplicationError("Work item not found", 404, {
        code: "WORK_ITEM_NOT_FOUND",
      })
    )

    const patchResponse = await itemRoute.PATCH(
      new Request("http://localhost/api/items/item_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "done",
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(patchResponse.status).toBe(404)
    await expect(patchResponse.json()).resolves.toEqual({
      error: "Work item not found",
      message: "Work item not found",
      code: "WORK_ITEM_NOT_FOUND",
    })

    const deleteResponse = await itemRoute.DELETE(
      new Request("http://localhost/api/items/item_1", {
        method: "DELETE",
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(deleteResponse.status).toBe(404)
    await expect(deleteResponse.json()).resolves.toEqual({
      error: "Work item not found",
      message: "Work item not found",
      code: "WORK_ITEM_NOT_FOUND",
    })
  })

  it("accepts title updates for work items", async () => {
    const itemRoute = await import("@/app/api/items/[itemId]/route")

    updateWorkItemServerMock.mockResolvedValue({
      ok: true,
    })

    const response = await itemRoute.PATCH(
      new Request("http://localhost/api/items/item_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Updated launch task",
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(updateWorkItemServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      itemId: "item_1",
      patch: {
        title: "Updated launch task",
      },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
    })
  })

  it("accepts guarded main-section saves for work items", async () => {
    const itemRoute = await import("@/app/api/items/[itemId]/route")

    updateWorkItemServerMock.mockResolvedValue({
      ok: true,
    })

    const response = await itemRoute.PATCH(
      new Request("http://localhost/api/items/item_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Updated launch task",
          description: "<p>Updated details</p>",
          expectedUpdatedAt: "2026-04-18T10:00:00.000Z",
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(updateWorkItemServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      itemId: "item_1",
      patch: {
        title: "Updated launch task",
        description: "<p>Updated details</p>",
        expectedUpdatedAt: "2026-04-18T10:00:00.000Z",
      },
    })
    expect(response.status).toBe(200)
  })

  it("accepts work-item presence heartbeats and leave", async () => {
    const itemPresenceRoute = await import("@/app/api/items/[itemId]/presence/route")

    heartbeatWorkItemPresenceServerMock.mockResolvedValue([
      {
        userId: "user_2",
        name: "Sam",
        avatarUrl: "",
        avatarImageUrl: null,
        lastSeenAt: "2026-04-18T10:00:00.000Z",
      },
    ])
    clearWorkItemPresenceServerMock.mockResolvedValue({
      ok: true,
    })

    const heartbeatResponse = await itemPresenceRoute.POST(
      new Request("http://localhost/api/items/item_1/presence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "heartbeat",
          sessionId: "session_123",
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(heartbeatWorkItemPresenceServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      itemId: "item_1",
      workosUserId: "workos_1",
      email: "alex@example.com",
      name: "Alex",
      avatarUrl: "",
      avatarImageUrl: null,
      sessionId: "session_123",
    })
    expect(heartbeatResponse.status).toBe(200)
    await expect(heartbeatResponse.json()).resolves.toEqual({
      viewers: [
        {
          userId: "user_2",
          name: "Sam",
          avatarUrl: "",
          avatarImageUrl: null,
          lastSeenAt: "2026-04-18T10:00:00.000Z",
        },
      ],
    })

    const leaveResponse = await itemPresenceRoute.POST(
      new Request("http://localhost/api/items/item_1/presence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "leave",
          sessionId: "session_123",
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(clearWorkItemPresenceServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      itemId: "item_1",
      workosUserId: "workos_1",
      sessionId: "session_123",
    })
    expect(leaveResponse.status).toBe(200)
    await expect(leaveResponse.json()).resolves.toEqual({
      ok: true,
    })
  })

  it("maps work-item presence failures to typed error responses", async () => {
    const itemPresenceRoute = await import("@/app/api/items/[itemId]/presence/route")

    heartbeatWorkItemPresenceServerMock.mockRejectedValue(
      new ApplicationError("Document presence session is already in use", 409, {
        code: "WORK_ITEM_PRESENCE_SESSION_CONFLICT",
      })
    )

    const response = await itemPresenceRoute.POST(
      new Request("http://localhost/api/items/item_1/presence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "heartbeat",
          sessionId: "session_123",
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Document presence session is already in use",
      message: "Document presence session is already in use",
      code: "WORK_ITEM_PRESENCE_SESSION_CONFLICT",
    })
  })

  it("gracefully degrades when work-item presence is unavailable", async () => {
    const itemPresenceRoute = await import("@/app/api/items/[itemId]/presence/route")

    heartbeatWorkItemPresenceServerMock.mockRejectedValue(
      new ApplicationError("Work item presence is unavailable", 503, {
        code: "WORK_ITEM_PRESENCE_UNAVAILABLE",
      })
    )

    const response = await itemPresenceRoute.POST(
      new Request("http://localhost/api/items/item_1/presence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "heartbeat",
          sessionId: "session_123",
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      viewers: [],
    })
  })

  it("maps schedule update failures to typed error responses", async () => {
    const { PATCH } = await import("@/app/api/items/[itemId]/schedule/route")

    shiftTimelineItemServerMock.mockRejectedValue(
      new ApplicationError("Work item is not scheduled", 400, {
        code: "WORK_ITEM_SCHEDULE_MISSING",
      })
    )

    const response = await PATCH(
      new Request("http://localhost/api/items/item_1/schedule", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nextStartDate: "2026-05-01",
        }),
      }) as never,
      {
        params: Promise.resolve({
          itemId: "item_1",
        }),
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Work item is not scheduled",
      message: "Work item is not scheduled",
      code: "WORK_ITEM_SCHEDULE_MISSING",
    })
  })

  it("maps project failures to typed error responses", async () => {
    const projectCreateRoute = await import("@/app/api/projects/route")
    const projectUpdateRoute = await import("@/app/api/projects/[projectId]/route")

    createProjectServerMock.mockRejectedValue(
      new ApplicationError("Settings team not found", 404, {
        code: "PROJECT_SETTINGS_TEAM_NOT_FOUND",
      })
    )
    updateProjectServerMock.mockRejectedValue(
      new ApplicationError("Project not found", 404, {
        code: "PROJECT_NOT_FOUND",
      })
    )

    const createResponse = await projectCreateRoute.POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scopeType: "workspace",
          scopeId: "workspace_1",
          templateType: "software-delivery",
          name: "Launch",
          summary: "Launch summary",
          priority: "medium",
          settingsTeamId: "team_missing",
        }),
      }) as never
    )

    expect(createResponse.status).toBe(404)
    await expect(createResponse.json()).resolves.toEqual({
      error: "Settings team not found",
      message: "Settings team not found",
      code: "PROJECT_SETTINGS_TEAM_NOT_FOUND",
    })

    const updateResponse = await projectUpdateRoute.PATCH(
      new Request("http://localhost/api/projects/project_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "in-progress",
        }),
      }) as never,
      {
        params: Promise.resolve({
          projectId: "project_1",
        }),
      }
    )

    expect(updateResponse.status).toBe(404)
    await expect(updateResponse.json()).resolves.toEqual({
      error: "Project not found",
      message: "Project not found",
      code: "PROJECT_NOT_FOUND",
    })
  })

  it("maps view failures to typed error responses", async () => {
    const { PATCH } = await import("@/app/api/views/[viewId]/route")

    updateViewConfigServerMock.mockRejectedValue(
      new ApplicationError("View not found", 404, {
        code: "VIEW_NOT_FOUND",
      })
    )

    const response = await PATCH(
      new Request("http://localhost/api/views/view_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "updateConfig",
          patch: {
            layout: "list",
          },
        }),
      }) as never,
      {
        params: Promise.resolve({
          viewId: "view_1",
        }),
      }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "View not found",
      message: "View not found",
      code: "VIEW_NOT_FOUND",
    })
  })

  it("accepts view creation", async () => {
    const { POST } = await import("@/app/api/views/route")

    createViewServerMock.mockResolvedValue({
      id: "view_1",
    })

    const response = await POST(
      new Request("http://localhost/api/views", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "view_client_1",
          scopeType: "team",
          scopeId: "team_1",
          entityKind: "items",
          route: "/team/platform/work",
          name: "Delivery view",
          description: "Tracks delivery work",
          layout: "board",
        }),
      }) as never
    )

    expect(createViewServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      id: "view_client_1",
      scopeType: "team",
      scopeId: "team_1",
      entityKind: "items",
      route: "/team/platform/work",
      name: "Delivery view",
      description: "Tracks delivery work",
      layout: "board",
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      viewId: "view_1",
    })
  })

  it("accepts view level updates", async () => {
    const { PATCH } = await import("@/app/api/views/[viewId]/route")

    updateViewConfigServerMock.mockResolvedValue({
      ok: true,
    })

    const response = await PATCH(
      new Request("http://localhost/api/views/view_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "updateConfig",
          patch: {
            itemLevel: "feature",
            showChildItems: true,
          },
        }),
      }) as never,
      {
        params: Promise.resolve({
          viewId: "view_1",
        }),
      }
    )

    expect(updateViewConfigServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      viewId: "view_1",
      itemLevel: "feature",
      showChildItems: true,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
    })
  })

  it("accepts project-specific view filter toggles", async () => {
    const { PATCH } = await import("@/app/api/views/[viewId]/route")

    toggleViewFilterValueServerMock.mockResolvedValue({
      ok: true,
    })

    const response = await PATCH(
      new Request("http://localhost/api/views/view_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "toggleFilterValue",
          key: "leadIds",
          value: "user_2",
        }),
      }) as never,
      {
        params: Promise.resolve({
          viewId: "view_1",
        }),
      }
    )

    expect(toggleViewFilterValueServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      viewId: "view_1",
      key: "leadIds",
      value: "user_2",
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
    })
  })

  it("accepts display property reorder updates", async () => {
    const { PATCH } = await import("@/app/api/views/[viewId]/route")

    reorderViewDisplayPropertiesServerMock.mockResolvedValue({
      ok: true,
    })

    const response = await PATCH(
      new Request("http://localhost/api/views/view_1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reorderDisplayProperties",
          displayProps: ["status", "assignee", "progress"],
        }),
      }) as never,
      {
        params: Promise.resolve({
          viewId: "view_1",
        }),
      }
    )

    expect(reorderViewDisplayPropertiesServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      viewId: "view_1",
      displayProps: ["status", "assignee", "progress"],
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
    })
  })
})
