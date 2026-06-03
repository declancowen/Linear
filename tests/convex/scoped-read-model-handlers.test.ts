import { beforeEach, describe, expect, it, vi } from "vitest"

const dataMocks = vi.hoisted(() => ({
  getChannelPostDoc: vi.fn(),
  getChatMessageDoc: vi.fn(),
  getConversationDoc: vi.fn(),
  getDocumentDoc: vi.fn(),
  getProjectDoc: vi.fn(),
  getUserAppState: vi.fn(),
  getViewDoc: vi.fn(),
  getWorkItemDoc: vi.fn(),
  listAttachmentsByTargets: vi.fn(),
  listCallsByConversation: vi.fn(),
  listChannelPostCommentsByPosts: vi.fn(),
  listChannelPostsByConversation: vi.fn(),
  listChatMessagesByConversation: vi.fn(),
  listLatestReadableChatMessagesByConversations: vi.fn(),
  listChatReadStatesByUser: vi.fn(),
  listCommentsByTargets: vi.fn(),
  listConversationsByScope: vi.fn(),
  listCustomPropertyDefinitionsByTeams: vi.fn(),
  listCustomPropertyValuesByWorkItems: vi.fn(),
  listDocumentsByIds: vi.fn(),
  listInvitesByNormalizedEmail: vi.fn(),
  listInvitesByTeams: vi.fn(),
  listLabelsByWorkspaces: vi.fn(),
  listMilestonesByProjects: vi.fn(),
  listNotificationsByUser: vi.fn(),
  listPrivateWorkItemsByCreator: vi.fn(),
  listProjectUpdatesByProjects: vi.fn(),
  listProjectsByScope: vi.fn(),
  listTeamDocuments: vi.fn(),
  listTeamMembershipsByTeams: vi.fn(),
  listTeamMembershipsByUser: vi.fn(),
  listTeamsByIds: vi.fn(),
  listUsersByIds: vi.fn(),
  listViewsByScope: vi.fn(),
  listViewsByScopeEntity: vi.fn(),
  listWorkItemActivitiesByWorkItems: vi.fn(),
  listWorkItemsByTeam: vi.fn(),
  listWorkspaceDocuments: vi.fn(),
  listWorkspaceMembershipsByUser: vi.fn(),
  listWorkspaceMembershipsByWorkspaces: vi.fn(),
  listWorkspacesByIds: vi.fn(),
  listWorkspacesOwnedByUser: vi.fn(),
  resolvePreferredWorkspaceId: vi.fn(),
}))
const assertServerTokenMock = vi.hoisted(() => vi.fn())
const resolveUserFromServerArgsMock = vi.hoisted(() => vi.fn())

vi.mock("@/convex/app/access", () => ({
  requireReadableDocumentAccess: vi.fn(),
  requireReadableTeamAccess: vi.fn(),
  requireReadableWorkItemAccess: vi.fn(),
  requireReadableWorkspaceAccess: vi.fn(),
}))

vi.mock("@/convex/app/auth_bootstrap", () => ({
  normalizeBootstrapChatMessage: vi.fn((message) => message),
}))

vi.mock("@/convex/app/conversations", () => ({
  requireConversationAccess: vi.fn(),
}))

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  normalizeEmailAddress: vi.fn((email: string) => email.toLowerCase()),
}))

vi.mock("@/convex/app/data", () => dataMocks)

vi.mock("@/convex/app/normalization", () => ({
  normalizeDocument: vi.fn((document) => document),
  normalizeTeam: vi.fn((team) => team),
  normalizeViewDefinition: vi.fn((view) => view),
  normalizeWorkItem: vi.fn((item) => item),
  resolveUserSnapshot: vi.fn((_ctx, user) => user),
  resolveWorkspaceSnapshot: vi.fn((_ctx, workspace) => workspace),
}))

vi.mock("@/convex/app/server_users", () => ({
  resolveUserFromServerArgs: resolveUserFromServerArgsMock,
}))

const ctx = {
  storage: {
    getUrl: vi.fn(),
  },
}

const user = {
  id: "user_1",
  name: "Alex User",
  email: "alex@example.com",
}

const workspace = {
  id: "workspace_1",
  name: "Workspace",
  createdBy: "user_1",
}

const team = {
  id: "team_allowed",
  name: "Platform",
  key: "PLT",
  workspaceId: "workspace_1",
}

describe("scoped read model Convex handlers", () => {
  beforeEach(() => {
    vi.resetModules()
    assertServerTokenMock.mockReset()
    resolveUserFromServerArgsMock.mockReset()
    ctx.storage.getUrl.mockReset()

    for (const mock of Object.values(dataMocks)) {
      mock.mockReset()
    }

    resolveUserFromServerArgsMock.mockResolvedValue(user)
    dataMocks.getUserAppState.mockResolvedValue({
      userId: "user_1",
      currentWorkspaceId: "workspace_1",
    })
    dataMocks.listWorkspaceMembershipsByUser.mockResolvedValue([
      { workspaceId: "workspace_1", userId: "user_1", role: "member" },
    ])
    dataMocks.listTeamMembershipsByUser.mockResolvedValue([
      { teamId: "team_allowed", userId: "user_1", role: "member" },
    ])
    dataMocks.listWorkspacesOwnedByUser.mockResolvedValue([])
    dataMocks.listTeamsByIds.mockResolvedValue([team])
    dataMocks.listWorkspacesByIds.mockResolvedValue([workspace])
    dataMocks.resolvePreferredWorkspaceId.mockReturnValue("workspace_1")
    dataMocks.listTeamMembershipsByTeams.mockResolvedValue([
      { teamId: "team_allowed", userId: "user_1", role: "member" },
    ])
    dataMocks.listWorkspaceMembershipsByWorkspaces.mockResolvedValue([
      { workspaceId: "workspace_1", userId: "user_1", role: "member" },
    ])
    dataMocks.listLabelsByWorkspaces.mockResolvedValue([])
    dataMocks.listUsersByIds.mockResolvedValue([user])
    dataMocks.listWorkItemsByTeam.mockResolvedValue([])
    dataMocks.listTeamDocuments.mockResolvedValue([])
    dataMocks.listProjectsByScope.mockResolvedValue([])
    dataMocks.listViewsByScope.mockResolvedValue([])
    dataMocks.listViewsByScopeEntity.mockResolvedValue([])
    dataMocks.listMilestonesByProjects.mockResolvedValue([])
    dataMocks.listCustomPropertyDefinitionsByTeams.mockResolvedValue([])
    dataMocks.listCustomPropertyValuesByWorkItems.mockResolvedValue([])
    dataMocks.listPrivateWorkItemsByCreator.mockResolvedValue([])
    dataMocks.listConversationsByScope.mockResolvedValue([])
    dataMocks.listLatestReadableChatMessagesByConversations.mockResolvedValue([])
    dataMocks.listChatReadStatesByUser.mockResolvedValue([])
  })

  it("denies unauthorized team collection scopes before reading team data", async () => {
    const {
      createScopedCollectionScopeId,
      createWorkIndexScopeKey,
    } = await import("@/lib/scoped-sync/scope-keys")
    const { authorizeScopedReadModelScopeKeysHandler } = await import(
      "@/convex/app/scoped_read_models"
    )

    await expect(
      authorizeScopedReadModelScopeKeysHandler(ctx as never, {
        serverToken: "server_token",
        workosUserId: "workos_user_1",
        scopeKeys: [
          createWorkIndexScopeKey(
            createScopedCollectionScopeId("team", "team_forbidden")
          ),
        ],
      })
    ).rejects.toThrow("Unauthorized scoped read model key")

    expect(dataMocks.listWorkItemsByTeam).not.toHaveBeenCalledWith(
      expect.anything(),
      "team_forbidden"
    )
  })

  it("authorizes accessible team collection scopes through scoped data", async () => {
    const {
      createScopedCollectionScopeId,
      createWorkIndexScopeKey,
    } = await import("@/lib/scoped-sync/scope-keys")
    const { authorizeScopedReadModelScopeKeysHandler } = await import(
      "@/convex/app/scoped_read_models"
    )

    await authorizeScopedReadModelScopeKeysHandler(ctx as never, {
      serverToken: "server_token",
      workosUserId: "workos_user_1",
      scopeKeys: [
        createWorkIndexScopeKey(
          createScopedCollectionScopeId("team", "team_allowed")
        ),
      ],
    })

    expect(dataMocks.listWorkItemsByTeam).toHaveBeenCalledWith(
      expect.anything(),
      "team_allowed"
    )
  })

  it("loads conversation list previews through bounded latest-message reads", async () => {
    const { getScopedReadModelHandler } = await import(
      "@/convex/app/scoped_read_models"
    )
    const conversation = {
      id: "chat_1",
      kind: "chat",
      scopeType: "team",
      scopeId: "team_allowed",
      variant: "team",
      title: "Platform",
      description: "",
      participantIds: ["user_1", "user_2"],
      createdBy: "user_1",
      createdAt: "2026-06-03T12:00:00.000Z",
      updatedAt: "2026-06-03T12:00:00.000Z",
      lastActivityAt: "2026-06-03T12:01:00.000Z",
    }
    const latestMessage = {
      id: "message_1",
      conversationId: "chat_1",
      kind: "text",
      content: "<p>Latest readable</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: "user_2",
      createdAt: "2026-06-03T12:01:00.000Z",
    }

    dataMocks.listConversationsByScope
      .mockResolvedValueOnce([conversation])
      .mockResolvedValueOnce([])
    dataMocks.listLatestReadableChatMessagesByConversations.mockResolvedValue([
      latestMessage,
    ])

    await expect(
      getScopedReadModelHandler(ctx as never, {
        serverToken: "server_token",
        workosUserId: "workos_user_1",
        instruction: { kind: "conversation-list" },
      })
    ).resolves.toMatchObject({
      chatMessages: [latestMessage],
      conversations: [conversation],
    })

    expect(
      dataMocks.listLatestReadableChatMessagesByConversations
    ).toHaveBeenCalledWith(expect.anything(), ["chat_1"])
    expect(dataMocks.listChatMessagesByConversation).not.toHaveBeenCalled()
  })
})
