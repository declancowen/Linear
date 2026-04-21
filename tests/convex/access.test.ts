import { beforeEach, describe, expect, it, vi } from "vitest"

const getWorkspaceMembershipDocMock = vi.fn()
const getWorkspaceRoleMapForUserMock = vi.fn()
const isWorkspaceOwnerMock = vi.fn()

vi.mock("@/convex/app/data", () => ({
  getDocumentDoc: vi.fn(),
  getEffectiveRole: vi.fn(),
  getWorkspaceMembershipDoc: getWorkspaceMembershipDocMock,
  getWorkspaceEditRole: vi.fn(),
  getWorkspaceRoleMapForUser: getWorkspaceRoleMapForUserMock,
  isWorkspaceOwner: isWorkspaceOwnerMock,
}))

describe("workspace access helpers", () => {
  beforeEach(() => {
    getWorkspaceMembershipDocMock.mockReset()
    getWorkspaceRoleMapForUserMock.mockReset()
    isWorkspaceOwnerMock.mockReset()

    isWorkspaceOwnerMock.mockResolvedValue(false)
    getWorkspaceMembershipDocMock.mockResolvedValue(null)
    getWorkspaceRoleMapForUserMock.mockResolvedValue({
      workspace_1: ["admin"],
    })
  })

  it("allows direct workspace admins", async () => {
    const { requireWorkspaceAdminAccess } = await import("@/convex/app/access")

    getWorkspaceMembershipDocMock.mockResolvedValue({
      workspaceId: "workspace_1",
      userId: "user_1",
      role: "admin",
    })

    await expect(
      requireWorkspaceAdminAccess({} as never, "workspace_1", "user_1")
    ).resolves.toBeUndefined()
  })

  it("rejects team-derived admin access without a direct workspace admin role", async () => {
    const { requireWorkspaceAdminAccess } = await import("@/convex/app/access")

    getWorkspaceMembershipDocMock.mockResolvedValue({
      workspaceId: "workspace_1",
      userId: "user_1",
      role: "member",
    })

    await expect(
      requireWorkspaceAdminAccess({} as never, "workspace_1", "user_1")
    ).rejects.toThrow("Only workspace admins can perform this action")
    expect(getWorkspaceRoleMapForUserMock).not.toHaveBeenCalled()
  })
})
