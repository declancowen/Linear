import { beforeEach, describe, expect, it, vi } from "vitest"

import { SELECTED_WORKSPACE_COOKIE } from "@/lib/server/workspace-selection"
import {
  createJsonRouteRequest,
  createProviderErrorsMockModule,
  expectTypedJsonError,
} from "@/tests/lib/fixtures/api-routes"

const workspaceSelectionMocks = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  logProviderError: vi.fn(),
  requireSession: vi.fn(),
}))

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: workspaceSelectionMocks.requireSession,
}))

vi.mock("@/lib/server/convex", () => ({
  getWorkspaceMembershipBootstrapServer: workspaceSelectionMocks.bootstrap,
}))

vi.mock("@/lib/server/provider-errors", () =>
  createProviderErrorsMockModule(workspaceSelectionMocks.logProviderError)
)

describe("workspace selection route", () => {
  beforeEach(() => {
    workspaceSelectionMocks.requireSession.mockReset()
    workspaceSelectionMocks.bootstrap.mockReset()
    workspaceSelectionMocks.logProviderError.mockReset()
    workspaceSelectionMocks.requireSession.mockResolvedValue({
      user: {
        id: "workos_user_1",
        email: "alex@example.com",
      },
    })
  })

  it("returns the auth response when no session is available", async () => {
    const authResponse = new Response("Unauthorized", { status: 401 })
    workspaceSelectionMocks.requireSession.mockResolvedValue(authResponse)
    const { POST } = await import(
      "@/app/api/workspace/current/selection/route"
    )

    await expect(
      POST(
        createJsonRouteRequest(
          "http://localhost/api/workspace/current/selection",
          "POST",
          {
            workspaceId: "workspace_1",
          }
        )
      )
    ).resolves.toBe(authResponse)
  })

  it("rejects invalid selection payloads", async () => {
    const { POST } = await import(
      "@/app/api/workspace/current/selection/route"
    )
    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/workspace/current/selection",
        "POST",
        {
          workspaceId: " ",
        }
      )
    )

    await expectTypedJsonError(
      response,
      400,
      "Invalid workspace selection payload",
      "ROUTE_INVALID_BODY"
    )
    expect(workspaceSelectionMocks.bootstrap).not.toHaveBeenCalled()
  })

  it("sets the selected workspace cookie after bootstrap confirms the workspace", async () => {
    workspaceSelectionMocks.bootstrap.mockResolvedValue({
      currentWorkspaceId: "workspace_1",
      workspaces: [],
    })
    const { POST } = await import(
      "@/app/api/workspace/current/selection/route"
    )
    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/workspace/current/selection",
        "POST",
        {
          workspaceId: "workspace_1",
        }
      )
    )

    await expect(response.json()).resolves.toEqual({
      data: {
        currentWorkspaceId: "workspace_1",
        workspaces: [],
      },
    })
    expect(response.headers.get("set-cookie")).toContain(
      `${SELECTED_WORKSPACE_COOKIE}=workspace_1`
    )
    expect(workspaceSelectionMocks.bootstrap).toHaveBeenCalledWith({
      workosUserId: "workos_user_1",
      email: "alex@example.com",
      workspaceId: "workspace_1",
    })
  })

  it("rejects bootstrap data for a different workspace", async () => {
    workspaceSelectionMocks.bootstrap.mockResolvedValue({
      currentWorkspaceId: "workspace_2",
    })
    const { POST } = await import(
      "@/app/api/workspace/current/selection/route"
    )
    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/workspace/current/selection",
        "POST",
        {
          workspaceId: "workspace_1",
        }
      )
    )

    await expectTypedJsonError(
      response,
      404,
      "Workspace not found",
      "WORKSPACE_SELECTION_NOT_FOUND"
    )
  })

  it("logs provider failures and returns a typed selection error", async () => {
    workspaceSelectionMocks.bootstrap.mockRejectedValue(
      new Error("Convex unavailable")
    )
    const { POST } = await import(
      "@/app/api/workspace/current/selection/route"
    )
    const response = await POST(
      createJsonRouteRequest(
        "http://localhost/api/workspace/current/selection",
        "POST",
        {
          workspaceId: "workspace_1",
        }
      )
    )

    await expectTypedJsonError(
      response,
      500,
      "Convex unavailable",
      "WORKSPACE_SELECTION_FAILED"
    )
    expect(workspaceSelectionMocks.logProviderError).toHaveBeenCalledWith(
      "Failed to select workspace",
      expect.any(Error)
    )
  })
})
