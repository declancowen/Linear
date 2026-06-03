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

function createDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc_1",
    kind: "workspace-document",
    workspaceId: "workspace_1",
    teamId: null,
    title: "Document",
    content: "<p>Document</p>",
    linkedProjectIds: [],
    linkedWorkItemIds: [],
    linkedDocumentIds: [],
    createdBy: "user_1",
    updatedBy: "user_1",
    createdAt: "2026-06-03T12:00:00.000Z",
    updatedAt: "2026-06-03T12:00:00.000Z",
    ...overrides,
  }
}

function createProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "project_1",
    name: "Launch",
    scopeType: "team",
    scopeId: "team_allowed",
    leadId: "user_1",
    memberIds: [],
    ...overrides,
  }
}

function createWorkItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item_1",
    key: "PLT-1",
    teamId: "team_allowed",
    workspaceId: "workspace_1",
    type: "story",
    title: "Investigate",
    descriptionDocId: "doc_description",
    status: "todo",
    priority: "medium",
    assigneeId: null,
    assigneeIds: [],
    creatorId: "user_1",
    parentId: null,
    primaryProjectId: null,
    linkedProjectIds: [],
    linkedDocumentIds: [],
    labelIds: [],
    visibility: "team",
    milestoneId: null,
    startDate: null,
    dueDate: null,
    targetDate: null,
    subscriberIds: [],
    createdAt: "2026-06-03T12:00:00.000Z",
    updatedAt: "2026-06-03T12:00:00.000Z",
    ...overrides,
  }
}

function createNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "notification_1",
    userId: "user_1",
    type: "mention",
    entityType: "project",
    entityId: "project_1",
    actorId: "user_2",
    message: "You were mentioned",
    contentPreview: null,
    targetCommentId: null,
    readAt: null,
    archivedAt: null,
    emailedAt: null,
    createdAt: "2026-06-03T12:00:00.000Z",
    ...overrides,
  }
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

  it("authorizes accessible team collection scopes from scoped access", async () => {
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

    expect(dataMocks.listWorkItemsByTeam).not.toHaveBeenCalled()
  })

  it("authorizes accessible workspace index scopes from scoped access", async () => {
    const {
      createDocumentIndexScopeKey,
      createProjectIndexScopeKey,
      createScopedCollectionScopeId,
    } = await import("@/lib/scoped-sync/scope-keys")
    const { authorizeScopedReadModelScopeKeysHandler } = await import(
      "@/convex/app/scoped_read_models"
    )

    await authorizeScopedReadModelScopeKeysHandler(ctx as never, {
      serverToken: "server_token",
      workosUserId: "workos_user_1",
      scopeKeys: [
        createDocumentIndexScopeKey(
          createScopedCollectionScopeId("workspace", "workspace_1")
        ),
        createProjectIndexScopeKey(
          createScopedCollectionScopeId("workspace", "workspace_1")
        ),
      ],
    })

    expect(dataMocks.listWorkspaceDocuments).not.toHaveBeenCalled()
    expect(dataMocks.listProjectsByScope).not.toHaveBeenCalled()
  })

  it("filters document index linked targets through scoped access", async () => {
    const { getScopedReadModelHandler } = await import(
      "@/convex/app/scoped_read_models"
    )
    const documents = [
      createDocument({
        id: "doc_workspace",
        kind: "workspace-document",
        linkedProjectIds: [
          "project_allowed",
          "project_workspace",
          "project_forbidden",
        ],
        linkedWorkItemIds: [
          "item_allowed",
          "item_forbidden",
          "item_private_mine",
          "item_private_other",
        ],
      }),
      createDocument({
        id: "doc_private_mine",
        kind: "private-document",
        createdBy: "user_1",
        linkedProjectIds: ["project_allowed"],
      }),
      createDocument({
        id: "doc_private_other",
        kind: "private-document",
        createdBy: "user_2",
        linkedProjectIds: ["project_forbidden"],
        linkedWorkItemIds: ["item_private_other"],
      }),
      createDocument({
        id: "doc_team_allowed",
        kind: "team-document",
        teamId: "team_allowed",
        linkedProjectIds: ["project_allowed"],
        linkedWorkItemIds: ["item_allowed"],
      }),
    ]
    const projects = new Map(
      [
        createProject({
          id: "project_allowed",
          name: "Allowed team project",
        }),
        createProject({
          id: "project_workspace",
          name: "Allowed workspace project",
          scopeType: "workspace",
          scopeId: "workspace_1",
        }),
        createProject({
          id: "project_forbidden",
          name: "Forbidden team project",
          scopeId: "team_forbidden",
        }),
      ].map((project) => [project.id, project])
    )
    const workItems = new Map(
      [
        createWorkItem({
          id: "item_allowed",
          title: "Allowed team item",
        }),
        createWorkItem({
          id: "item_forbidden",
          title: "Forbidden team item",
          teamId: "team_forbidden",
        }),
        createWorkItem({
          id: "item_private_mine",
          title: "My private item",
          teamId: null,
          visibility: "private",
        }),
        createWorkItem({
          id: "item_private_other",
          title: "Other private item",
          teamId: null,
          creatorId: "user_2",
          visibility: "private",
        }),
      ].map((item) => [item.id, item])
    )

    dataMocks.listWorkspaceDocuments.mockResolvedValue(documents)
    dataMocks.getProjectDoc.mockImplementation((_ctx, id: string) =>
      Promise.resolve(projects.get(id) ?? null)
    )
    dataMocks.getWorkItemDoc.mockImplementation((_ctx, id: string) =>
      Promise.resolve(workItems.get(id) ?? null)
    )

    const result = await getScopedReadModelHandler(ctx as never, {
      serverToken: "server_token",
      workosUserId: "workos_user_1",
      instruction: {
        kind: "document-index",
        scopeType: "workspace",
        scopeId: "workspace_1",
      },
    })
    const documentIds = result?.documents?.map((document) => document.id) ?? []
    const projectIds = result?.projects?.map((project) => project.id) ?? []
    const workItemIds = result?.workItems?.map((item) => item.id) ?? []

    expect(documentIds).toEqual(["doc_workspace", "doc_private_mine"])
    expect(projectIds).toEqual(["project_allowed", "project_workspace"])
    expect(projectIds).not.toContain("project_forbidden")
    expect(workItemIds).toEqual(["item_allowed", "item_private_mine"])
    expect(workItemIds).not.toContain("item_forbidden")
    expect(workItemIds).not.toContain("item_private_other")
  })

  it("filters unreadable private team items from project index scopes", async () => {
    const { getScopedReadModelHandler } = await import(
      "@/convex/app/scoped_read_models"
    )
    const project = createProject({
      id: "project_1",
      name: "Launch",
    })
    const publicItem = createWorkItem({
      id: "item_public",
      primaryProjectId: "project_1",
    })
    const privateOtherItem = createWorkItem({
      id: "item_private_other",
      creatorId: "user_2",
      primaryProjectId: "project_1",
      visibility: "private",
    })

    dataMocks.listProjectsByScope.mockResolvedValue([project])
    dataMocks.listWorkItemsByTeam.mockResolvedValue([
      publicItem,
      privateOtherItem,
    ])

    const result = await getScopedReadModelHandler(ctx as never, {
      serverToken: "server_token",
      workosUserId: "workos_user_1",
      instruction: {
        kind: "project-index",
        scopeType: "team",
        scopeId: "team_allowed",
      },
    })
    const workItemIds = result?.workItems?.map((item) => item.id) ?? []

    expect(workItemIds).toEqual(["item_public"])
    expect(workItemIds).not.toContain("item_private_other")
  })

  it("filters unreadable private team items from project detail scopes", async () => {
    const { getScopedReadModelHandler } = await import(
      "@/convex/app/scoped_read_models"
    )
    const project = createProject({
      id: "project_1",
      name: "Launch",
    })
    const publicItem = createWorkItem({
      id: "item_public",
      primaryProjectId: "project_1",
    })
    const privateOtherItem = createWorkItem({
      id: "item_private_other",
      creatorId: "user_2",
      primaryProjectId: "project_1",
      visibility: "private",
    })

    dataMocks.getProjectDoc.mockResolvedValue(project)
    dataMocks.listWorkItemsByTeam.mockResolvedValue([
      publicItem,
      privateOtherItem,
    ])
    dataMocks.listWorkspaceDocuments.mockResolvedValue([])
    dataMocks.listProjectUpdatesByProjects.mockResolvedValue([])

    const result = await getScopedReadModelHandler(ctx as never, {
      serverToken: "server_token",
      workosUserId: "workos_user_1",
      instruction: { kind: "project-detail", projectId: "project_1" },
    })
    const workItemIds = result?.workItems?.map((item) => item.id) ?? []

    expect(workItemIds).toEqual(["item_public"])
    expect(workItemIds).not.toContain("item_private_other")
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

  it("filters unreadable linked documents from work item detail scopes", async () => {
    const { getScopedReadModelHandler } = await import(
      "@/convex/app/scoped_read_models"
    )
    const item = {
      id: "item_1",
      title: "Fix visibility",
      teamId: "team_allowed",
      workspaceId: "workspace_1",
      visibility: "team",
      descriptionDocId: "doc_description",
      linkedDocumentIds: ["doc_private_other"],
      primaryProjectId: null,
      linkedProjectIds: [],
      referencedProjectIds: [],
      parentId: null,
      creatorId: "user_1",
      assigneeId: null,
      assigneeIds: [],
      subscriberIds: [],
    }
    const visibleDocuments = [
      createDocument({
        id: "doc_description",
        kind: "item-description",
        linkedWorkItemIds: ["item_1"],
      }),
      createDocument({
        id: "doc_workspace",
        kind: "workspace-document",
        linkedWorkItemIds: ["item_1"],
      }),
      createDocument({
        id: "doc_team_allowed",
        kind: "team-document",
        teamId: "team_allowed",
        linkedWorkItemIds: ["item_1"],
      }),
      createDocument({
        id: "doc_private_mine",
        kind: "private-document",
        createdBy: "user_1",
        linkedWorkItemIds: ["item_1"],
      }),
    ]
    const unreadableDocuments = [
      createDocument({
        id: "doc_private_other",
        kind: "private-document",
        createdBy: "user_2",
        linkedWorkItemIds: ["item_1"],
      }),
      createDocument({
        id: "doc_team_forbidden",
        kind: "team-document",
        teamId: "team_forbidden",
        linkedWorkItemIds: ["item_1"],
      }),
    ]

    dataMocks.getWorkItemDoc.mockResolvedValue(item)
    dataMocks.listWorkItemsByTeam.mockResolvedValue([item])
    dataMocks.listDocumentsByIds.mockResolvedValue([
      visibleDocuments[0],
      unreadableDocuments[0],
    ])
    dataMocks.listWorkspaceDocuments.mockResolvedValue([
      ...visibleDocuments.slice(1),
      ...unreadableDocuments,
    ])
    dataMocks.listCommentsByTargets.mockResolvedValue([])
    dataMocks.listAttachmentsByTargets.mockResolvedValue([])
    dataMocks.listWorkItemActivitiesByWorkItems.mockResolvedValue([])

    const result = await getScopedReadModelHandler(ctx as never, {
      serverToken: "server_token",
      workosUserId: "workos_user_1",
      instruction: { kind: "work-item-detail", itemId: "item_1" },
    })
    const documentIds = result?.documents?.map((document) => document.id) ?? []

    expect(documentIds).toEqual(
      expect.arrayContaining([
        "doc_description",
        "doc_workspace",
        "doc_team_allowed",
        "doc_private_mine",
      ])
    )
    expect(documentIds).not.toContain("doc_private_other")
    expect(documentIds).not.toContain("doc_team_forbidden")
  })

  it("filters unreadable private sibling items from work item detail scopes", async () => {
    const { getScopedReadModelHandler } = await import(
      "@/convex/app/scoped_read_models"
    )
    const openedItem = createWorkItem({
      id: "item_open",
      title: "Open item",
      visibility: "team",
      creatorId: "user_1",
    })
    const visibleTeamSibling = createWorkItem({
      id: "item_team_sibling",
      title: "Visible team sibling",
      visibility: "team",
      creatorId: "user_2",
    })
    const visiblePrivateSibling = createWorkItem({
      id: "item_private_mine",
      title: "My private sibling",
      visibility: "private",
      creatorId: "user_1",
    })
    const unreadablePrivateSibling = createWorkItem({
      id: "item_private_other",
      title: "Other private sibling",
      visibility: "private",
      creatorId: "user_2",
    })

    dataMocks.getWorkItemDoc.mockResolvedValue(openedItem)
    dataMocks.listWorkItemsByTeam.mockResolvedValue([
      openedItem,
      visibleTeamSibling,
      visiblePrivateSibling,
      unreadablePrivateSibling,
    ])
    dataMocks.listDocumentsByIds.mockResolvedValue([])
    dataMocks.listWorkspaceDocuments.mockResolvedValue([])
    dataMocks.listCommentsByTargets.mockResolvedValue([])
    dataMocks.listAttachmentsByTargets.mockResolvedValue([])
    dataMocks.listWorkItemActivitiesByWorkItems.mockResolvedValue([])
    dataMocks.listCustomPropertyDefinitionsByTeams.mockResolvedValue([
      { id: "property_1", teamId: "team_allowed", name: "Size" },
    ])
    dataMocks.listCustomPropertyValuesByWorkItems.mockImplementation(
      async (_ctx, itemIds: Iterable<string>) =>
        [...itemIds].map((workItemId) => ({
          id: `value_${workItemId}`,
          propertyId: "property_1",
          workItemId,
          value: "M",
        }))
    )

    const result = await getScopedReadModelHandler(ctx as never, {
      serverToken: "server_token",
      workosUserId: "workos_user_1",
      instruction: { kind: "work-item-detail", itemId: "item_open" },
    })
    const workItemIds = result?.workItems?.map((entry) => entry.id) ?? []
    const customPropertyWorkItemIds =
      result?.customPropertyValues?.map((entry) => entry.workItemId) ?? []

    expect(workItemIds).toEqual(
      expect.arrayContaining(["item_open", "item_team_sibling"])
    )
    expect(workItemIds).not.toContain("item_private_other")
    expect(customPropertyWorkItemIds).toEqual(
      expect.arrayContaining(["item_open", "item_team_sibling"])
    )
    expect(customPropertyWorkItemIds).not.toContain("item_private_other")
    expect(
      [
        ...dataMocks.listCustomPropertyValuesByWorkItems.mock.calls[0][1],
      ]
    ).not.toContain("item_private_other")
  })

  it("filters unreadable linked projects from work item detail scopes", async () => {
    const { getScopedReadModelHandler } = await import(
      "@/convex/app/scoped_read_models"
    )
    const openedItem = createWorkItem({
      id: "item_open",
      title: "Open item",
      primaryProjectId: "project_allowed",
      linkedProjectIds: ["project_forbidden"],
    })
    const allowedProject = createProject({
      id: "project_allowed",
      name: "Allowed team project",
    })
    const workspaceProject = createProject({
      id: "project_workspace",
      name: "Allowed workspace project",
      scopeType: "workspace",
      scopeId: "workspace_1",
    })
    const forbiddenProject = createProject({
      id: "project_forbidden",
      name: "Forbidden team project",
      scopeId: "team_forbidden",
    })
    const projects = new Map(
      [allowedProject, workspaceProject, forbiddenProject].map((project) => [
        project.id,
        project,
      ])
    )

    dataMocks.getWorkItemDoc.mockResolvedValue(openedItem)
    dataMocks.listWorkItemsByTeam.mockResolvedValue([openedItem])
    dataMocks.getProjectDoc.mockImplementation((_ctx, id: string) =>
      Promise.resolve(projects.get(id) ?? null)
    )
    dataMocks.listProjectsByScope.mockImplementation(
      async (_ctx, scopeType: string, scopeId: string) => {
        if (scopeType === "team" && scopeId === "team_allowed") {
          return [allowedProject]
        }
        if (scopeType === "workspace" && scopeId === "workspace_1") {
          return [workspaceProject]
        }
        return []
      }
    )
    dataMocks.listDocumentsByIds.mockResolvedValue([])
    dataMocks.listWorkspaceDocuments.mockResolvedValue([])
    dataMocks.listCommentsByTargets.mockResolvedValue([])
    dataMocks.listAttachmentsByTargets.mockResolvedValue([])
    dataMocks.listWorkItemActivitiesByWorkItems.mockResolvedValue([])

    const result = await getScopedReadModelHandler(ctx as never, {
      serverToken: "server_token",
      workosUserId: "workos_user_1",
      instruction: { kind: "work-item-detail", itemId: "item_open" },
    })
    const projectIds = result?.projects?.map((project) => project.id) ?? []

    expect(projectIds).toEqual(["project_allowed", "project_workspace"])
    expect(projectIds).not.toContain("project_forbidden")
    expect([...dataMocks.listMilestonesByProjects.mock.calls[0][1]]).toEqual([
      "project_allowed",
      "project_workspace",
    ])
  })

  it("filters unreadable linked documents from project detail scopes", async () => {
    const { getScopedReadModelHandler } = await import(
      "@/convex/app/scoped_read_models"
    )
    const project = {
      id: "project_1",
      name: "Launch",
      scopeType: "workspace",
      scopeId: "workspace_1",
      leadId: "user_1",
      memberIds: [],
    }
    const item = {
      id: "item_1",
      title: "Launch work",
      teamId: "team_allowed",
      workspaceId: "workspace_1",
      visibility: "team",
      descriptionDocId: "doc_description",
      linkedDocumentIds: [],
      primaryProjectId: "project_1",
      linkedProjectIds: [],
      referencedProjectIds: [],
      parentId: null,
      creatorId: "user_1",
      assigneeId: null,
      assigneeIds: [],
      subscriberIds: [],
    }
    const visibleDocuments = [
      createDocument({
        id: "doc_workspace",
        kind: "workspace-document",
        linkedProjectIds: ["project_1"],
      }),
      createDocument({
        id: "doc_team_allowed",
        kind: "team-document",
        teamId: "team_allowed",
        linkedProjectIds: ["project_1"],
      }),
      createDocument({
        id: "doc_private_mine",
        kind: "private-document",
        createdBy: "user_1",
        linkedProjectIds: ["project_1"],
      }),
    ]
    const unreadableDocuments = [
      createDocument({
        id: "doc_private_other",
        kind: "private-document",
        createdBy: "user_2",
        linkedProjectIds: ["project_1"],
      }),
      createDocument({
        id: "doc_team_forbidden",
        kind: "team-document",
        teamId: "team_forbidden",
        linkedProjectIds: ["project_1"],
      }),
    ]

    dataMocks.getProjectDoc.mockResolvedValue(project)
    dataMocks.listWorkItemsByTeam.mockResolvedValue([item])
    dataMocks.listWorkspaceDocuments.mockResolvedValue([
      ...visibleDocuments,
      ...unreadableDocuments,
    ])
    dataMocks.listProjectUpdatesByProjects.mockResolvedValue([])

    const result = await getScopedReadModelHandler(ctx as never, {
      serverToken: "server_token",
      workosUserId: "workos_user_1",
      instruction: { kind: "project-detail", projectId: "project_1" },
    })
    const documentIds = result?.documents?.map((document) => document.id) ?? []

    expect(documentIds).toEqual(
      expect.arrayContaining([
        "doc_workspace",
        "doc_team_allowed",
        "doc_private_mine",
      ])
    )
    expect(documentIds).not.toContain("doc_private_other")
    expect(documentIds).not.toContain("doc_team_forbidden")
  })

  it("filters unreadable notification targets from inbox scopes", async () => {
    const { getScopedReadModelHandler } = await import(
      "@/convex/app/scoped_read_models"
    )
    const conversations = new Map(
      [
        {
          id: "chat_allowed",
          kind: "chat",
          scopeType: "team",
          scopeId: "team_allowed",
          variant: "team",
          title: "Allowed chat",
          description: "",
          participantIds: ["user_1", "user_2"],
          createdBy: "user_1",
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:00:00.000Z",
          lastActivityAt: "2026-06-03T12:00:00.000Z",
        },
        {
          id: "chat_forbidden",
          kind: "chat",
          scopeType: "team",
          scopeId: "team_forbidden",
          variant: "team",
          title: "Forbidden chat",
          description: "",
          participantIds: ["user_2"],
          createdBy: "user_2",
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:00:00.000Z",
          lastActivityAt: "2026-06-03T12:00:00.000Z",
        },
        {
          id: "channel_allowed",
          kind: "channel",
          scopeType: "team",
          scopeId: "team_allowed",
          variant: "team",
          title: "Allowed channel",
          description: "",
          participantIds: ["user_1", "user_2"],
          createdBy: "user_1",
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:00:00.000Z",
          lastActivityAt: "2026-06-03T12:00:00.000Z",
        },
        {
          id: "channel_forbidden",
          kind: "channel",
          scopeType: "team",
          scopeId: "team_forbidden",
          variant: "team",
          title: "Forbidden channel",
          description: "",
          participantIds: ["user_2"],
          createdBy: "user_2",
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:00:00.000Z",
          lastActivityAt: "2026-06-03T12:00:00.000Z",
        },
      ].map((conversation) => [conversation.id, conversation])
    )
    const channelPosts = new Map(
      [
        {
          id: "post_allowed",
          conversationId: "channel_allowed",
          content: "<p>Allowed post</p>",
          mentionUserIds: [],
          reactions: [],
          createdBy: "user_1",
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:00:00.000Z",
        },
        {
          id: "post_forbidden",
          conversationId: "channel_forbidden",
          content: "<p>Forbidden post</p>",
          mentionUserIds: [],
          reactions: [],
          createdBy: "user_2",
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:00:00.000Z",
        },
      ].map((post) => [post.id, post])
    )
    const projects = new Map(
      [
        {
          id: "project_allowed",
          name: "Allowed project",
          scopeType: "team",
          scopeId: "team_allowed",
          leadId: "user_1",
          memberIds: [],
        },
        {
          id: "project_forbidden",
          name: "Forbidden project",
          scopeType: "team",
          scopeId: "team_forbidden",
          leadId: "user_2",
          memberIds: [],
        },
      ].map((project) => [project.id, project])
    )

    dataMocks.listNotificationsByUser.mockResolvedValue([
      createNotification({
        id: "notification_chat_allowed",
        entityType: "chat",
        entityId: "chat_allowed",
      }),
      createNotification({
        id: "notification_chat_forbidden",
        entityType: "chat",
        entityId: "chat_forbidden",
      }),
      createNotification({
        id: "notification_post_allowed",
        entityType: "channelPost",
        entityId: "post_allowed",
      }),
      createNotification({
        id: "notification_post_forbidden",
        entityType: "channelPost",
        entityId: "post_forbidden",
      }),
      createNotification({
        id: "notification_project_allowed",
        entityType: "project",
        entityId: "project_allowed",
      }),
      createNotification({
        id: "notification_project_forbidden",
        entityType: "project",
        entityId: "project_forbidden",
      }),
    ])
    dataMocks.listInvitesByNormalizedEmail.mockResolvedValue([])
    dataMocks.listInvitesByTeams.mockResolvedValue([])
    dataMocks.getConversationDoc.mockImplementation((_ctx, id: string) =>
      Promise.resolve(conversations.get(id) ?? null)
    )
    dataMocks.getChannelPostDoc.mockImplementation((_ctx, id: string) =>
      Promise.resolve(channelPosts.get(id) ?? null)
    )
    dataMocks.getProjectDoc.mockImplementation((_ctx, id: string) =>
      Promise.resolve(projects.get(id) ?? null)
    )

    const result = await getScopedReadModelHandler(ctx as never, {
      serverToken: "server_token",
      workosUserId: "workos_user_1",
      instruction: { kind: "notification-inbox" },
    })
    const resultConversationIds =
      result?.conversations?.map((conversation) => conversation.id) ?? []
    const resultPostIds = result?.channelPosts?.map((post) => post.id) ?? []
    const resultProjectIds = result?.projects?.map((project) => project.id) ?? []

    expect(resultConversationIds).toEqual(["chat_allowed"])
    expect(resultConversationIds).not.toContain("chat_forbidden")
    expect(resultConversationIds).not.toContain("channel_forbidden")
    expect(resultPostIds).toEqual(["post_allowed"])
    expect(resultProjectIds).toEqual(["project_allowed"])
  })
})
