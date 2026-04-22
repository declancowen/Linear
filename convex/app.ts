import {
  mutation as convexMutation,
  query,
  type MutationCtx,
} from "./_generated/server"
import { v } from "convex/values"

import {
  auditEventDetailsValidator,
  auditEventOutcomeValidator,
  auditEventTypeValidator,
  attachmentTargetTypeValidator,
  commentTargetTypeValidator,
  emailJobKindValidator,
  displayPropertyValidator,
  entityKindValidator,
  groupFieldValidator,
  nullableStringValidator,
  orderingFieldValidator,
  priorityValidator,
  projectStatusValidator,
  roleValidator,
  scopeTypeValidator,
  teamExperienceTypeValidator,
  teamFeatureSettingsValidator,
  themePreferenceValidator,
  teamWorkflowSettingsValidator,
  templateTypeValidator,
  userStatusValidator,
  viewFiltersValidator,
  viewLayoutValidator,
  workItemTypeValidator,
  workStatusValidator,
} from "./validators"
import { serverAccessArgs } from "./app/core"
import { recordAuditEventHandler } from "./app/audit"
import { getOrCreateAppConfig } from "./app/data"
import {
  backfillWorkspaceMembershipsHandler,
  backfillLegacyLookupFieldsHandler,
  getLegacyLookupBackfillStatusHandler,
  getWorkspaceMembershipBackfillStatusHandler,
} from "./app/maintenance"
import {
  bootstrapAppWorkspaceHandler,
  bootstrapWorkspaceUserHandler,
  ensureUserFromAuthHandler,
  getAuthContextHandler,
  getInviteByTokenHandler,
  getSnapshotHandler,
  getSnapshotVersionHandler,
  listWorkspacesForSyncHandler,
  lookupTeamByJoinCodeHandler,
} from "./app/auth_bootstrap"
import { getCollaborationDocumentHandler } from "./app/collaboration_documents"
import {
  archiveNotificationHandler,
  claimPendingNotificationDigestsHandler,
  deleteNotificationHandler,
  listPendingNotificationDigestsHandler,
  markNotificationReadHandler,
  markNotificationsEmailedHandler,
  releaseNotificationDigestClaimHandler,
  toggleNotificationReadHandler,
  unarchiveNotificationHandler,
} from "./app/notification_handlers"
import {
  claimPendingEmailJobsHandler,
  enqueueEmailJobsHandler,
  listPendingEmailJobsHandler,
  markEmailJobsSentHandler,
  releaseEmailJobClaimHandler,
  triggerEmailJobProcessingHandler,
} from "./app/email_job_handlers"
import {
  addChannelPostCommentHandler,
  createChannelHandler,
  createChannelPostHandler,
  createWorkspaceChatHandler,
  deleteChannelPostHandler,
  ensureTeamChatHandler,
  finalizeCallJoinHandler,
  getCallJoinContextHandler,
  markCallJoinedHandler,
  sendChatMessageHandler,
  setCallRoomHandler,
  setConversationRoomHandler,
  startChatCallHandler,
  toggleChatMessageReactionHandler,
  toggleChannelPostReactionHandler,
} from "./app/collaboration_handlers"
import {
  clearDocumentPresenceHandler,
  createAttachmentHandler,
  createDocumentHandler,
  deleteAttachmentHandler,
  deleteDocumentHandler,
  generateAttachmentUploadUrlHandler,
  generateSettingsImageUploadUrlHandler,
  heartbeatDocumentPresenceHandler,
  renameDocumentHandler,
  sendDocumentMentionNotificationsHandler,
  sendItemDescriptionMentionNotificationsHandler,
  updateDocumentContentHandler,
  updateDocumentHandler,
  updateItemDescriptionHandler,
} from "./app/document_handlers"
import {
  bumpScopedReadModelVersionsHandler,
  getScopedReadModelVersionsHandler,
} from "./app/scoped_sync"
import {
  addCommentHandler,
  toggleCommentReactionHandler,
} from "./app/comment_handlers"
import {
  acceptInviteHandler,
  cancelInviteHandler,
  createInviteHandler,
  declineInviteHandler,
  joinTeamByCodeHandler,
} from "./app/invite_handlers"
import {
  createProjectHandler,
  deleteProjectHandler,
  renameProjectHandler,
  updateProjectHandler,
} from "./app/project_handlers"
import {
  clearViewFiltersHandler,
  createViewHandler,
  deleteViewHandler,
  reorderViewDisplayPropertiesHandler,
  renameViewHandler,
  toggleViewDisplayPropertyHandler,
  toggleViewFilterValueHandler,
  toggleViewHiddenValueHandler,
  updateViewConfigHandler,
} from "./app/view_handlers"
import {
  createWorkItemHandler,
  clearWorkItemPresenceHandler,
  deleteWorkItemHandler,
  heartbeatWorkItemPresenceHandler,
  shiftTimelineItemHandler,
  updateWorkItemHandler,
} from "./app/work_item_handlers"
import {
  createLabelHandler,
  createTeamHandler,
  createWorkspaceHandler,
  deleteTeamHandler,
  deleteWorkspaceHandler,
  deleteCurrentAccountHandler,
  prepareCurrentAccountDeletionHandler,
  cancelCurrentAccountDeletionHandler,
  ensureWorkspaceScaffoldingHandler,
  leaveWorkspaceHandler,
  leaveTeamHandler,
  removeTeamMemberHandler,
  removeWorkspaceUserHandler,
  regenerateTeamJoinCodeHandler,
  setWorkspaceWorkosOrganizationHandler,
  updateCurrentUserProfileHandler,
  updateTeamDetailsHandler,
  updateTeamMemberRoleHandler,
  updateTeamWorkflowSettingsHandler,
  updateWorkspaceBrandingHandler,
  validateCurrentAccountDeletionHandler,
} from "./app/workspace_team_handlers"
async function bumpSnapshotVersion(ctx: MutationCtx) {
  const config = await getOrCreateAppConfig(ctx)

  await ctx.db.patch(config._id, {
    snapshotVersion: (config.snapshotVersion ?? 0) + 1,
  })
}

// Convex's overloaded builder types are difficult to preserve through a wrapper.
// This keeps the existing runtime behavior stable while centralizing snapshot bumps.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mutation: typeof convexMutation = ((config: any) =>
  convexMutation({
    ...config,
    handler: async (ctx, args) => {
      const result = await config.handler(ctx, args)
      await bumpSnapshotVersion(ctx)
      return result
    },
  })) as typeof convexMutation

// Operational side tables must not invalidate the client snapshot model.
const operationalMutation: typeof convexMutation = convexMutation

export const bootstrapAppWorkspace = mutation({
  args: {
    ...serverAccessArgs,
    workspaceSlug: v.string(),
    workspaceName: v.string(),
    workspaceLogoUrl: v.string(),
    workspaceAccent: v.string(),
    workspaceDescription: v.string(),
    teamSlug: v.string(),
    teamName: v.string(),
    teamIcon: v.string(),
    teamSummary: v.string(),
    teamJoinCode: v.string(),
    email: v.string(),
    userName: v.string(),
    avatarUrl: v.string(),
    workosUserId: v.string(),
    teamExperience: v.optional(teamExperienceTypeValidator),
    role: v.optional(roleValidator),
  },
  handler: bootstrapAppWorkspaceHandler,
})

export const logAuditEvent = operationalMutation({
  args: {
    ...serverAccessArgs,
    type: auditEventTypeValidator,
    outcome: auditEventOutcomeValidator,
    actorUserId: nullableStringValidator,
    subjectUserId: nullableStringValidator,
    workspaceId: nullableStringValidator,
    teamId: nullableStringValidator,
    entityId: nullableStringValidator,
    summary: v.string(),
    details: auditEventDetailsValidator,
  },
  handler: recordAuditEventHandler,
})

export const getLegacyLookupBackfillStatus = query({
  args: {
    ...serverAccessArgs,
  },
  handler: getLegacyLookupBackfillStatusHandler,
})

export const backfillLegacyLookupFields = operationalMutation({
  args: {
    ...serverAccessArgs,
    limit: v.optional(v.number()),
  },
  handler: backfillLegacyLookupFieldsHandler,
})

export const getWorkspaceMembershipBackfillStatus = query({
  args: {
    ...serverAccessArgs,
  },
  handler: getWorkspaceMembershipBackfillStatusHandler,
})

export const backfillWorkspaceMemberships = operationalMutation({
  args: {
    ...serverAccessArgs,
    limit: v.optional(v.number()),
  },
  handler: backfillWorkspaceMembershipsHandler,
})

export const bumpScopedReadModelVersions = operationalMutation({
  args: {
    ...serverAccessArgs,
    scopeKeys: v.array(v.string()),
  },
  handler: bumpScopedReadModelVersionsHandler,
})

export const getSnapshot = query({
  args: {
    ...serverAccessArgs,
    workosUserId: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: getSnapshotHandler,
})

export const getSnapshotVersion = query({
  args: {
    ...serverAccessArgs,
    workosUserId: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: getSnapshotVersionHandler,
})

export const getScopedReadModelVersions = query({
  args: {
    ...serverAccessArgs,
    scopeKeys: v.array(v.string()),
  },
  handler: getScopedReadModelVersionsHandler,
})

export const getCollaborationDocument = query({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    documentId: v.string(),
  },
  handler: getCollaborationDocumentHandler,
})

export const getAuthContext = query({
  args: {
    ...serverAccessArgs,
    workosUserId: v.string(),
    email: v.optional(v.string()),
  },
  handler: getAuthContextHandler,
})

export const ensureUserFromAuth = mutation({
  args: {
    ...serverAccessArgs,
    email: v.string(),
    name: v.string(),
    avatarUrl: v.string(),
    workosUserId: v.string(),
  },
  handler: ensureUserFromAuthHandler,
})

export const bootstrapWorkspaceUser = mutation({
  args: {
    ...serverAccessArgs,
    workspaceSlug: v.string(),
    teamSlug: v.string(),
    existingUserId: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.string(),
    workosUserId: v.string(),
    role: v.optional(roleValidator),
  },
  handler: bootstrapWorkspaceUserHandler,
})

export const getInviteByToken = query({
  args: {
    ...serverAccessArgs,
    token: v.string(),
  },
  handler: getInviteByTokenHandler,
})

export const lookupTeamByJoinCode = query({
  args: {
    ...serverAccessArgs,
    code: v.string(),
  },
  handler: lookupTeamByJoinCodeHandler,
})

export const listWorkspacesForSync = query({
  args: serverAccessArgs,
  handler: listWorkspacesForSyncHandler,
})

export const listPendingNotificationDigests = query({
  args: serverAccessArgs,
  handler: listPendingNotificationDigestsHandler,
})

export const listPendingEmailJobs = query({
  args: {
    ...serverAccessArgs,
    limit: v.optional(v.number()),
  },
  handler: listPendingEmailJobsHandler,
})

export const enqueueEmailJobs = operationalMutation({
  args: {
    ...serverAccessArgs,
    jobs: v.array(
      v.object({
        kind: emailJobKindValidator,
        notificationId: v.optional(v.string()),
        toEmail: v.string(),
        subject: v.string(),
        text: v.string(),
        html: v.string(),
      })
    ),
  },
  handler: enqueueEmailJobsHandler,
})

export const claimPendingEmailJobs = operationalMutation({
  args: {
    ...serverAccessArgs,
    claimId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: claimPendingEmailJobsHandler,
})

export const markEmailJobsSent = operationalMutation({
  args: {
    ...serverAccessArgs,
    claimId: v.string(),
    jobIds: v.array(v.string()),
  },
  handler: markEmailJobsSentHandler,
})

export const releaseEmailJobClaim = operationalMutation({
  args: {
    ...serverAccessArgs,
    claimId: v.string(),
    jobIds: v.array(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: releaseEmailJobClaimHandler,
})

export const triggerEmailJobProcessing = operationalMutation({
  args: {
    ...serverAccessArgs,
  },
  handler: triggerEmailJobProcessingHandler,
})

export const getCallJoinContext = query({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    callId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  handler: getCallJoinContextHandler,
})

export const claimPendingNotificationDigests = operationalMutation({
  args: {
    ...serverAccessArgs,
    claimId: v.string(),
  },
  handler: claimPendingNotificationDigestsHandler,
})

export const markNotificationRead = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    notificationId: v.string(),
  },
  handler: markNotificationReadHandler,
})

export const markNotificationsEmailed = operationalMutation({
  args: {
    ...serverAccessArgs,
    claimId: v.optional(v.string()),
    notificationIds: v.array(v.string()),
  },
  handler: markNotificationsEmailedHandler,
})

export const releaseNotificationDigestClaim = operationalMutation({
  args: {
    ...serverAccessArgs,
    claimId: v.string(),
    notificationIds: v.array(v.string()),
  },
  handler: releaseNotificationDigestClaimHandler,
})

export const finalizeCallJoin = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    callId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    roomId: v.string(),
    roomName: v.string(),
  },
  handler: finalizeCallJoinHandler,
})

export const toggleNotificationRead = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    notificationId: v.string(),
  },
  handler: toggleNotificationReadHandler,
})

export const archiveNotification = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    notificationId: v.string(),
  },
  handler: archiveNotificationHandler,
})

export const unarchiveNotification = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    notificationId: v.string(),
  },
  handler: unarchiveNotificationHandler,
})

export const deleteNotification = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    notificationId: v.string(),
  },
  handler: deleteNotificationHandler,
})

export const createWorkspace = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    name: v.string(),
    logoUrl: v.string(),
    accent: v.string(),
    description: v.string(),
  },
  handler: createWorkspaceHandler,
})

export const updateWorkspaceBranding = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    workspaceId: v.string(),
    name: v.string(),
    logoUrl: v.string(),
    logoImageStorageId: v.optional(v.id("_storage")),
    clearLogoImage: v.optional(v.boolean()),
    accent: v.string(),
    description: v.string(),
  },
  handler: updateWorkspaceBrandingHandler,
})

export const deleteWorkspace = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    origin: v.string(),
    workspaceId: v.string(),
  },
  handler: deleteWorkspaceHandler,
})

export const setWorkspaceWorkosOrganization = mutation({
  args: {
    ...serverAccessArgs,
    workspaceId: v.string(),
    workosOrganizationId: v.string(),
  },
  handler: setWorkspaceWorkosOrganizationHandler,
})

export const updateCurrentUserProfile = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    userId: v.string(),
    name: v.string(),
    title: v.string(),
    avatarUrl: v.string(),
    avatarImageStorageId: v.optional(v.id("_storage")),
    clearAvatarImage: v.optional(v.boolean()),
    clearStatus: v.optional(v.boolean()),
    status: v.optional(userStatusValidator),
    statusMessage: v.optional(v.string()),
    preferences: v.object({
      emailMentions: v.boolean(),
      emailAssignments: v.boolean(),
      emailDigest: v.boolean(),
      theme: v.optional(themePreferenceValidator),
    }),
  },
  handler: updateCurrentUserProfileHandler,
})

export const deleteCurrentAccount = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    origin: v.string(),
  },
  handler: deleteCurrentAccountHandler,
})

export const prepareCurrentAccountDeletion = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
  },
  handler: prepareCurrentAccountDeletionHandler,
})

export const cancelCurrentAccountDeletion = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
  },
  handler: cancelCurrentAccountDeletionHandler,
})

export const validateCurrentAccountDeletion = query({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
  },
  handler: validateCurrentAccountDeletionHandler,
})

export const ensureWorkspaceScaffolding = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    workspaceId: v.string(),
  },
  handler: ensureWorkspaceScaffoldingHandler,
})

export const createTeam = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    workspaceId: v.string(),
    name: v.string(),
    icon: v.string(),
    summary: v.string(),
    joinCode: v.string(),
    experience: teamExperienceTypeValidator,
    features: teamFeatureSettingsValidator,
  },
  handler: createTeamHandler,
})

export const deleteTeam = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    origin: v.string(),
    teamId: v.string(),
  },
  handler: deleteTeamHandler,
})

export const leaveTeam = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    teamId: v.string(),
    origin: v.string(),
  },
  handler: leaveTeamHandler,
})

export const leaveWorkspace = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    workspaceId: v.string(),
    origin: v.string(),
  },
  handler: leaveWorkspaceHandler,
})

export const removeTeamMember = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    teamId: v.string(),
    userId: v.string(),
    origin: v.string(),
  },
  handler: removeTeamMemberHandler,
})

export const removeWorkspaceUser = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    workspaceId: v.string(),
    userId: v.string(),
    origin: v.string(),
  },
  handler: removeWorkspaceUserHandler,
})

export const createLabel = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    workspaceId: v.string(),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: createLabelHandler,
})

export const updateTeamDetails = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    teamId: v.string(),
    name: v.string(),
    icon: v.string(),
    summary: v.string(),
    joinCode: v.optional(v.string()),
    experience: teamExperienceTypeValidator,
    features: teamFeatureSettingsValidator,
  },
  handler: updateTeamDetailsHandler,
})

export const regenerateTeamJoinCode = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    teamId: v.string(),
    joinCode: v.string(),
  },
  handler: regenerateTeamJoinCodeHandler,
})

export const updateTeamWorkflowSettings = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    teamId: v.string(),
    workflow: teamWorkflowSettingsValidator,
  },
  handler: updateTeamWorkflowSettingsHandler,
})

export const updateTeamMemberRole = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    teamId: v.string(),
    userId: v.string(),
    role: roleValidator,
  },
  handler: updateTeamMemberRoleHandler,
})

export const updateViewConfig = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    viewId: v.string(),
    layout: v.optional(
      v.union(v.literal("list"), v.literal("board"), v.literal("timeline"))
    ),
    itemLevel: v.optional(v.union(workItemTypeValidator, v.null())),
    showChildItems: v.optional(v.boolean()),
    grouping: v.optional(groupFieldValidator),
    subGrouping: v.optional(v.union(groupFieldValidator, v.null())),
    ordering: v.optional(orderingFieldValidator),
    showCompleted: v.optional(v.boolean()),
  },
  handler: updateViewConfigHandler,
})

export const createView = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    id: v.optional(v.string()),
    scopeType: v.union(v.literal("team"), v.literal("workspace")),
    scopeId: v.string(),
    entityKind: entityKindValidator,
    containerType: v.optional(v.union(v.literal("project-items"), v.null())),
    containerId: v.optional(v.union(v.string(), v.null())),
    route: v.string(),
    name: v.string(),
    description: v.string(),
    layout: v.optional(
      v.union(v.literal("list"), v.literal("board"), v.literal("timeline"))
    ),
    itemLevel: v.optional(v.union(workItemTypeValidator, v.null())),
    showChildItems: v.optional(v.boolean()),
    grouping: v.optional(groupFieldValidator),
    subGrouping: v.optional(v.union(groupFieldValidator, v.null())),
    ordering: v.optional(orderingFieldValidator),
    filters: v.optional(viewFiltersValidator),
    displayProps: v.optional(v.array(displayPropertyValidator)),
    hiddenState: v.optional(
      v.object({
        groups: v.array(v.string()),
        subgroups: v.array(v.string()),
      })
    ),
  },
  handler: createViewHandler,
})

export const renameView = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    viewId: v.string(),
    name: v.string(),
  },
  handler: renameViewHandler,
})

export const deleteView = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    viewId: v.string(),
  },
  handler: deleteViewHandler,
})

export const toggleViewDisplayProperty = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    viewId: v.string(),
    property: displayPropertyValidator,
  },
  handler: toggleViewDisplayPropertyHandler,
})

export const reorderViewDisplayProperties = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    viewId: v.string(),
    displayProps: v.array(displayPropertyValidator),
  },
  handler: reorderViewDisplayPropertiesHandler,
})

export const toggleViewHiddenValue = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    viewId: v.string(),
    key: v.union(v.literal("groups"), v.literal("subgroups")),
    value: v.string(),
  },
  handler: toggleViewHiddenValueHandler,
})

export const toggleViewFilterValue = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    viewId: v.string(),
    key: v.union(
      v.literal("status"),
      v.literal("priority"),
      v.literal("assigneeIds"),
      v.literal("creatorIds"),
      v.literal("leadIds"),
      v.literal("health"),
      v.literal("milestoneIds"),
      v.literal("relationTypes"),
      v.literal("projectIds"),
      v.literal("parentIds"),
      v.literal("itemTypes"),
      v.literal("labelIds"),
      v.literal("teamIds")
    ),
    value: v.string(),
  },
  handler: toggleViewFilterValueHandler,
})

export const clearViewFilters = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    viewId: v.string(),
  },
  handler: clearViewFiltersHandler,
})

export const updateWorkItem = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    itemId: v.string(),
    origin: v.string(),
    patch: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      expectedUpdatedAt: v.optional(v.string()),
      status: v.optional(workStatusValidator),
      priority: v.optional(priorityValidator),
      assigneeId: v.optional(nullableStringValidator),
      parentId: v.optional(nullableStringValidator),
      primaryProjectId: v.optional(nullableStringValidator),
      labelIds: v.optional(v.array(v.string())),
      startDate: v.optional(nullableStringValidator),
      dueDate: v.optional(nullableStringValidator),
      targetDate: v.optional(nullableStringValidator),
    }),
  },
  handler: updateWorkItemHandler,
})

export const deleteWorkItem = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    itemId: v.string(),
  },
  handler: deleteWorkItemHandler,
})

export const shiftTimelineItem = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    itemId: v.string(),
    nextStartDate: v.string(),
  },
  handler: shiftTimelineItemHandler,
})

export const updateDocumentContent = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    documentId: v.string(),
    content: v.string(),
    expectedUpdatedAt: v.optional(v.string()),
  },
  handler: updateDocumentContentHandler,
})

export const updateDocument = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    documentId: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    expectedUpdatedAt: v.optional(v.string()),
  },
  handler: updateDocumentHandler,
})

export const persistCollaborationDocument = operationalMutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    documentId: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    expectedUpdatedAt: v.optional(v.string()),
  },
  handler: updateDocumentHandler,
})

export const sendDocumentMentionNotifications = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    origin: v.string(),
    documentId: v.string(),
    mentions: v.array(
      v.object({
        userId: v.string(),
        count: v.number(),
      })
    ),
  },
  handler: sendDocumentMentionNotificationsHandler,
})

export const sendItemDescriptionMentionNotifications = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    origin: v.string(),
    itemId: v.string(),
    mentions: v.array(
      v.object({
        userId: v.string(),
        count: v.number(),
      })
    ),
  },
  handler: sendItemDescriptionMentionNotificationsHandler,
})

export const heartbeatDocumentPresence = convexMutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    documentId: v.string(),
    workosUserId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.string(),
    avatarImageUrl: v.optional(v.union(v.string(), v.null())),
    activeBlockId: v.optional(v.union(v.string(), v.null())),
    sessionId: v.string(),
  },
  handler: heartbeatDocumentPresenceHandler,
})

export const clearDocumentPresence = convexMutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    documentId: v.string(),
    workosUserId: v.string(),
    sessionId: v.string(),
  },
  handler: clearDocumentPresenceHandler,
})

export const heartbeatWorkItemPresence = convexMutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    itemId: v.string(),
    workosUserId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.string(),
    avatarImageUrl: v.optional(v.union(v.string(), v.null())),
    activeBlockId: v.optional(v.union(v.string(), v.null())),
    sessionId: v.string(),
  },
  handler: heartbeatWorkItemPresenceHandler,
})

export const clearWorkItemPresence = convexMutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    itemId: v.string(),
    workosUserId: v.string(),
    sessionId: v.string(),
  },
  handler: clearWorkItemPresenceHandler,
})

export const renameDocument = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    documentId: v.string(),
    title: v.string(),
  },
  handler: renameDocumentHandler,
})

export const deleteDocument = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    documentId: v.string(),
  },
  handler: deleteDocumentHandler,
})

export const updateItemDescription = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    itemId: v.string(),
    content: v.string(),
    expectedUpdatedAt: v.optional(v.string()),
  },
  handler: updateItemDescriptionHandler,
})

export const persistCollaborationItemDescription = operationalMutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    itemId: v.string(),
    content: v.string(),
    expectedUpdatedAt: v.optional(v.string()),
  },
  handler: updateItemDescriptionHandler,
})

export const generateAttachmentUploadUrl = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    targetType: attachmentTargetTypeValidator,
    targetId: v.string(),
  },
  handler: generateAttachmentUploadUrlHandler,
})

export const generateSettingsImageUploadUrl = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    kind: v.union(v.literal("user-avatar"), v.literal("workspace-logo")),
    workspaceId: v.optional(v.string()),
  },
  handler: generateSettingsImageUploadUrlHandler,
})

export const createAttachment = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    targetType: attachmentTargetTypeValidator,
    targetId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  handler: createAttachmentHandler,
})

export const deleteAttachment = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    attachmentId: v.string(),
  },
  handler: deleteAttachmentHandler,
})

export const addComment = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    origin: v.string(),
    targetType: commentTargetTypeValidator,
    targetId: v.string(),
    parentCommentId: v.optional(nullableStringValidator),
    content: v.string(),
  },
  handler: addCommentHandler,
})

export const toggleCommentReaction = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    commentId: v.string(),
    emoji: v.string(),
  },
  handler: toggleCommentReactionHandler,
})

export const createInvite = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    teamIds: v.array(v.string()),
    email: v.string(),
    role: roleValidator,
    origin: v.string(),
  },
  handler: createInviteHandler,
})

export const cancelInvite = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    inviteId: v.string(),
  },
  handler: cancelInviteHandler,
})

export const acceptInvite = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    token: v.string(),
  },
  handler: acceptInviteHandler,
})

export const declineInvite = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    token: v.string(),
  },
  handler: declineInviteHandler,
})

export const joinTeamByCode = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    code: v.string(),
  },
  handler: joinTeamByCodeHandler,
})

export const createProject = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    scopeType: scopeTypeValidator,
    scopeId: v.string(),
    templateType: templateTypeValidator,
    name: v.string(),
    summary: v.string(),
    status: v.optional(projectStatusValidator),
    priority: priorityValidator,
    leadId: v.optional(nullableStringValidator),
    memberIds: v.optional(v.array(v.string())),
    startDate: v.optional(nullableStringValidator),
    targetDate: v.optional(nullableStringValidator),
    labelIds: v.optional(v.array(v.string())),
    settingsTeamId: v.optional(nullableStringValidator),
    presentation: v.optional(
      v.object({
        itemLevel: v.optional(v.union(workItemTypeValidator, v.null())),
        showChildItems: v.optional(v.boolean()),
        layout: viewLayoutValidator,
        grouping: groupFieldValidator,
        ordering: orderingFieldValidator,
        displayProps: v.array(displayPropertyValidator),
        filters: viewFiltersValidator,
      })
    ),
  },
  handler: createProjectHandler,
})

export const updateProject = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    projectId: v.string(),
    patch: v.object({
      name: v.optional(v.string()),
      status: v.optional(projectStatusValidator),
      priority: v.optional(priorityValidator),
    }),
  },
  handler: updateProjectHandler,
})

export const renameProject = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    projectId: v.string(),
    name: v.string(),
  },
  handler: renameProjectHandler,
})

export const deleteProject = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    projectId: v.string(),
  },
  handler: deleteProjectHandler,
})

export const createDocument = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    id: v.optional(v.string()),
    kind: v.union(
      v.literal("team-document"),
      v.literal("workspace-document"),
      v.literal("private-document")
    ),
    teamId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    title: v.string(),
  },
  handler: createDocumentHandler,
})

export const createWorkItem = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    origin: v.string(),
    teamId: v.string(),
    type: workItemTypeValidator,
    title: v.string(),
    parentId: v.optional(nullableStringValidator),
    primaryProjectId: nullableStringValidator,
    assigneeId: nullableStringValidator,
    status: v.optional(workStatusValidator),
    priority: priorityValidator,
    labelIds: v.optional(v.array(v.string())),
    startDate: v.optional(nullableStringValidator),
    dueDate: v.optional(nullableStringValidator),
    targetDate: v.optional(nullableStringValidator),
  },
  handler: createWorkItemHandler,
})

export const createWorkspaceChat = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    workspaceId: v.string(),
    participantIds: v.array(v.string()),
    title: v.string(),
    description: v.string(),
  },
  handler: createWorkspaceChatHandler,
})

export const ensureTeamChat = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    teamId: v.string(),
    title: v.string(),
    description: v.string(),
  },
  handler: ensureTeamChatHandler,
})

export const createChannel = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    teamId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
  },
  handler: createChannelHandler,
})

export const startChatCall = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    conversationId: v.string(),
    roomKey: v.string(),
    roomDescription: v.string(),
  },
  handler: startChatCallHandler,
})

export const setCallRoom = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    callId: v.string(),
    roomId: v.string(),
    roomName: v.string(),
  },
  handler: setCallRoomHandler,
})

export const setConversationRoom = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    conversationId: v.string(),
    roomId: v.string(),
    roomName: v.string(),
  },
  handler: setConversationRoomHandler,
})

export const markCallJoined = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    callId: v.string(),
  },
  handler: markCallJoinedHandler,
})

export const sendChatMessage = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    conversationId: v.string(),
    content: v.string(),
    messageId: v.optional(v.string()),
    origin: v.string(),
  },
  handler: sendChatMessageHandler,
})

export const toggleChatMessageReaction = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    messageId: v.string(),
    emoji: v.string(),
  },
  handler: toggleChatMessageReactionHandler,
})

export const createChannelPost = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    conversationId: v.string(),
    title: v.string(),
    content: v.string(),
    origin: v.string(),
  },
  handler: createChannelPostHandler,
})

export const addChannelPostComment = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    postId: v.string(),
    content: v.string(),
    origin: v.string(),
  },
  handler: addChannelPostCommentHandler,
})

export const deleteChannelPost = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    postId: v.string(),
  },
  handler: deleteChannelPostHandler,
})

export const toggleChannelPostReaction = mutation({
  args: {
    ...serverAccessArgs,
    currentUserId: v.string(),
    postId: v.string(),
    emoji: v.string(),
  },
  handler: toggleChannelPostReactionHandler,
})
