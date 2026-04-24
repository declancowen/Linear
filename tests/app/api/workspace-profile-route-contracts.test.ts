import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const requireConvexUserMock = vi.fn()
const createWorkspaceServerMock = vi.fn()
const updateWorkspaceBrandingServerMock = vi.fn()
const deleteWorkspaceServerMock = vi.fn()
const setWorkspaceWorkosOrganizationServerMock = vi.fn()
const updateCurrentUserProfileServerMock = vi.fn()
const generateSettingsImageUploadUrlServerMock = vi.fn()
const heartbeatDocumentPresenceServerMock = vi.fn()
const clearDocumentPresenceServerMock = vi.fn()
const bumpUserWorkspaceMembershipReadModelScopesServerMock = vi.fn()
const ensureWorkspaceOrganizationMock = vi.fn()
const syncUserProfileToWorkOSMock = vi.fn()
const toAuthenticatedAppUserMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
  requireConvexUser: requireConvexUserMock,
}))

vi.mock("@/lib/server/convex", () => ({
  createWorkspaceServer: createWorkspaceServerMock,
  updateWorkspaceBrandingServer: updateWorkspaceBrandingServerMock,
  deleteWorkspaceServer: deleteWorkspaceServerMock,
  setWorkspaceWorkosOrganizationServer: setWorkspaceWorkosOrganizationServerMock,
  updateCurrentUserProfileServer: updateCurrentUserProfileServerMock,
  generateSettingsImageUploadUrlServer: generateSettingsImageUploadUrlServerMock,
  heartbeatDocumentPresenceServer: heartbeatDocumentPresenceServerMock,
  clearDocumentPresenceServer: clearDocumentPresenceServerMock,
}))

vi.mock("@/lib/server/workos", () => ({
  ensureWorkspaceOrganization: ensureWorkspaceOrganizationMock,
  syncUserProfileToWorkOS: syncUserProfileToWorkOSMock,
}))

vi.mock("@/lib/server/scoped-read-models", () => ({
  bumpUserWorkspaceMembershipReadModelScopesServer:
    bumpUserWorkspaceMembershipReadModelScopesServerMock,
}))

vi.mock("@/lib/workos/auth", () => ({
  toAuthenticatedAppUser: toAuthenticatedAppUserMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

describe("workspace and profile route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    requireConvexUserMock.mockReset()
    createWorkspaceServerMock.mockReset()
    updateWorkspaceBrandingServerMock.mockReset()
    deleteWorkspaceServerMock.mockReset()
    setWorkspaceWorkosOrganizationServerMock.mockReset()
    updateCurrentUserProfileServerMock.mockReset()
    generateSettingsImageUploadUrlServerMock.mockReset()
    heartbeatDocumentPresenceServerMock.mockReset()
    clearDocumentPresenceServerMock.mockReset()
    bumpUserWorkspaceMembershipReadModelScopesServerMock.mockReset()
    ensureWorkspaceOrganizationMock.mockReset()
    syncUserProfileToWorkOSMock.mockReset()
    toAuthenticatedAppUserMock.mockReset()
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
      authenticatedUser: {
        workosUserId: "workos_1",
      },
      authContext: {
        currentUser: {
          id: "user_1",
        },
        currentWorkspace: {
          id: "workspace_1",
          slug: "acme",
          name: "Acme",
          logoUrl: "https://example.com/logo.png",
          workosOrganizationId: "org_existing",
          settings: {
            accent: "blue",
            description: "Acme workspace",
          },
        },
        isWorkspaceOwner: true,
      },
    })
    requireConvexUserMock.mockResolvedValue({
      currentUser: {
        id: "user_1",
        name: "Alex Stored",
        avatarUrl: "AS",
        avatarImageUrl: "https://example.com/convex-avatar.png",
      },
    })
    ensureWorkspaceOrganizationMock.mockResolvedValue({
      id: "org_new",
    })
    syncUserProfileToWorkOSMock.mockResolvedValue(undefined)
    toAuthenticatedAppUserMock.mockReturnValue({
      workosUserId: "workos_1",
      email: "alex@example.com",
      name: "Alex",
      avatarUrl: "https://example.com/avatar.png",
    })
  })

  it("maps workspace update failures to typed error responses", async () => {
    const { PATCH } = await import("@/app/api/workspace/current/route")

    updateWorkspaceBrandingServerMock.mockRejectedValue(
      new ApplicationError("Workspace not found", 404, {
        code: "WORKSPACE_NOT_FOUND",
      })
    )

    const response = await PATCH(
      new Request("http://localhost/api/workspace/current", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Acme 2",
          logoUrl: "AC",
          accent: "green",
          description: "Updated ok",
        }),
      }) as never
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Workspace not found",
      message: "Workspace not found",
      code: "WORKSPACE_NOT_FOUND",
    })
    expect(ensureWorkspaceOrganizationMock).not.toHaveBeenCalled()
  })

  it("maps workspace creation failures without provider-error noise", async () => {
    const { POST } = await import("@/app/api/workspaces/route")

    createWorkspaceServerMock.mockRejectedValue(
      new ApplicationError("Workspace name is required", 400, {
        code: "WORKSPACE_NAME_REQUIRED",
      })
    )
    requireAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_1",
      },
      authContext: {
        currentWorkspace: null,
        pendingWorkspace: null,
      },
    })

    const response = await POST(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Acme",
          description: "Ignored ok",
        }),
      }) as never
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Workspace name is required",
      message: "Workspace name is required",
      code: "WORKSPACE_NAME_REQUIRED",
    })
    expect(logProviderErrorMock).not.toHaveBeenCalled()
  })

  it("maps workspace delete failures to typed error responses", async () => {
    const { DELETE } = await import("@/app/api/workspace/current/route")

    deleteWorkspaceServerMock.mockRejectedValue(
      new ApplicationError("Only the workspace owner can delete the workspace", 403, {
        code: "WORKSPACE_DELETE_OWNER_REQUIRED",
      })
    )

    const response = await DELETE()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "Only the workspace owner can delete the workspace",
      message: "Only the workspace owner can delete the workspace",
      code: "WORKSPACE_DELETE_OWNER_REQUIRED",
    })
  })

  it("maps profile update failures to typed error responses", async () => {
    const { PATCH } = await import("@/app/api/profile/route")

    updateCurrentUserProfileServerMock.mockRejectedValue(
      new ApplicationError("Uploaded image not found", 400, {
        code: "PROFILE_AVATAR_UPLOAD_NOT_FOUND",
      })
    )

    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Alex",
          title: "Engineer",
          avatarUrl: "AC",
          preferences: {
            emailMentions: true,
            emailAssignments: true,
            emailDigest: true,
            theme: "system",
          },
        }),
      }) as never
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Uploaded image not found",
      message: "Uploaded image not found",
      code: "PROFILE_AVATAR_UPLOAD_NOT_FOUND",
    })
    expect(syncUserProfileToWorkOSMock).not.toHaveBeenCalled()
  })

  it("accepts an empty profile title", async () => {
    const { PATCH } = await import("@/app/api/profile/route")

    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Alex",
          title: "",
          avatarUrl: "AC",
          preferences: {
            emailMentions: true,
            emailAssignments: true,
            emailDigest: true,
            theme: "system",
          },
        }),
      }) as never
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      userId: "user_1",
    })
    expect(updateCurrentUserProfileServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      userId: "user_1",
      name: "Alex",
      title: "",
      avatarUrl: "AC",
      preferences: {
        emailMentions: true,
        emailAssignments: true,
        emailDigest: true,
        theme: "system",
      },
    })
    expect(syncUserProfileToWorkOSMock).toHaveBeenCalledWith({
      workosUserId: "workos_1",
      name: "Alex",
    })
    expect(bumpUserWorkspaceMembershipReadModelScopesServerMock).toHaveBeenCalledWith(
      expect.anything(),
      "user_1"
    )
  })

  it("maps settings image upload failures to typed error responses", async () => {
    const { POST } = await import("@/app/api/settings-images/upload-url/route")

    generateSettingsImageUploadUrlServerMock.mockRejectedValue(
      new ApplicationError("User not found", 404, {
        code: "PROFILE_NOT_FOUND",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/settings-images/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "user-avatar",
        }),
      }) as never
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "User not found",
      message: "User not found",
      code: "PROFILE_NOT_FOUND",
    })
  })

  it("maps document presence failures to typed error responses", async () => {
    const { POST } = await import("@/app/api/documents/[documentId]/presence/route")

    heartbeatDocumentPresenceServerMock.mockRejectedValue(
      new ApplicationError("Document presence session is already in use", 409, {
        code: "DOCUMENT_PRESENCE_SESSION_CONFLICT",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/documents/document_1/presence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "heartbeat",
          sessionId: "session_12345",
        }),
      }) as never,
      {
        params: Promise.resolve({
          documentId: "document_1",
        }),
      }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "Document presence session is already in use",
      message: "Document presence session is already in use",
      code: "DOCUMENT_PRESENCE_SESSION_CONFLICT",
    })
    expect(heartbeatDocumentPresenceServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      documentId: "document_1",
      workosUserId: "workos_1",
      email: "alex@example.com",
      name: "Alex Stored",
      avatarUrl: "AS",
      avatarImageUrl: "https://example.com/convex-avatar.png",
      activeBlockId: null,
      sessionId: "session_12345",
    })
  })
})
