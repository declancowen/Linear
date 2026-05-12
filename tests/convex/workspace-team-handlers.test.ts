import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"
import { createTestNotificationRecord } from "@/tests/lib/fixtures/convex"

const buildAccessChangeEmailJobsMock = vi.fn()
const requireEditableWorkspaceAccessMock = vi.fn()
const requireTeamAdminAccessMock = vi.fn()
const requireWorkspaceOwnerAccessMock = vi.fn()
const cascadeDeleteTeamDataMock = vi.fn()
const cleanupRemainingLinksAfterDeleteMock = vi.fn()
const cleanupUnusedLabelsMock = vi.fn()
const cleanupUserAppStatesForDeletedWorkspaceMock = vi.fn()
const cleanupViewFiltersForDeletedEntitiesMock = vi.fn()
const createDeletedEntityNotificationTargetsMock = vi.fn()
const deleteDocGroupsMock = vi.fn()
const deleteDocsMock = vi.fn()
const deleteStorageObjectsMock = vi.fn()
const listConversationCascadeDeleteTargetsMock = vi.fn()
const listScopedConversationCascadeDeleteTargetsMock = vi.fn()
const listProjectCascadeDeleteTargetsMock = vi.fn()
const assertServerTokenMock = vi.fn()
const getTeamByJoinCodeMock = vi.fn()
const getTeamDocMock = vi.fn()
const getTeamMembershipDocMock = vi.fn()
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
const listLabelsByWorkspaceMock = vi.fn()
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
const syncWorkspaceMembershipRoleFromTeamsMock = vi.fn()
const createNotificationMock = vi.fn()
const insertAuditEventMock = vi.fn()
const queueEmailJobsMock = vi.fn()
const applyWorkspaceAccessRemovalPolicyMock = vi.fn()
const finalizeCurrentAccountDeletionPolicyMock = vi.fn()
const ensureTeamChannelConversationMock = vi.fn()
const ensureTeamChatConversationMock = vi.fn()
const syncTeamConversationMembershipsMock = vi.fn()
const syncWorkspaceChannelMembershipsMock = vi.fn()
const getTeamSurfaceDisableMessageMock = vi.fn()
const ensureTeamProjectViewsMock = vi.fn()
const ensureTeamWorkViewsMock = vi.fn()
const ensureWorkspaceProjectViewsMock = vi.fn()

vi.mock("@/lib/email/builders", () => ({
  buildAccessChangeEmailJobs: buildAccessChangeEmailJobsMock,
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableWorkspaceAccess: requireEditableWorkspaceAccessMock,
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
  createDeletedEntityNotificationTargets: createDeletedEntityNotificationTargetsMock,
  deleteDocGroups: deleteDocGroupsMock,
  deleteDocs: deleteDocsMock,
  deleteStorageObjects: deleteStorageObjectsMock,
  listConversationCascadeDeleteTargets: listConversationCascadeDeleteTargetsMock,
  listScopedConversationCascadeDeleteTargets:
    listScopedConversationCascadeDeleteTargetsMock,
  listProjectCascadeDeleteTargets: listProjectCascadeDeleteTargetsMock,
}))

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: (prefix: string) => `${prefix}_generated`,
  getDefaultLabelColor: () => "slate",
  normalizeJoinCode: (value: string) => value.trim().toUpperCase(),
  normalizeTeamIcon: (value: string) => value.trim() || "robot",
}))

vi.mock("@/convex/app/data", () => ({
  getTeamByJoinCode: getTeamByJoinCodeMock,
  getTeamDoc: getTeamDocMock,
  getTeamMembershipDoc: getTeamMembershipDocMock,
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
  listLabelsByWorkspace: listLabelsByWorkspaceMock,
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
  syncWorkspaceMembershipRoleFromTeams: syncWorkspaceMembershipRoleFromTeamsMock,
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
  ensureTeamChannelConversation: ensureTeamChannelConversationMock,
  ensureTeamChatConversation: ensureTeamChatConversationMock,
  syncWorkspaceChannelMemberships: syncWorkspaceChannelMembershipsMock,
  syncTeamConversationMemberships: syncTeamConversationMembershipsMock,
}))

vi.mock("@/convex/app/team_feature_guards", () => ({
  getTeamSurfaceDisableMessage: getTeamSurfaceDisableMessageMock,
}))

vi.mock("@/convex/app/work_helpers", () => ({
  ensureTeamProjectViews: ensureTeamProjectViewsMock,
  ensureTeamWorkViews: ensureTeamWorkViewsMock,
  ensureWorkspaceProjectViews: ensureWorkspaceProjectViewsMock,
}))

function createCtx() {
  return {
    db: {
      insert: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
      query: vi.fn(),
    },
  }
}

function mockNoTeamMemberships(ctx: ReturnType<typeof createCtx>) {
  ctx.db.query.mockReturnValue({
    withIndex: () => ({
      collect: vi.fn().mockResolvedValue([]),
    }),
  })
}

function mockDirectWorkspaceMemberRemoval() {
  getWorkspaceMembershipDocMock.mockResolvedValue({
    _id: "workspace_membership_1",
    workspaceId: "workspace_1",
    userId: "user_member",
    role: "viewer",
  })
  applyWorkspaceAccessRemovalPolicyMock.mockResolvedValue({
    providerMembershipCleanup: null,
  })
}

function expectWorkspaceMemberDeletedAndResynced(
  ctx: ReturnType<typeof createCtx>
) {
  expect(ctx.db.delete).toHaveBeenCalledWith("workspace_membership_1")
  expect(syncTeamConversationMembershipsMock).not.toHaveBeenCalled()
  expect(syncWorkspaceChannelMembershipsMock).toHaveBeenCalledWith(
    ctx,
    "workspace_1"
  )
}

describe("workspace and team deletion handlers", () => {
  beforeEach(() => {
    buildAccessChangeEmailJobsMock.mockReset()
    requireEditableWorkspaceAccessMock.mockReset()
    requireTeamAdminAccessMock.mockReset()
    requireWorkspaceOwnerAccessMock.mockReset()
    cascadeDeleteTeamDataMock.mockReset()
    cleanupRemainingLinksAfterDeleteMock.mockReset()
    cleanupUnusedLabelsMock.mockReset()
    cleanupUserAppStatesForDeletedWorkspaceMock.mockReset()
    cleanupViewFiltersForDeletedEntitiesMock.mockReset()
    createDeletedEntityNotificationTargetsMock.mockReset()
    deleteDocGroupsMock.mockReset()
    deleteDocsMock.mockReset()
    deleteStorageObjectsMock.mockReset()
    listConversationCascadeDeleteTargetsMock.mockReset()
    listScopedConversationCascadeDeleteTargetsMock.mockReset()
    listProjectCascadeDeleteTargetsMock.mockReset()
    assertServerTokenMock.mockReset()
    getTeamByJoinCodeMock.mockReset()
    getTeamDocMock.mockReset()
    getTeamMembershipDocMock.mockReset()
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
    listLabelsByWorkspaceMock.mockReset()
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
    syncWorkspaceMembershipRoleFromTeamsMock.mockReset()
    createNotificationMock.mockReset()
    insertAuditEventMock.mockReset()
    queueEmailJobsMock.mockReset()
    applyWorkspaceAccessRemovalPolicyMock.mockReset()
    finalizeCurrentAccountDeletionPolicyMock.mockReset()
    ensureTeamChannelConversationMock.mockReset()
    ensureTeamChatConversationMock.mockReset()
    syncTeamConversationMembershipsMock.mockReset()
    syncWorkspaceChannelMembershipsMock.mockReset()
    getTeamSurfaceDisableMessageMock.mockReset()
    ensureTeamProjectViewsMock.mockReset()
    ensureTeamWorkViewsMock.mockReset()
    ensureWorkspaceProjectViewsMock.mockReset()

    buildAccessChangeEmailJobsMock.mockImplementation(({ emails }) => emails)
    createNotificationMock.mockImplementation(createTestNotificationRecord)
    cleanupUnusedLabelsMock.mockResolvedValue(["label_1"])
    listAttachmentsByTargetsMock.mockResolvedValue([])
    listCallsByConversationsMock.mockResolvedValue([])
    listChannelPostCommentsByPostsMock.mockResolvedValue([])
    listChannelPostsByConversationsMock.mockResolvedValue([])
    listChatMessagesByConversationsMock.mockResolvedValue([])
    listCommentsByTargetsMock.mockResolvedValue([])
    listConversationsByScopeMock.mockResolvedValue([])
    listDocumentPresenceByDocumentsMock.mockResolvedValue([])
    listLabelsByWorkspaceMock.mockResolvedValue([])
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
    deleteDocGroupsMock.mockImplementation(async (_ctx, ...docGroups) => {
      for (const docs of docGroups) {
        await deleteDocsMock(_ctx, docs)
      }
    })
    deleteDocsMock.mockResolvedValue(undefined)
    deleteStorageObjectsMock.mockResolvedValue(undefined)
    cleanupRemainingLinksAfterDeleteMock.mockResolvedValue(undefined)
    cleanupViewFiltersForDeletedEntitiesMock.mockResolvedValue(undefined)
    cleanupUserAppStatesForDeletedWorkspaceMock.mockResolvedValue(undefined)
    createDeletedEntityNotificationTargetsMock.mockImplementation((input) =>
      [
        ["document", input.deletedDocumentIds],
        ["project", input.deletedProjectIds],
        ["chat", input.deletedChatMessageIds],
        ["channelPost", input.deletedChannelPostIds],
      ].flatMap(([entityType, ids]) =>
        [...(ids ?? [])].map((entityId) => ({ entityId, entityType }))
      )
    )
    listConversationCascadeDeleteTargetsMock.mockImplementation(
      async (ctx, ids) => {
        const [calls, chatMessages, channelPosts] = await Promise.all([
          listCallsByConversationsMock(ctx, ids),
          listChatMessagesByConversationsMock(ctx, ids),
          listChannelPostsByConversationsMock(ctx, ids),
        ])
        const deletedChannelPostIds = new Set(
          channelPosts.map((post: { id: string }) => post.id)
        )

        return {
          calls,
          channelPostComments: await listChannelPostCommentsByPostsMock(
            ctx,
            deletedChannelPostIds
          ),
          channelPosts,
          chatMessages,
          deletedChannelPostIds,
          deletedChatMessageIds: new Set(
            chatMessages.map((message: { id: string }) => message.id)
          ),
        }
      }
    )
    listScopedConversationCascadeDeleteTargetsMock.mockImplementation(
      async (ctx, scopeType, scopeId) => {
        const conversations = await listConversationsByScopeMock(
          ctx,
          scopeType,
          scopeId
        )
        const deletedConversationIds = new Set(
          conversations.map((conversation: { id: string }) => conversation.id)
        )
        const targets = await listConversationCascadeDeleteTargetsMock(
          ctx,
          deletedConversationIds
        )

        return {
          conversations,
          deletedConversationIds,
          ...targets,
        }
      }
    )
    listProjectCascadeDeleteTargetsMock.mockImplementation(
      async (ctx, { scopeId, scopeType }) => {
        const projects = await listProjectsByScopeMock(ctx, scopeType, scopeId)
        const deletedProjectIds = new Set(
          projects.map((project: { id: string }) => project.id)
        )
        const milestones = await listMilestonesByProjectsMock(
          ctx,
          deletedProjectIds
        )

        return {
          deletedMilestoneIds: new Set(
            milestones.map((milestone: { id: string }) => milestone.id)
          ),
          deletedProjectIds,
          milestones,
          projectUpdates: await listProjectUpdatesByProjectsMock(
            ctx,
            deletedProjectIds
          ),
          projects,
        }
      }
    )
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
    ensureTeamChannelConversationMock.mockResolvedValue(undefined)
    ensureTeamChatConversationMock.mockResolvedValue(undefined)
    syncTeamConversationMembershipsMock.mockResolvedValue(undefined)
    syncWorkspaceMembershipRoleFromTeamsMock.mockResolvedValue(undefined)
    getTeamSurfaceDisableMessageMock.mockResolvedValue(null)
    getTeamByJoinCodeMock.mockResolvedValue(null)
    ensureTeamProjectViewsMock.mockResolvedValue(undefined)
    ensureTeamWorkViewsMock.mockResolvedValue(undefined)
    ensureWorkspaceProjectViewsMock.mockResolvedValue(undefined)
  })

  it("creates labels idempotently within editable workspace ownership", async () => {
    const { createLabelHandler } = await import(
      "@/convex/app/workspace_team_handlers"
    )
    const ctx = createCtx()
    const existingLabel = {
      id: "label_existing",
      workspaceId: "workspace_1",
      name: "Bug",
      color: "red",
    }

    getUserDocMock.mockResolvedValue({ id: "user_1" })
    getWorkspaceDocMock.mockResolvedValue({ id: "workspace_1" })
    listLabelsByWorkspaceMock.mockResolvedValueOnce([existingLabel])

    await expect(
      createLabelHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        workspaceId: "workspace_1",
        name: " bug ",
      })
    ).resolves.toBe(existingLabel)

    listLabelsByWorkspaceMock.mockResolvedValueOnce([])

    await expect(
      createLabelHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        workspaceId: "workspace_1",
        name: "Feature",
        color: "  blue  ",
      })
    ).resolves.toEqual({
      id: "label_generated",
      workspaceId: "workspace_1",
      name: "Feature",
      color: "blue",
    })
    expect(requireEditableWorkspaceAccessMock).toHaveBeenCalledWith(
      ctx,
      "workspace_1",
      "user_1"
    )
    expect(ctx.db.insert).toHaveBeenCalledWith("labels", {
      id: "label_generated",
      workspaceId: "workspace_1",
      name: "Feature",
      color: "blue",
    })
  })

  it("updates team details and ensures enabled collaboration/work views", async () => {
    const { updateTeamDetailsHandler } = await import(
      "@/convex/app/workspace_team_handlers"
    )
    const ctx = createCtx()
    const features = {
      ...createDefaultTeamFeatureSettings("software-development"),
      chat: true,
      channels: true,
    }
    const team = {
      _id: "team_doc_1",
      id: "team_1",
      workspaceId: "workspace_1",
      name: "Platform",
      settings: {
        joinCode: "JOIN1234",
        summary: "Platform",
        experience: "software-development",
        features: createDefaultTeamFeatureSettings("software-development"),
        workflow: createDefaultTeamWorkflowSettings("software-development"),
      },
    }

    getTeamDocMock.mockResolvedValue(team)

    await expect(
      updateTeamDetailsHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        teamId: "team_1",
        name: "Platform Core",
        icon: " robot ",
        summary: "Core team",
        joinCode: " join9999 ",
        experience: "software-development",
        features,
      })
    ).resolves.toMatchObject({
      teamId: "team_1",
      workspaceId: "workspace_1",
      joinCode: "JOIN9999",
      features,
    })

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "team_doc_1",
      expect.objectContaining({
        name: "Platform Core",
        icon: "robot",
        joinCodeNormalized: "JOIN9999",
      })
    )
    expect(ensureTeamChatConversationMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ teamId: "team_1" })
    )
    expect(ensureTeamChannelConversationMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ teamId: "team_1" })
    )
    expect(ensureTeamWorkViewsMock).toHaveBeenCalledWith(ctx, team)
    expect(ensureTeamProjectViewsMock).toHaveBeenCalledWith(ctx, team)
  })

  it("updates and removes team members through the team membership owner", async () => {
    const { removeTeamMemberHandler, updateTeamMemberRoleHandler } =
      await import("@/convex/app/workspace_team_handlers")
    const ctx = createCtx()
    const team = {
      id: "team_1",
      workspaceId: "workspace_1",
      name: "Platform",
    }
    const membership = {
      _id: "membership_doc_1",
      teamId: "team_1",
      userId: "user_2",
      role: "member",
    }

    getTeamDocMock.mockResolvedValue(team)
    getTeamMembershipDocMock.mockResolvedValue(membership)
    getWorkspaceDocMock.mockResolvedValue({
      id: "workspace_1",
      name: "Acme",
    })
    getUserDocMock.mockImplementation(async (_ctx, userId) => {
      if (userId === "user_2") {
        return {
          id: "user_2",
          name: "Sam",
          email: "sam@example.com",
          workosUserId: "workos_user_2",
        }
      }

      return {
        id: userId,
        name: "Alex",
        email: "alex@example.com",
      }
    })
    ctx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: vi.fn().mockResolvedValue([
          {
            teamId: "team_1",
            userId: "admin_1",
            role: "admin",
          },
        ]),
      }),
    })

    await expect(
      updateTeamMemberRoleHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        teamId: "team_1",
        userId: "user_2",
        role: "admin",
      })
    ).resolves.toMatchObject({
      teamId: "team_1",
      workspaceId: "workspace_1",
      userId: "user_2",
      role: "admin",
    })
    expect(ctx.db.patch).toHaveBeenCalledWith("membership_doc_1", {
      role: "admin",
    })
    expect(syncWorkspaceMembershipRoleFromTeamsMock).toHaveBeenCalledWith(ctx, {
      workspaceId: "workspace_1",
      userId: "user_2",
      fallbackRole: "viewer",
    })

    await expect(
      removeTeamMemberHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        teamId: "team_1",
        userId: "user_2",
        origin: "https://app.example.com",
      })
    ).resolves.toMatchObject({
      teamId: "team_1",
      workspaceId: "workspace_1",
      userId: "user_2",
      removedUserEmail: "sam@example.com",
      removedUserName: "Sam",
      providerMemberships: [],
    })
    expect(ctx.db.delete).toHaveBeenCalledWith("membership_doc_1")
    expect(syncTeamConversationMembershipsMock).toHaveBeenCalledWith(
      ctx,
      "team_1"
    )
    expect(insertAuditEventMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        type: "membership.removed_from_team",
        subjectUserId: "user_2",
      })
    )
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

  it("resyncs the workspace channel when removing a direct workspace member with no team memberships", async () => {
    const { removeWorkspaceUserHandler } = await import(
      "@/convex/app/workspace_team_handlers"
    )
    const ctx = createCtx()

    mockNoTeamMemberships(ctx)
    mockDirectWorkspaceMemberRemoval()
    getUserDocMock.mockImplementation(async (_ctx, userId: string) => {
      if (userId === "user_member") {
        return {
          id: "user_member",
          name: "Sam",
          email: "sam@example.com",
          workosUserId: "workos_member",
        }
      }

      return {
        id: "user_owner",
        name: "Alex",
        email: "alex@example.com",
        workosUserId: "workos_owner",
      }
    })

    await removeWorkspaceUserHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_owner",
      origin: "https://app.example.com",
      workspaceId: "workspace_1",
      userId: "user_member",
    })

    expectWorkspaceMemberDeletedAndResynced(ctx)
  })

  it("resyncs the workspace channel when a direct workspace member leaves with no team memberships", async () => {
    const { leaveWorkspaceHandler } = await import(
      "@/convex/app/workspace_team_handlers"
    )
    const ctx = createCtx()

    mockNoTeamMemberships(ctx)
    mockDirectWorkspaceMemberRemoval()
    getUserDocMock.mockResolvedValue({
      id: "user_member",
      name: "Sam",
      email: "sam@example.com",
      workosUserId: "workos_member",
    })

    await leaveWorkspaceHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_member",
      origin: "https://app.example.com",
      workspaceId: "workspace_1",
    })

    expectWorkspaceMemberDeletedAndResynced(ctx)
  })
})

describe("account deletion lifecycle", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    getUserDocMock.mockReset()
    listTeamsByIdsMock.mockReset()
    listWorkspaceMembershipsByUserMock.mockReset()
    listWorkspacesByIdsMock.mockReset()
    finalizeCurrentAccountDeletionPolicyMock.mockReset()
    syncTeamConversationMembershipsMock.mockReset()
    syncWorkspaceChannelMembershipsMock.mockReset()

    assertServerTokenMock.mockImplementation(() => {})
    listTeamsByIdsMock.mockResolvedValue([])
    listWorkspaceMembershipsByUserMock.mockResolvedValue([])
    listWorkspacesByIdsMock.mockResolvedValue([])
    finalizeCurrentAccountDeletionPolicyMock.mockResolvedValue({
      deletedPrivateDocumentIds: [],
      providerMemberships: [],
      removedWorkspaceIds: [],
    })
    syncTeamConversationMembershipsMock.mockResolvedValue(undefined)
    syncWorkspaceChannelMembershipsMock.mockResolvedValue(undefined)
  })

  function createAccountDeletionCtx(teamMemberships: unknown[] = []) {
    const ctx = createCtx()

    ctx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: vi.fn().mockResolvedValue(teamMemberships),
      }),
    })
    getUserDocMock.mockResolvedValue({
      _id: "user_1_doc",
      id: "user_1",
      name: "Alex",
      workosUserId: "workos_1",
      accountDeletedAt: null,
    })

    return ctx
  }

  function mockAccountWorkspaceMemberships(role: "admin" | "viewer") {
    listWorkspaceMembershipsByUserMock.mockResolvedValue([
      {
        _id: "workspace_membership_1",
        workspaceId: "workspace_1",
        userId: "user_1",
        role,
      },
    ])
  }

  async function deleteCurrentAccount(ctx: ReturnType<typeof createCtx>) {
    const { deleteCurrentAccountHandler } = await import(
      "@/convex/app/workspace_team_handlers"
    )

    return deleteCurrentAccountHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://app.example.com",
    })
  }

  it("blocks deleting an account while the user is a direct workspace admin", async () => {
    const ctx = createAccountDeletionCtx()
    mockAccountWorkspaceMemberships("admin")

    await expect(deleteCurrentAccount(ctx)).rejects.toThrow(
      "Leave or transfer your workspace admin access before deleting your account"
    )
  })

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

  it("resyncs workspace channels for direct-membership-only workspaces during account deletion", async () => {
    const ctx = createAccountDeletionCtx()

    mockAccountWorkspaceMemberships("viewer")
    listTeamsByIdsMock.mockResolvedValue([])
    listWorkspacesByIdsMock.mockResolvedValue([
      {
        id: "workspace_1",
        name: "Acme",
      },
    ])
    finalizeCurrentAccountDeletionPolicyMock.mockResolvedValue({
      deletedPrivateDocumentIds: [],
      providerMemberships: [],
      removedWorkspaceIds: ["workspace_1"],
    })

    await deleteCurrentAccount(ctx)

    expect(syncTeamConversationMembershipsMock).not.toHaveBeenCalled()
    expect(syncWorkspaceChannelMembershipsMock).toHaveBeenCalledWith(
      ctx,
      "workspace_1"
    )
  })
})
