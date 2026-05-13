import { beforeEach, describe, expect, it, vi } from "vitest"

const getWorkspaceMembershipDocMock = vi.fn()
const getWorkspaceRoleMapForUserMock = vi.fn()
const getEffectiveRoleMock = vi.fn()
const isWorkspaceOwnerMock = vi.fn()

vi.mock("@/convex/app/data", () => ({
  getDocumentDoc: vi.fn(),
  getEffectiveRole: getEffectiveRoleMock,
  getTeamDoc: vi.fn(),
  getWorkspaceMembershipDoc: getWorkspaceMembershipDocMock,
  getWorkspaceEditRole: vi.fn(),
  getWorkspaceRoleMapForUser: getWorkspaceRoleMapForUserMock,
  isWorkspaceOwner: isWorkspaceOwnerMock,
}))

describe("workspace access helpers", () => {
  beforeEach(() => {
    getWorkspaceMembershipDocMock.mockReset()
    getWorkspaceRoleMapForUserMock.mockReset()
    getEffectiveRoleMock.mockReset()
    isWorkspaceOwnerMock.mockReset()

    getEffectiveRoleMock.mockResolvedValue("member")
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

  it("allows private work item creators and assignees through item-level edit access", async () => {
    const { requireEditableWorkItemAccess } = await import("@/convex/app/access")

    await expect(
      requireEditableWorkItemAccess(
        {} as never,
        {
          teamId: "team_1",
          visibility: "private",
          creatorId: "user_1",
          assigneeId: null,
        },
        "user_1"
      )
    ).resolves.toBeUndefined()

    await expect(
      requireEditableWorkItemAccess(
        {} as never,
        {
          teamId: "team_1",
          visibility: "private",
          creatorId: "user_1",
          assigneeId: "user_2",
        },
        "user_2"
      )
    ).resolves.toBeUndefined()
  })

  it("rejects private work item edits from other team editors", async () => {
    const { requireEditableWorkItemAccess } = await import("@/convex/app/access")

    await expect(
      requireEditableWorkItemAccess(
        {} as never,
        {
          teamId: "team_1",
          visibility: "private",
          creatorId: "user_1",
          assigneeId: null,
        },
        "user_2"
      )
    ).rejects.toThrow("Work item not found")
  })
})
