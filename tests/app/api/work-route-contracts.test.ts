import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const createWorkItemServerMock = vi.fn()
const updateWorkItemServerMock = vi.fn()
const deleteWorkItemServerMock = vi.fn()
const shiftTimelineItemServerMock = vi.fn()
const createProjectServerMock = vi.fn()
const updateProjectServerMock = vi.fn()
const updateViewConfigServerMock = vi.fn()
const toggleViewDisplayPropertyServerMock = vi.fn()
const toggleViewHiddenValueServerMock = vi.fn()
const toggleViewFilterValueServerMock = vi.fn()
const clearViewFiltersServerMock = vi.fn()
const enqueueEmailJobsServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  createWorkItemServer: createWorkItemServerMock,
  updateWorkItemServer: updateWorkItemServerMock,
  deleteWorkItemServer: deleteWorkItemServerMock,
  shiftTimelineItemServer: shiftTimelineItemServerMock,
  createProjectServer: createProjectServerMock,
  updateProjectServer: updateProjectServerMock,
  updateViewConfigServer: updateViewConfigServerMock,
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
    createWorkItemServerMock.mockReset()
    updateWorkItemServerMock.mockReset()
    deleteWorkItemServerMock.mockReset()
    shiftTimelineItemServerMock.mockReset()
    createProjectServerMock.mockReset()
    updateProjectServerMock.mockReset()
    updateViewConfigServerMock.mockReset()
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
          status: "active",
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
})
