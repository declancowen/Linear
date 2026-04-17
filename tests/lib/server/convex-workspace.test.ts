import { beforeEach, describe, expect, it, vi } from "vitest"

const mutationMock = vi.fn()
const queryMock = vi.fn()
const resolveServerOriginMock = vi.fn()

vi.mock("@/lib/server/convex/core", () => ({
  getConvexServerClient: () => ({
    mutation: mutationMock,
    query: queryMock,
  }),
  withServerToken: <T extends Record<string, unknown>>(input: T) => input,
  runConvexRequestWithRetry: async (
    _label: string,
    request: () => Promise<unknown>
  ) => request(),
}))

vi.mock("@/lib/server/request-origin", () => ({
  resolveServerOrigin: resolveServerOriginMock,
}))

describe("convex workspace server wrappers", () => {
  beforeEach(() => {
    mutationMock.mockReset()
    queryMock.mockReset()
    resolveServerOriginMock.mockReset()

    resolveServerOriginMock.mockResolvedValue("https://app.example.com")
  })

  it("maps workspace membership lifecycle failures to application errors", async () => {
    const {
      leaveWorkspaceServer,
      removeWorkspaceUserServer,
    } = await import("@/lib/server/convex/workspace")

    mutationMock
      .mockRejectedValueOnce(new Error("Workspace owners can't leave the workspace"))
      .mockRejectedValueOnce(
        new Error("Workspace admins can't be removed from the workspace")
      )

    await expect(
      leaveWorkspaceServer({
        currentUserId: "user_1",
        workspaceId: "workspace_1",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "WORKSPACE_LEAVE_OWNER_FORBIDDEN",
    })

    await expect(
      removeWorkspaceUserServer({
        currentUserId: "user_1",
        workspaceId: "workspace_1",
        userId: "user_2",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "WORKSPACE_USER_REMOVE_ADMIN_FORBIDDEN",
    })
  })

  it("maps account deletion lifecycle blockers to application errors", async () => {
    const {
      deleteCurrentAccountServer,
      validateCurrentAccountDeletionServer,
    } = await import("@/lib/server/convex/workspace")

    queryMock.mockRejectedValueOnce(
      new Error("Transfer or delete your owned workspace before deleting your account")
    )
    mutationMock.mockRejectedValueOnce(
      new Error("Leave or transfer your team admin access before deleting your account")
    )

    await expect(
      validateCurrentAccountDeletionServer({
        currentUserId: "user_1",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "ACCOUNT_DELETE_WORKSPACE_TRANSFER_REQUIRED",
    })

    await expect(
      deleteCurrentAccountServer({
        currentUserId: "user_1",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 409,
      code: "ACCOUNT_DELETE_TEAM_ADMIN_TRANSFER_REQUIRED",
    })
  })

  it("maps workspace settings and profile failures to application errors", async () => {
    const {
      generateSettingsImageUploadUrlServer,
      updateCurrentUserProfileServer,
      updateWorkspaceBrandingServer,
    } = await import("@/lib/server/convex/workspace")

    mutationMock
      .mockRejectedValueOnce(new Error("Uploaded image not found"))
      .mockRejectedValueOnce(new Error("You can only update your own profile"))
      .mockRejectedValueOnce(new Error("Workspace not found"))

    await expect(
      updateWorkspaceBrandingServer({
        currentUserId: "user_1",
        workspaceId: "workspace_1",
        name: "Acme",
        logoUrl: "https://example.com/logo.png",
        logoImageStorageId: "storage_1",
        accent: "blue",
        description: "Updated workspace",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 400,
      code: "WORKSPACE_LOGO_UPLOAD_NOT_FOUND",
    })

    await expect(
      updateCurrentUserProfileServer({
        currentUserId: "user_1",
        userId: "user_2",
        name: "Alex",
        title: "Engineer",
        avatarUrl: "https://example.com/avatar.png",
        preferences: {
          emailMentions: true,
          emailAssignments: true,
          emailDigest: true,
          theme: "system",
        },
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 403,
      code: "PROFILE_UPDATE_FORBIDDEN",
    })

    await expect(
      generateSettingsImageUploadUrlServer({
        currentUserId: "user_1",
        kind: "workspace-logo",
        workspaceId: "workspace_1",
      })
    ).rejects.toMatchObject({
      name: "ApplicationError",
      status: 404,
      code: "WORKSPACE_NOT_FOUND",
    })
  })

  it("threads origin through workspace deletion for transactional email delivery", async () => {
    const { deleteWorkspaceServer } = await import(
      "@/lib/server/convex/workspace"
    )

    mutationMock.mockResolvedValue({
      workspaceId: "workspace_1",
    })

    await deleteWorkspaceServer({
      currentUserId: "user_1",
      workspaceId: "workspace_1",
    })

    expect(resolveServerOriginMock).toHaveBeenCalledTimes(1)
    expect(mutationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        currentUserId: "user_1",
        workspaceId: "workspace_1",
        origin: "https://app.example.com",
      })
    )
  })
})
