import { beforeEach, describe, expect, it, vi } from "vitest"

const authorizeScopedReadModelScopeKeysConvexServerMock = vi.fn()
const bumpScopedReadModelVersionsServerMock = vi.fn()
const getSelectedWorkspaceIdFromCookiesMock = vi.fn()
const resolveScopedReadModelScopeKeysServerMock = vi.fn()

vi.mock("@/lib/server/convex", () => ({
  authorizeScopedReadModelScopeKeysConvexServer:
    authorizeScopedReadModelScopeKeysConvexServerMock,
  bumpScopedReadModelVersionsServer: bumpScopedReadModelVersionsServerMock,
  resolveScopedReadModelScopeKeysServer:
    resolveScopedReadModelScopeKeysServerMock,
}))

vi.mock("@/lib/server/workspace-selection", () => ({
  getSelectedWorkspaceIdFromCookies: getSelectedWorkspaceIdFromCookiesMock,
}))

const session = {
  user: {
    id: "workos_1",
    email: "alex@example.com",
  },
  organizationId: "org_1",
} as never

describe("scoped read model server helpers", () => {
  beforeEach(() => {
    vi.resetModules()
    authorizeScopedReadModelScopeKeysConvexServerMock.mockReset()
    bumpScopedReadModelVersionsServerMock.mockReset()
    getSelectedWorkspaceIdFromCookiesMock.mockReset()
    resolveScopedReadModelScopeKeysServerMock.mockReset()

    authorizeScopedReadModelScopeKeysConvexServerMock.mockResolvedValue(
      undefined
    )
    bumpScopedReadModelVersionsServerMock.mockResolvedValue(undefined)
    getSelectedWorkspaceIdFromCookiesMock.mockResolvedValue("workspace_1")
    resolveScopedReadModelScopeKeysServerMock.mockResolvedValue([
      "document-detail:doc_1",
    ])
  })

  it("authorizes scope keys through the narrow Convex authorizer", async () => {
    const { authorizeScopedReadModelScopeKeysServer } =
      await import("@/lib/server/scoped-read-models")

    await authorizeScopedReadModelScopeKeysServer(session, [
      "document-detail:doc_1",
    ])

    expect(
      authorizeScopedReadModelScopeKeysConvexServerMock
    ).toHaveBeenCalledWith({
      workosUserId: "workos_1",
      email: "alex@example.com",
      selectedWorkspaceId: "workspace_1",
      scopeKeys: ["document-detail:doc_1"],
    })
  })

  it("surfaces Convex authorization failures", async () => {
    authorizeScopedReadModelScopeKeysConvexServerMock.mockRejectedValue(
      new Error("Unauthorized scoped read model key: notification-inbox:user_2")
    )

    const { authorizeScopedReadModelScopeKeysServer } =
      await import("@/lib/server/scoped-read-models")

    await expect(
      authorizeScopedReadModelScopeKeysServer(session, [
        "notification-inbox:user_2",
      ])
    ).rejects.toThrow(
      "Unauthorized scoped read model key: notification-inbox:user_2"
    )
  })

  it("resolves document invalidations through the narrow Convex resolver", async () => {
    const { resolveDocumentReadModelScopeKeysServer } =
      await import("@/lib/server/scoped-read-models")

    await expect(
      resolveDocumentReadModelScopeKeysServer(session, "doc_1")
    ).resolves.toEqual(["document-detail:doc_1"])

    expect(resolveScopedReadModelScopeKeysServerMock).toHaveBeenCalledWith({
      workosUserId: "workos_1",
      email: "alex@example.com",
      selectedWorkspaceId: "workspace_1",
      target: {
        kind: "document",
        documentId: "doc_1",
      },
    })
  })

  it("bumps resolved work item invalidations", async () => {
    resolveScopedReadModelScopeKeysServerMock.mockResolvedValue([
      "work-item-detail:item_1",
      "work-index:team_team_1",
    ])

    const { bumpWorkItemReadModelScopesServer } =
      await import("@/lib/server/scoped-read-models")

    await bumpWorkItemReadModelScopesServer(session, "item_1")

    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: ["work-item-detail:item_1", "work-index:team_team_1"],
    })
  })

  it("bumps owner-scoped private document and search invalidations without shared workspace keys", async () => {
    const {
      bumpPrivateDocumentIndexReadModelScopesServer,
      bumpPrivateSearchSeedReadModelScopesServer,
    } = await import("@/lib/server/scoped-read-models")

    await bumpPrivateDocumentIndexReadModelScopesServer("workspace_1", "user_1")
    await bumpPrivateSearchSeedReadModelScopesServer("workspace_1", "user_1")

    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenNthCalledWith(1, {
      scopeKeys: ["private-document-index:workspace_1:user_1"],
    })
    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenNthCalledWith(2, {
      scopeKeys: ["private-search-seed:workspace_1:user_1"],
    })
  })

  it("does not bump the global shell-context scope for workspace membership invalidations", async () => {
    const { bumpWorkspaceMembershipReadModelScopesServer } =
      await import("@/lib/server/scoped-read-models")

    await bumpWorkspaceMembershipReadModelScopesServer("workspace_1")

    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: [
        "workspace-membership:workspace_1",
        "workspace-people:workspace_1",
        "search-seed:workspace_1",
      ],
    })
  })
})
