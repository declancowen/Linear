import { beforeEach, describe, expect, it, vi } from "vitest"

const buildAccessChangeEmailJobsMock = vi.fn()
const requireTeamAdminAccessMock = vi.fn()
const requireWorkspaceOwnerAccessMock = vi.fn()
const cascadeDeleteTeamDataMock = vi.fn()
const cleanupRemainingLinksAfterDeleteMock = vi.fn()
const cleanupUnusedLabelsMock = vi.fn()
const cleanupUserAppStatesForDeletedWorkspaceMock = vi.fn()
const cleanupViewFiltersForDeletedEntitiesMock = vi.fn()
const deleteDocsMock = vi.fn()
const deleteStorageObjectsMock = vi.fn()
const assertServerTokenMock = vi.fn()
const getTeamDocMock = vi.fn()
const getUserDocMock = vi.fn()
const getWorkspaceDocMock = vi.fn()
const getWorkspaceMembershipDocMock = vi.fn()
const listActiveTeamUsersMock = vi.fn()
const listActiveWorkspaceUsersMock = vi.fn()
const listAttachmentsByTargetsMock = vi.fn()
const listCallsByConversationsMock = vi.fn()
const listChannelPostCommentsByPostsMock = vi.fn()
const listChannelPostsByConversationsMock = vi.fn()
const listChatMessagesByConversationsMock = vi.fn()
const listCommentsByTargetsMock = vi.fn()
const listConversationsByScopeMock = vi.fn()
const listDocumentPresenceByDocumentsMock = vi.fn()
const listMilestonesByProjectsMock = vi.fn()
const listNotificationsByEntitiesMock = vi.fn()
const listProjectsByScopeMock = vi.fn()
const listProjectUpdatesByProjectsMock = vi.fn()
const listTeamMembershipsByTeamsMock = vi.fn()
const listTeamsByIdsMock = vi.fn()
const listUsersByIdsMock = vi.fn()
const listViewsByScopeMock = vi.fn()
const listWorkspaceMembershipsByUserMock = vi.fn()
const listWorkspaceDocumentsMock = vi.fn()
const listWorkspaceMembershipsByWorkspaceMock = vi.fn()
const listWorkspacesByIdsMock = vi.fn()
const listWorkspacesOwnedByUserMock = vi.fn()
const listWorkspaceTeamsMock = vi.fn()
const createNotificationMock = vi.fn()
const insertAuditEventMock = vi.fn()
const queueEmailJobsMock = vi.fn()
const applyWorkspaceAccessRemovalPolicyMock = vi.fn()
const finalizeCurrentAccountDeletionPolicyMock = vi.fn()
const syncTeamConversationMembershipsMock = vi.fn()

vi.mock("@/lib/email/builders", () => ({
  buildAccessChangeEmailJobs: buildAccessChangeEmailJobsMock,
}))

vi.mock("@/convex/app/access", () => ({
  requireTeamAdminAccess: requireTeamAdminAccessMock,
  requireWorkspaceOwnerAccess: requireWorkspaceOwnerAccessMock,
}))

vi.mock("@/convex/app/cleanup", () => ({
  cascadeDeleteTeamData: cascadeDeleteTeamDataMock,
  cleanupRemainingLinksAfterDelete: cleanupRemainingLinksAfterDeleteMock,
  cleanupUnusedLabels: cleanupUnusedLabelsMock,
  cleanupUserAppStatesForDeletedWorkspace:
    cleanupUserAppStatesForDeletedWorkspaceMock,
  cleanupViewFiltersForDeletedEntities: cleanupViewFiltersForDeletedEntitiesMock,
  deleteDocs: deleteDocsMock,
  deleteStorageObjects: deleteStorageObjectsMock,
}))

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
}))

vi.mock("@/convex/app/data", () => ({
  getTeamDoc: getTeamDocMock,
  getUserDoc: getUserDocMock,
  getWorkspaceDoc: getWorkspaceDocMock,
  getWorkspaceMembershipDoc: getWorkspaceMembershipDocMock,
  listActiveTeamUsers: listActiveTeamUsersMock,
  listActiveWorkspaceUsers: listActiveWorkspaceUsersMock,
  listAttachmentsByTargets: listAttachmentsByTargetsMock,
  listCallsByConversations: listCallsByConversationsMock,
  listChannelPostCommentsByPosts: listChannelPostCommentsByPostsMock,
  listChannelPostsByConversations: listChannelPostsByConversationsMock,
  listChatMessagesByConversations: listChatMessagesByConversationsMock,
  listCommentsByTargets: listCommentsByTargetsMock,
  listConversationsByScope: listConversationsByScopeMock,
  listDocumentPresenceByDocuments: listDocumentPresenceByDocumentsMock,
  listMilestonesByProjects: listMilestonesByProjectsMock,
  listNotificationsByEntities: listNotificationsByEntitiesMock,
  listProjectsByScope: listProjectsByScopeMock,
  listProjectUpdatesByProjects: listProjectUpdatesByProjectsMock,
  listTeamMembershipsByTeams: listTeamMembershipsByTeamsMock,
  listTeamsByIds: listTeamsByIdsMock,
  listUsersByIds: listUsersByIdsMock,
  listViewsByScope: listViewsByScopeMock,
  listWorkspaceMembershipsByUser: listWorkspaceMembershipsByUserMock,
  listWorkspaceDocuments: listWorkspaceDocumentsMock,
  listWorkspaceMembershipsByWorkspace: listWorkspaceMembershipsByWorkspaceMock,
  listWorkspacesByIds: listWorkspacesByIdsMock,
  listWorkspacesOwnedByUser: listWorkspacesOwnedByUserMock,
  listWorkspaceTeams: listWorkspaceTeamsMock,
}))

vi.mock("@/convex/app/collaboration_utils", () => ({
  createNotification: createNotificationMock,
}))

vi.mock("@/convex/app/audit", () => ({
  insertAuditEvent: insertAuditEventMock,
}))

vi.mock("@/convex/app/email_job_handlers", () => ({
  queueEmailJobs: queueEmailJobsMock,
}))

vi.mock("@/convex/app/lifecycle", () => ({
  applyWorkspaceAccessRemovalPolicy: applyWorkspaceAccessRemovalPolicyMock,
  finalizeCurrentAccountDeletionPolicy: finalizeCurrentAccountDeletionPolicyMock,
}))

vi.mock("@/convex/app/conversations", () => ({
  syncTeamConversationMemberships: syncTeamConversationMembershipsMock,
}))

function createCtx() {
  return {
    db: {
      insert: vi.fn(),
      delete: vi.fn(),
      query: vi.fn(),
    },
  }
}

describe("workspace and team deletion handlers", () => {
  beforeEach(() => {
    buildAccessChangeEmailJobsMock.mockReset()
    requireTeamAdminAccessMock.mockReset()
    requireWorkspaceOwnerAccessMock.mockReset()
    cascadeDeleteTeamDataMock.mockReset()
    cleanupRemainingLinksAfterDeleteMock.mockReset()
    cleanupUnusedLabelsMock.mockReset()
    cleanupUserAppStatesForDeletedWorkspaceMock.mockReset()
    cleanupViewFiltersForDeletedEntitiesMock.mockReset()
    deleteDocsMock.mockReset()
    deleteStorageObjectsMock.mockReset()
    assertServerTokenMock.mockReset()
    getTeamDocMock.mockReset()
    getUserDocMock.mockReset()
    getWorkspaceDocMock.mockReset()
    getWorkspaceMembershipDocMock.mockReset()
    listActiveTeamUsersMock.mockReset()
    listActiveWorkspaceUsersMock.mockReset()
    listAttachmentsByTargetsMock.mockReset()
    listCallsByConversationsMock.mockReset()
    listChannelPostCommentsByPostsMock.mockReset()
    listChannelPostsByConversationsMock.mockReset()
    listChatMessagesByConversationsMock.mockReset()
    listCommentsByTargetsMock.mockReset()
    listConversationsByScopeMock.mockReset()
    listDocumentPresenceByDocumentsMock.mockReset()
    listMilestonesByProjectsMock.mockReset()
    listNotificationsByEntitiesMock.mockReset()
    listProjectsByScopeMock.mockReset()
    listProjectUpdatesByProjectsMock.mockReset()
    listTeamMembershipsByTeamsMock.mockReset()
    listTeamsByIdsMock.mockReset()
    listUsersByIdsMock.mockReset()
    listViewsByScopeMock.mockReset()
    listWorkspaceMembershipsByUserMock.mockReset()
    listWorkspaceDocumentsMock.mockReset()
    listWorkspaceMembershipsByWorkspaceMock.mockReset()
    listWorkspacesByIdsMock.mockReset()
    listWorkspacesOwnedByUserMock.mockReset()
    listWorkspaceTeamsMock.mockReset()
    createNotificationMock.mockReset()
    insertAuditEventMock.mockReset()
    queueEmailJobsMock.mockReset()
    applyWorkspaceAccessRemovalPolicyMock.mockReset()
    finalizeCurrentAccountDeletionPolicyMock.mockReset()
    syncTeamConversationMembershipsMock.mockReset()

    buildAccessChangeEmailJobsMock.mockImplementation(({ emails }) => emails)
    createNotificationMock.mockImplementation(
      (
        userId: string,
        actorId: string,
        message: string,
        entityType: string,
        entityId: string,
        type: string
      ) => ({
        id: `notification_${userId}`,
        userId,
        actorId,
        message,
        entityType,
        entityId,
        type,
      })
    )
    cleanupUnusedLabelsMock.mockResolvedValue(["label_1"])
    listAttachmentsByTargetsMock.mockResolvedValue([])
    listCallsByConversationsMock.mockResolvedValue([])
    listChannelPostCommentsByPostsMock.mockResolvedValue([])
    listChannelPostsByConversationsMock.mockResolvedValue([])
    listChatMessagesByConversationsMock.mockResolvedValue([])
    listCommentsByTargetsMock.mockResolvedValue([])
    listConversationsByScopeMock.mockResolvedValue([])
    listDocumentPresenceByDocumentsMock.mockResolvedValue([])
    listMilestonesByProjectsMock.mockResolvedValue([])
    listNotificationsByEntitiesMock.mockResolvedValue([])
    listProjectsByScopeMock.mockResolvedValue([])
    listProjectUpdatesByProjectsMock.mockResolvedValue([])
    listViewsByScopeMock.mockResolvedValue([])
    listWorkspaceMembershipsByUserMock.mockResolvedValue([])
    listWorkspaceDocumentsMock.mockResolvedValue([])
    listWorkspaceMembershipsByWorkspaceMock.mockResolvedValue([])
    listTeamMembershipsByTeamsMock.mockResolvedValue([])
    listTeamsByIdsMock.mockResolvedValue([])
    listUsersByIdsMock.mockResolvedValue([])
    listWorkspacesByIdsMock.mockResolvedValue([])
    listWorkspacesOwnedByUserMock.mockResolvedValue([])
    deleteDocsMock.mockResolvedValue(undefined)
    deleteStorageObjectsMock.mockResolvedValue(undefined)
    cleanupRemainingLinksAfterDeleteMock.mockResolvedValue(undefined)
    cleanupViewFiltersForDeletedEntitiesMock.mockResolvedValue(undefined)
    cleanupUserAppStatesForDeletedWorkspaceMock.mockResolvedValue(undefined)
    queueEmailJobsMock.mockResolvedValue(undefined)
    insertAuditEventMock.mockResolvedValue(undefined)
    applyWorkspaceAccessRemovalPolicyMock.mockResolvedValue({
      providerMembershipCleanup: null,
    })
    finalizeCurrentAccountDeletionPolicyMock.mockResolvedValue({
      deletedPrivateDocumentIds: [],
      providerMemberships: [],
      removedWorkspaceIds: [],
    })
    syncTeamConversationMembershipsMock.mockResolvedValue(undefined)
  })

  it("notifies all active team members via inbox and email before deleting the team", async () => {
    const { deleteTeamHandler } = await import(
      "@/convex/app/workspace_team_handlers"
    )
    const ctx = createCtx()

    getTeamDocMock.mockResolvedValue({
      id: "team_1",
      workspaceId: "workspace_1",
      name: "Launch",
    })
    getUserDocMock.mockResolvedValue({
      id: "user_1",
      name: "Alex",
    })
    listActiveTeamUsersMock.mockResolvedValue([
      {
        id: "user_1",
        email: "alex@example.com",
      },
      {
        id: "user_2",
        email: "jamie@example.com",
      },
    ])
    cascadeDeleteTeamDataMock.mockResolvedValue({
      teamId: "team_1",
      workspaceId: "workspace_1",
      deletedLabelIds: [],
      deletedUserIds: [],
    })

    const result = await deleteTeamHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      teamId: "team_1",
    })

    expect(assertServerTokenMock).toHaveBeenCalledWith("server_token")
    expect(requireTeamAdminAccessMock).toHaveBeenCalledWith(
      ctx,
      "team_1",
      "user_1",
      "Only team admins can delete the team"
    )
    expect(ctx.db.insert).toHaveBeenCalledTimes(2)
    expect(createNotificationMock).toHaveBeenCalledWith(
      "user_1",
      "user_1",
      "Alex deleted Launch. The team space is no longer available.",
      "team",
      "team_1",
      "status-change"
    )
    expect(createNotificationMock).toHaveBeenCalledWith(
      "user_2",
      "user_1",
      "Alex deleted Launch. The team space is no longer available.",
      "team",
      "team_1",
      "status-change"
    )
    expect(
      ctx.db.insert.mock.invocationCallOrder[0]
    ).toBeLessThan(cascadeDeleteTeamDataMock.mock.invocationCallOrder[0] ?? 0)
    expect(buildAccessChangeEmailJobsMock).toHaveBeenCalledWith({
      origin: "https://app.example.com",
      emails: [
        {
          email: "alex@example.com",
          subject: "Launch was deleted",
          eyebrow: "TEAM DELETED",
          headline: "Launch was deleted",
          body: "Alex deleted Launch. The team space is no longer available.",
        },
        {
          email: "jamie@example.com",
          subject: "Launch was deleted",
          eyebrow: "TEAM DELETED",
          headline: "Launch was deleted",
          body: "Alex deleted Launch. The team space is no longer available.",
        },
      ],
    })
    expect(queueEmailJobsMock).toHaveBeenCalledWith(ctx, [
      {
        email: "alex@example.com",
        subject: "Launch was deleted",
        eyebrow: "TEAM DELETED",
        headline: "Launch was deleted",
        body: "Alex deleted Launch. The team space is no longer available.",
      },
      {
        email: "jamie@example.com",
        subject: "Launch was deleted",
        eyebrow: "TEAM DELETED",
        headline: "Launch was deleted",
        body: "Alex deleted Launch. The team space is no longer available.",
      },
    ])
    expect(result).toEqual({
      teamId: "team_1",
      workspaceId: "workspace_1",
      deletedLabelIds: [],
      deletedUserIds: [],
    })
  })

  it("emails active workspace members without creating inbox notifications when the workspace is deleted", async () => {
    const { deleteWorkspaceHandler } = await import(
      "@/convex/app/workspace_team_handlers"
    )
    const ctx = createCtx()

    getWorkspaceDocMock.mockResolvedValue({
      _id: "workspace_1_doc",
      id: "workspace_1",
      name: "Acme",
      logoImageStorageId: null,
    })
    getUserDocMock.mockResolvedValue({
      id: "user_1",
      name: "Alex",
    })
    listActiveWorkspaceUsersMock.mockResolvedValue([
      {
        id: "user_1",
        email: "alex@example.com",
      },
      {
        id: "user_2",
        email: "jamie@example.com",
      },
    ])
    listWorkspaceTeamsMock.mockResolvedValue([
      {
        id: "team_1",
      },
      {
        id: "team_2",
      },
    ])
    cascadeDeleteTeamDataMock.mockResolvedValue({
      teamId: "team_1",
    })

    const result = await deleteWorkspaceHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      workspaceId: "workspace_1",
    })

    expect(assertServerTokenMock).toHaveBeenCalledWith("server_token")
    expect(requireWorkspaceOwnerAccessMock).toHaveBeenCalledWith(
      ctx,
      "workspace_1",
      "user_1",
      "Only the workspace owner can delete the workspace"
    )
    expect(cascadeDeleteTeamDataMock).toHaveBeenCalledTimes(2)
    expect(cascadeDeleteTeamDataMock).toHaveBeenNthCalledWith(1, ctx, {
      currentUserId: "user_1",
      teamId: "team_1",
      syncWorkspaceChannel: false,
      cleanupGlobalState: false,
    })
    expect(cascadeDeleteTeamDataMock).toHaveBeenNthCalledWith(2, ctx, {
      currentUserId: "user_1",
      teamId: "team_2",
      syncWorkspaceChannel: false,
      cleanupGlobalState: false,
    })
    expect(ctx.db.insert).not.toHaveBeenCalled()
    expect(buildAccessChangeEmailJobsMock).toHaveBeenCalledWith({
      origin: "https://app.example.com",
      emails: [
        {
          email: "alex@example.com",
          subject: "Acme was deleted",
          eyebrow: "WORKSPACE DELETED",
          headline: "Acme was deleted",
          body: "Alex deleted the Acme workspace. It is no longer available.",
        },
        {
          email: "jamie@example.com",
          subject: "Acme was deleted",
          eyebrow: "WORKSPACE DELETED",
          headline: "Acme was deleted",
          body: "Alex deleted the Acme workspace. It is no longer available.",
        },
      ],
    })
    expect(queueEmailJobsMock).toHaveBeenCalledWith(ctx, [
      {
        email: "alex@example.com",
        subject: "Acme was deleted",
        eyebrow: "WORKSPACE DELETED",
        headline: "Acme was deleted",
        body: "Alex deleted the Acme workspace. It is no longer available.",
      },
      {
        email: "jamie@example.com",
        subject: "Acme was deleted",
        eyebrow: "WORKSPACE DELETED",
        headline: "Acme was deleted",
        body: "Alex deleted the Acme workspace. It is no longer available.",
      },
    ])
    expect(ctx.db.delete).toHaveBeenCalledWith("workspace_1_doc")
    expect(insertAuditEventMock).toHaveBeenCalledWith(ctx, {
      type: "workspace.deleted",
      actorUserId: "user_1",
      workspaceId: "workspace_1",
      entityId: "workspace_1",
      summary: "Workspace Acme was deleted.",
      details: {
        removedTeamIds: ["team_1", "team_2"],
        source: "convex",
      },
    })
    expect(result).toEqual({
      workspaceId: "workspace_1",
      deletedTeamIds: ["team_1", "team_2"],
      deletedLabelIds: ["label_1"],
      deletedUserIds: [],
      providerMemberships: [],
    })
  })

  it("includes inactive workspace users in provider cleanup when deleting a workspace", async () => {
    const { deleteWorkspaceHandler } = await import(
      "@/convex/app/workspace_team_handlers"
    )
    const ctx = createCtx()

    getWorkspaceDocMock.mockResolvedValue({
      _id: "workspace_1_doc",
      id: "workspace_1",
      name: "Acme",
      createdBy: "user_1",
      workosOrganizationId: "org_1",
      logoImageStorageId: null,
    })
    getUserDocMock.mockResolvedValue({
      id: "user_1",
      name: "Alex",
    })
    listActiveWorkspaceUsersMock.mockResolvedValue([
      {
        id: "user_1",
        email: "alex@example.com",
      },
    ])
    listWorkspaceTeamsMock.mockResolvedValue([
      {
        id: "team_1",
      },
    ])
    listWorkspaceMembershipsByWorkspaceMock.mockResolvedValue([
      {
        workspaceId: "workspace_1",
        userId: "user_deleted",
        role: "viewer",
      },
    ])
    listTeamMembershipsByTeamsMock.mockResolvedValue([
      {
        teamId: "team_1",
        userId: "user_active",
        role: "member",
      },
    ])
    listUsersByIdsMock.mockResolvedValue([
      {
        id: "user_1",
        workosUserId: "workos_owner",
      },
      {
        id: "user_active",
        workosUserId: "workos_active",
      },
      {
        id: "user_deleted",
        workosUserId: "workos_deleted",
      },
    ])
    cascadeDeleteTeamDataMock.mockResolvedValue({
      teamId: "team_1",
    })

    const result = await deleteWorkspaceHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
      workspaceId: "workspace_1",
    })

    expect(result.providerMemberships).toEqual([
      {
        workspaceId: "workspace_1",
        organizationId: "org_1",
        workosUserId: "workos_owner",
      },
      {
        workspaceId: "workspace_1",
        organizationId: "org_1",
        workosUserId: "workos_active",
      },
      {
        workspaceId: "workspace_1",
        organizationId: "org_1",
        workosUserId: "workos_deleted",
      },
    ])
  })
})

describe("workspace member protection", () => {
  beforeEach(() => {
    getWorkspaceDocMock.mockResolvedValue({
      id: "workspace_1",
      createdBy: "user_owner",
      name: "Acme",
    })
    getWorkspaceMembershipDocMock.mockResolvedValue(null)
    listWorkspaceTeamsMock.mockResolvedValue([
      {
        id: "team_1",
      },
    ])
  })

  it("blocks removing users who are admins on workspace teams", async () => {
    const { removeWorkspaceUserHandler } = await import(
      "@/convex/app/workspace_team_handlers"
    )
    const ctx = createCtx()
    const collectMock = vi.fn().mockResolvedValue([
      {
        teamId: "team_1",
        userId: "user_admin",
        role: "admin",
      },
    ])

    ctx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: collectMock,
      }),
    })

    await expect(
      removeWorkspaceUserHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_owner",
        origin: "https://app.example.com",
        workspaceId: "workspace_1",
        userId: "user_admin",
      })
    ).rejects.toThrow("Workspace admins can't be removed from the workspace")
  })
})

describe("account deletion lifecycle", () => {
  it("removes direct workspace memberships before finalizing account deletion", async () => {
    const { deleteCurrentAccountHandler } = await import(
      "@/convex/app/workspace_team_handlers"
    )
    const ctx = createCtx()
    const collectMock = vi.fn().mockResolvedValue([
      {
        _id: "team_membership_1",
        teamId: "team_1",
        userId: "user_1",
        role: "member",
      },
    ])

    ctx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: collectMock,
      }),
    })
    getUserDocMock.mockResolvedValue({
      _id: "user_1_doc",
      id: "user_1",
      name: "Alex",
      workosUserId: "workos_1",
      accountDeletedAt: null,
    })
    listWorkspaceMembershipsByUserMock.mockResolvedValue([
      {
        _id: "workspace_membership_1",
        workspaceId: "workspace_1",
        userId: "user_1",
        role: "viewer",
      },
      {
        _id: "workspace_membership_2",
        workspaceId: "workspace_2",
        userId: "user_1",
        role: "viewer",
      },
    ])
    listTeamsByIdsMock.mockResolvedValue([
      {
        id: "team_1",
        workspaceId: "workspace_1",
        name: "Core",
      },
    ])
    listWorkspacesByIdsMock.mockResolvedValue([
      {
        id: "workspace_1",
        name: "Acme",
      },
      {
        id: "workspace_2",
        name: "Umbra",
      },
    ])
    finalizeCurrentAccountDeletionPolicyMock.mockResolvedValue({
      deletedPrivateDocumentIds: [],
      providerMemberships: [],
      removedWorkspaceIds: ["workspace_1", "workspace_2"],
    })

    const result = await deleteCurrentAccountHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
    })

    expect(ctx.db.delete).toHaveBeenCalledWith("team_membership_1")
    expect(ctx.db.delete).toHaveBeenCalledWith("workspace_membership_1")
    expect(ctx.db.delete).toHaveBeenCalledWith("workspace_membership_2")
    expect(finalizeCurrentAccountDeletionPolicyMock).toHaveBeenCalledWith(
      ctx,
      {
        currentUserId: "user_1",
        user: expect.objectContaining({
          id: "user_1",
          workosUserId: "workos_1",
        }),
        removedTeamIdsByWorkspace: {
          workspace_1: ["team_1"],
          workspace_2: [],
        },
      }
    )
    expect(result).toEqual({
      userId: "user_1",
      deletedPrivateDocumentIds: [],
      removedWorkspaceIds: ["workspace_1", "workspace_2"],
      providerMemberships: [],
      emailJobs: [],
    })
  })
})
