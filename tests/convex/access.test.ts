import { beforeEach, describe, expect, it, vi } from "vitest"

const getWorkspaceMembershipDocMock = vi.fn()
const getWorkspaceRoleMapForUserMock = vi.fn()
const getWorkItemByDescriptionDocIdMock = vi.fn()
const getEffectiveRoleMock = vi.fn()
const getTeamDocMock = vi.fn()
const isWorkspaceOwnerMock = vi.fn()

vi.mock("@/convex/app/data", () => ({
  getDocumentDoc: vi.fn(),
  getEffectiveRole: getEffectiveRoleMock,
  getTeamDoc: getTeamDocMock,
  getWorkItemByDescriptionDocId: getWorkItemByDescriptionDocIdMock,
  getWorkspaceMembershipDoc: getWorkspaceMembershipDocMock,
  getWorkspaceEditRole: vi.fn(),
  getWorkspaceRoleMapForUser: getWorkspaceRoleMapForUserMock,
  isWorkspaceOwner: isWorkspaceOwnerMock,
}))

describe("workspace access helpers", () => {
  beforeEach(() => {
    getWorkspaceMembershipDocMock.mockReset()
    getWorkspaceRoleMapForUserMock.mockReset()
    getWorkItemByDescriptionDocIdMock.mockReset()
    getEffectiveRoleMock.mockReset()
    getTeamDocMock.mockReset()
    isWorkspaceOwnerMock.mockReset()

    getEffectiveRoleMock.mockResolvedValue("member")
    getTeamDocMock.mockResolvedValue({
      id: "team_1",
      workspaceId: "workspace_1",
    })
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

  it("allows only private work item creators through item-level edit access", async () => {
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
    ).rejects.toThrow("Work item not found")
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

  it("requires workspace access for legacy private work items", async () => {
    const { requireEditableWorkItemAccess } = await import("@/convex/app/access")

    getWorkspaceRoleMapForUserMock.mockResolvedValue({})

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
    ).rejects.toThrow("You do not have access to this workspace")

    expect(getTeamDocMock).toHaveBeenCalledWith({}, "team_1")
  })

  it("rejects legacy private work items with unresolved workspace", async () => {
    const { requireEditableWorkItemAccess } = await import("@/convex/app/access")

    getTeamDocMock.mockResolvedValue(null)

    await expect(
      requireEditableWorkItemAccess(
        {} as never,
        {
          teamId: "team_removed",
          visibility: "private",
          creatorId: "user_1",
          assigneeId: null,
        },
        "user_1"
      )
    ).rejects.toThrow("Work item not found")
  })

  it("routes item-description document edits through private work item access", async () => {
    const { requireEditableDocumentAccess } = await import(
      "@/convex/app/access"
    )
    const document = {
      id: "doc_1",
      kind: "item-description",
      teamId: "team_1",
      workspaceId: "workspace_1",
    }

    getWorkItemByDescriptionDocIdMock.mockResolvedValue({
      id: "item_1",
      teamId: "team_1",
      visibility: "private",
      creatorId: "user_1",
      assigneeId: null,
    })

    await expect(
      requireEditableDocumentAccess({} as never, document as never, "user_2")
    ).rejects.toThrow("Work item not found")

    await expect(
      requireEditableDocumentAccess({} as never, document as never, "user_1")
    ).resolves.toBeUndefined()

    expect(getWorkItemByDescriptionDocIdMock).toHaveBeenCalledWith(
      {},
      "doc_1"
    )
  })
})
