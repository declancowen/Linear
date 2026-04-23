import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import type { AppSnapshot } from "@/lib/domain/types"

const getSnapshotServerMock = vi.fn()
const bumpScopedReadModelVersionsServerMock = vi.fn()

vi.mock("@/lib/server/convex", () => ({
  bumpScopedReadModelVersionsServer: bumpScopedReadModelVersionsServerMock,
  getSnapshotServer: getSnapshotServerMock,
}))

function createSnapshotFixture(): AppSnapshot {
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    workspaces: [{ id: "workspace_1" }] as AppSnapshot["workspaces"],
    teams: [{ id: "team_1" }] as AppSnapshot["teams"],
    documents: [{ id: "doc_1" }] as AppSnapshot["documents"],
    workItems: [{ id: "item_1" }] as AppSnapshot["workItems"],
    projects: [{ id: "project_1" }] as AppSnapshot["projects"],
    conversations: [{ id: "conversation_1" }] as AppSnapshot["conversations"],
  }
}

describe("authorizeScopedReadModelScopeKeysServer", () => {
  beforeEach(() => {
    vi.resetModules()
    getSnapshotServerMock.mockReset()
    bumpScopedReadModelVersionsServerMock.mockReset()
    getSnapshotServerMock.mockResolvedValue(createSnapshotFixture())
    bumpScopedReadModelVersionsServerMock.mockResolvedValue(undefined)
  })

  it("allows current-user and accessible entity scope keys", async () => {
    const { authorizeScopedReadModelScopeKeysServer } = await import(
      "@/lib/server/scoped-read-models"
    )

    await expect(
      authorizeScopedReadModelScopeKeysServer(
        {
          user: {
            id: "workos_1",
            email: "alex@example.com",
          },
          organizationId: "org_1",
        } as never,
        [
          "shell-context",
          "notification-inbox:user_1",
          "conversation-list:user_1",
          "workspace-membership:workspace_1",
          "search-seed:workspace_1",
          "work-index:team_team_1",
          "document-index:workspace_workspace_1",
          "document-detail:doc_1",
          "work-item-detail:item_1",
          "project-detail:project_1",
          "conversation-thread:conversation_1",
          "channel-feed:conversation_1",
        ]
      )
    ).resolves.toBeUndefined()
  })

  it("rejects inaccessible scope keys", async () => {
    const { authorizeScopedReadModelScopeKeysServer } = await import(
      "@/lib/server/scoped-read-models"
    )

    await expect(
      authorizeScopedReadModelScopeKeysServer(
        {
          user: {
            id: "workos_1",
            email: "alex@example.com",
          },
          organizationId: "org_1",
        } as never,
        ["notification-inbox:user_2"]
      )
    ).rejects.toThrow("Unauthorized scoped read model key: notification-inbox:user_2")
  })

  it("does not bump the global shell-context scope for workspace membership invalidations", async () => {
    const { bumpWorkspaceMembershipReadModelScopesServer } = await import(
      "@/lib/server/scoped-read-models"
    )

    await bumpWorkspaceMembershipReadModelScopesServer("workspace_1")

    expect(bumpScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: [
        "workspace-membership:workspace_1",
        "search-seed:workspace_1",
      ],
    })
  })
})
