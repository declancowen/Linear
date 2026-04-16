import { v } from "convex/values"

const nullableString = v.union(v.string(), v.null())
const nullableStorageId = v.union(v.id("_storage"), v.null())

const roleLiterals = [
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer"),
  v.literal("guest"),
] as const

const scopeTypeLiterals = [v.literal("team"), v.literal("workspace")] as const

const templateTypeLiterals = [
  v.literal("software-delivery"),
  v.literal("bug-tracking"),
  v.literal("project-management"),
] as const

const teamExperienceTypeLiterals = [
  v.literal("software-development"),
  v.literal("issue-analysis"),
  v.literal("project-management"),
  v.literal("community"),
] as const

const workItemTypeLiterals = [
  v.literal("epic"),
  v.literal("feature"),
  v.literal("requirement"),
  v.literal("story"),
  v.literal("task"),
  v.literal("issue"),
  v.literal("sub-task"),
  v.literal("sub-issue"),
] as const

const legacyWorkItemTypeLiterals = [v.literal("bug")] as const

const workStatusLiterals = [
  v.literal("backlog"),
  v.literal("todo"),
  v.literal("in-progress"),
  v.literal("done"),
  v.literal("cancelled"),
  v.literal("duplicate"),
] as const

const priorityLiterals = [
  v.literal("none"),
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
] as const

const projectHealthLiterals = [
  v.literal("no-update"),
  v.literal("on-track"),
  v.literal("at-risk"),
  v.literal("off-track"),
] as const

const projectStatusLiterals = [
  v.literal("planning"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("completed"),
] as const

const notificationTypeLiterals = [
  v.literal("mention"),
  v.literal("assignment"),
  v.literal("comment"),
  v.literal("invite"),
  v.literal("status-change"),
] as const

const viewLayoutLiterals = [
  v.literal("list"),
  v.literal("board"),
  v.literal("timeline"),
] as const

const viewScopeTypeLiterals = [
  v.literal("personal"),
  v.literal("team"),
  v.literal("workspace"),
] as const

const entityKindLiterals = [
  v.literal("items"),
  v.literal("projects"),
  v.literal("docs"),
] as const

const displayPropertyLiterals = [
  v.literal("id"),
  v.literal("type"),
  v.literal("status"),
  v.literal("assignee"),
  v.literal("priority"),
  v.literal("project"),
  v.literal("dueDate"),
  v.literal("milestone"),
  v.literal("labels"),
  v.literal("created"),
  v.literal("updated"),
] as const

const groupFieldLiterals = [
  v.literal("project"),
  v.literal("status"),
  v.literal("assignee"),
  v.literal("priority"),
  v.literal("label"),
  v.literal("team"),
  v.literal("type"),
  v.literal("epic"),
  v.literal("feature"),
] as const

const orderingFieldLiterals = [
  v.literal("priority"),
  v.literal("updatedAt"),
  v.literal("createdAt"),
  v.literal("dueDate"),
  v.literal("targetDate"),
  v.literal("title"),
] as const

const themePreferenceLiterals = [
  v.literal("light"),
  v.literal("dark"),
  v.literal("system"),
] as const

const userStatusLiterals = [
  v.literal("active"),
  v.literal("away"),
  v.literal("busy"),
  v.literal("out-of-office"),
] as const

const commentTargetTypeLiterals = [
  v.literal("workItem"),
  v.literal("document"),
] as const

const attachmentTargetTypeLiterals = [
  v.literal("workItem"),
  v.literal("document"),
] as const

const documentKindLiterals = [
  v.literal("team-document"),
  v.literal("workspace-document"),
  v.literal("private-document"),
  v.literal("item-description"),
] as const

const conversationKindLiterals = [
  v.literal("chat"),
  v.literal("channel"),
] as const

const conversationScopeTypeLiterals = [
  v.literal("workspace"),
  v.literal("team"),
] as const

const conversationVariantLiterals = [
  v.literal("direct"),
  v.literal("group"),
  v.literal("team"),
] as const

const chatMessageKindLiterals = [v.literal("text"), v.literal("call")] as const

const notificationEntityTypeLiterals = [
  v.literal("workItem"),
  v.literal("document"),
  v.literal("project"),
  v.literal("invite"),
  v.literal("channelPost"),
  v.literal("chat"),
  v.literal("team"),
  v.literal("workspace"),
] as const

const auditEventTypeLiterals = [
  v.literal("membership.role_changed"),
  v.literal("membership.removed_from_team"),
  v.literal("membership.removed_from_workspace"),
  v.literal("membership.left_team"),
  v.literal("membership.left_workspace"),
  v.literal("workspace.deleted"),
  v.literal("account.deleted"),
  v.literal("invite.created"),
  v.literal("invite.accepted"),
  v.literal("invite.declined"),
  v.literal("provider.membership_cleanup_failed"),
  v.literal("provider.account_cleanup_failed"),
] as const

const auditEventOutcomeLiterals = [
  v.literal("success"),
  v.literal("failure"),
] as const

const auditEventSourceLiterals = [
  v.literal("convex"),
  v.literal("server"),
] as const

export const roleValidator = v.union(...roleLiterals)
export const scopeTypeValidator = v.union(...scopeTypeLiterals)
export const templateTypeValidator = v.union(...templateTypeLiterals)
export const teamExperienceTypeValidator = v.union(
  ...teamExperienceTypeLiterals
)
export const workItemTypeValidator = v.union(...workItemTypeLiterals)
export const storedWorkItemTypeValidator = v.union(
  ...workItemTypeLiterals,
  ...legacyWorkItemTypeLiterals
)
export const workStatusValidator = v.union(...workStatusLiterals)
export const priorityValidator = v.union(...priorityLiterals)
export const projectHealthValidator = v.union(...projectHealthLiterals)
export const projectStatusValidator = v.union(...projectStatusLiterals)
export const notificationTypeValidator = v.union(...notificationTypeLiterals)
export const viewLayoutValidator = v.union(...viewLayoutLiterals)
export const viewScopeTypeValidator = v.union(...viewScopeTypeLiterals)
export const entityKindValidator = v.union(...entityKindLiterals)
export const displayPropertyValidator = v.union(...displayPropertyLiterals)
export const groupFieldValidator = v.union(...groupFieldLiterals)
export const orderingFieldValidator = v.union(...orderingFieldLiterals)
export const themePreferenceValidator = v.union(...themePreferenceLiterals)
export const userStatusValidator = v.union(...userStatusLiterals)
export const commentTargetTypeValidator = v.union(...commentTargetTypeLiterals)
export const attachmentTargetTypeValidator = v.union(
  ...attachmentTargetTypeLiterals
)
export const documentKindValidator = v.union(...documentKindLiterals)
export const conversationKindValidator = v.union(...conversationKindLiterals)
export const conversationScopeTypeValidator = v.union(
  ...conversationScopeTypeLiterals
)
export const conversationVariantValidator = v.union(
  ...conversationVariantLiterals
)
export const chatMessageKindValidator = v.union(...chatMessageKindLiterals)
export const notificationEntityTypeValidator = v.union(
  ...notificationEntityTypeLiterals
)
export const auditEventTypeValidator = v.union(...auditEventTypeLiterals)
export const auditEventOutcomeValidator = v.union(...auditEventOutcomeLiterals)
export const auditEventSourceValidator = v.union(...auditEventSourceLiterals)
export const nullableStringValidator = nullableString
export const teamTemplateConfigValidator = v.object({
  defaultPriority: priorityValidator,
  targetWindowDays: v.number(),
  defaultViewLayout: viewLayoutValidator,
  recommendedItemTypes: v.array(workItemTypeValidator),
  summaryHint: v.string(),
})
export const storedTeamTemplateConfigValidator = v.object({
  defaultPriority: priorityValidator,
  targetWindowDays: v.number(),
  defaultViewLayout: viewLayoutValidator,
  recommendedItemTypes: v.array(storedWorkItemTypeValidator),
  summaryHint: v.string(),
})
export const teamWorkflowSettingsValidator = v.object({
  statusOrder: v.array(workStatusValidator),
  templateDefaults: v.record(v.string(), teamTemplateConfigValidator),
})
export const storedTeamWorkflowSettingsValidator = v.object({
  statusOrder: v.array(workStatusValidator),
  templateDefaults: v.record(v.string(), storedTeamTemplateConfigValidator),
})
export const teamFeatureSettingsValidator = v.object({
  issues: v.boolean(),
  projects: v.boolean(),
  views: v.boolean(),
  docs: v.boolean(),
  chat: v.boolean(),
  channels: v.boolean(),
})

export const workspaceFields = {
  id: v.string(),
  slug: v.string(),
  name: v.string(),
  logoUrl: v.string(),
  logoImageStorageId: v.optional(nullableStorageId),
  createdBy: v.optional(nullableString),
  workosOrganizationId: v.optional(nullableString),
  settings: v.object({
    accent: v.string(),
    description: v.string(),
  }),
}

export const auditEventDetailsValidator = v.object({
  deletedPrivateDocumentIds: v.optional(v.array(v.string())),
  email: v.optional(v.string()),
  inviteRole: v.optional(roleValidator),
  nextRole: v.optional(roleValidator),
  organizationId: v.optional(v.string()),
  previousRole: v.optional(roleValidator),
  provider: v.optional(v.string()),
  reason: v.optional(v.string()),
  removedTeamIds: v.optional(v.array(v.string())),
  source: v.optional(auditEventSourceValidator),
  workosUserId: v.optional(v.string()),
})

export const auditEventFields = {
  id: v.string(),
  type: auditEventTypeValidator,
  outcome: auditEventOutcomeValidator,
  actorUserId: nullableString,
  subjectUserId: nullableString,
  workspaceId: nullableString,
  teamId: nullableString,
  entityId: nullableString,
  summary: v.string(),
  details: auditEventDetailsValidator,
  occurredAt: v.string(),
}

export const teamFields = {
  id: v.string(),
  workspaceId: v.string(),
  joinCodeNormalized: v.optional(v.string()),
  slug: v.string(),
  name: v.string(),
  icon: v.string(),
  settings: v.object({
    joinCode: v.string(),
    summary: v.string(),
    guestProjectIds: v.array(v.string()),
    guestDocumentIds: v.array(v.string()),
    guestWorkItemIds: v.array(v.string()),
    experience: v.optional(teamExperienceTypeValidator),
    features: v.optional(teamFeatureSettingsValidator),
    workflow: v.optional(storedTeamWorkflowSettingsValidator),
  }),
}

export const teamMembershipFields = {
  teamId: v.string(),
  userId: v.string(),
  role: roleValidator,
}

export const userFields = {
  id: v.string(),
  name: v.string(),
  handle: v.string(),
  email: v.string(),
  emailNormalized: v.optional(v.string()),
  avatarUrl: v.string(),
  avatarImageStorageId: v.optional(nullableStorageId),
  workosUserId: v.optional(nullableString),
  title: v.string(),
  status: v.optional(userStatusValidator),
  statusMessage: v.optional(v.string()),
  hasExplicitStatus: v.optional(v.boolean()),
  accountDeletionPendingAt: v.optional(nullableString),
  accountDeletedAt: v.optional(nullableString),
  preferences: v.object({
    emailMentions: v.boolean(),
    emailAssignments: v.boolean(),
    emailDigest: v.boolean(),
    theme: themePreferenceValidator,
  }),
}

export const labelFields = {
  id: v.string(),
  workspaceId: v.optional(v.string()),
  name: v.string(),
  color: v.string(),
}

export const viewFiltersValidator = v.object({
  status: v.array(workStatusValidator),
  priority: v.array(priorityValidator),
  assigneeIds: v.array(v.string()),
  creatorIds: v.array(v.string()),
  leadIds: v.array(v.string()),
  health: v.array(projectHealthValidator),
  milestoneIds: v.array(v.string()),
  relationTypes: v.array(v.string()),
  projectIds: v.array(v.string()),
  itemTypes: v.array(workItemTypeValidator),
  labelIds: v.array(v.string()),
  teamIds: v.array(v.string()),
  showCompleted: v.boolean(),
})
export const storedViewFiltersValidator = v.object({
  status: v.array(workStatusValidator),
  priority: v.array(priorityValidator),
  assigneeIds: v.array(v.string()),
  creatorIds: v.array(v.string()),
  leadIds: v.array(v.string()),
  health: v.array(projectHealthValidator),
  milestoneIds: v.array(v.string()),
  relationTypes: v.array(v.string()),
  projectIds: v.array(v.string()),
  itemTypes: v.array(storedWorkItemTypeValidator),
  labelIds: v.array(v.string()),
  teamIds: v.array(v.string()),
  showCompleted: v.boolean(),
})

export const projectFields = {
  id: v.string(),
  scopeType: scopeTypeValidator,
  scopeId: v.string(),
  templateType: templateTypeValidator,
  name: v.string(),
  summary: v.string(),
  description: v.string(),
  leadId: v.string(),
  memberIds: v.array(v.string()),
  health: projectHealthValidator,
  priority: priorityValidator,
  status: projectStatusValidator,
  presentation: v.optional(
    v.object({
      layout: viewLayoutValidator,
      grouping: groupFieldValidator,
      ordering: orderingFieldValidator,
      displayProps: v.array(displayPropertyValidator),
      filters: viewFiltersValidator,
    })
  ),
  startDate: nullableString,
  targetDate: nullableString,
  createdAt: v.string(),
  updatedAt: v.string(),
}

export const milestoneFields = {
  id: v.string(),
  projectId: v.string(),
  name: v.string(),
  targetDate: nullableString,
  status: workStatusValidator,
}

export const workItemFields = {
  id: v.string(),
  key: v.string(),
  teamId: v.string(),
  type: storedWorkItemTypeValidator,
  title: v.string(),
  descriptionDocId: v.string(),
  status: workStatusValidator,
  priority: priorityValidator,
  assigneeId: nullableString,
  creatorId: v.string(),
  parentId: nullableString,
  primaryProjectId: nullableString,
  linkedProjectIds: v.array(v.string()),
  linkedDocumentIds: v.array(v.string()),
  labelIds: v.array(v.string()),
  milestoneId: nullableString,
  startDate: nullableString,
  dueDate: nullableString,
  targetDate: nullableString,
  subscriberIds: v.array(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
}

export const documentFields = {
  id: v.string(),
  kind: documentKindValidator,
  workspaceId: v.optional(v.string()),
  teamId: nullableString,
  title: v.string(),
  content: v.string(),
  linkedProjectIds: v.array(v.string()),
  linkedWorkItemIds: v.array(v.string()),
  createdBy: v.string(),
  updatedBy: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
}

export const documentPresenceFields = {
  documentId: v.string(),
  userId: v.string(),
  workosUserId: v.optional(v.string()),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  sessionId: v.string(),
  createdAt: v.string(),
  lastSeenAt: v.string(),
}

export const viewDefinitionFields = {
  id: v.string(),
  name: v.string(),
  description: v.string(),
  scopeType: viewScopeTypeValidator,
  scopeId: v.string(),
  entityKind: entityKindValidator,
  layout: viewLayoutValidator,
  filters: storedViewFiltersValidator,
  grouping: groupFieldValidator,
  subGrouping: v.union(groupFieldValidator, v.null()),
  ordering: orderingFieldValidator,
  displayProps: v.array(displayPropertyValidator),
  hiddenState: v.object({
    groups: v.array(v.string()),
    subgroups: v.array(v.string()),
  }),
  isShared: v.boolean(),
  route: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
}

export const commentFields = {
  id: v.string(),
  targetType: commentTargetTypeValidator,
  targetId: v.string(),
  parentCommentId: nullableString,
  content: v.string(),
  mentionUserIds: v.optional(v.array(v.string())),
  reactions: v.optional(
    v.array(
      v.object({
        emoji: v.string(),
        userIds: v.array(v.string()),
      })
    )
  ),
  createdBy: v.string(),
  createdAt: v.string(),
}

export const attachmentFields = {
  id: v.string(),
  targetType: attachmentTargetTypeValidator,
  targetId: v.string(),
  teamId: v.string(),
  storageId: v.id("_storage"),
  fileName: v.string(),
  contentType: v.string(),
  size: v.number(),
  uploadedBy: v.string(),
  createdAt: v.string(),
}

export const notificationFields = {
  id: v.string(),
  userId: v.string(),
  type: notificationTypeValidator,
  entityType: notificationEntityTypeValidator,
  entityId: v.string(),
  actorId: v.string(),
  message: v.string(),
  readAt: nullableString,
  archivedAt: v.optional(nullableString),
  emailedAt: nullableString,
  createdAt: v.string(),
}

export const inviteFields = {
  id: v.string(),
  workspaceId: v.string(),
  teamId: v.string(),
  email: v.string(),
  normalizedEmail: v.optional(v.string()),
  role: roleValidator,
  token: v.string(),
  joinCode: v.string(),
  invitedBy: v.string(),
  expiresAt: v.string(),
  acceptedAt: nullableString,
  declinedAt: v.optional(nullableString),
}

export const projectUpdateFields = {
  id: v.string(),
  projectId: v.string(),
  content: v.string(),
  createdBy: v.string(),
  createdAt: v.string(),
}

export const conversationFields = {
  id: v.string(),
  kind: conversationKindValidator,
  scopeType: conversationScopeTypeValidator,
  scopeId: v.string(),
  variant: conversationVariantValidator,
  title: v.string(),
  description: v.string(),
  participantIds: v.array(v.string()),
  roomId: v.optional(nullableString),
  roomName: v.optional(nullableString),
  createdBy: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
  lastActivityAt: v.string(),
}

export const chatMessageFields = {
  id: v.string(),
  conversationId: v.string(),
  kind: chatMessageKindValidator,
  content: v.string(),
  callId: v.optional(nullableString),
  mentionUserIds: v.optional(v.array(v.string())),
  createdBy: v.string(),
  createdAt: v.string(),
}

export const callFields = {
  id: v.string(),
  conversationId: v.string(),
  scopeType: conversationScopeTypeValidator,
  scopeId: v.string(),
  roomId: nullableString,
  roomName: nullableString,
  roomKey: v.string(),
  roomDescription: v.string(),
  startedBy: v.string(),
  startedAt: v.string(),
  updatedAt: v.string(),
  endedAt: nullableString,
  participantUserIds: v.optional(v.array(v.string())),
  lastJoinedAt: nullableString,
  lastJoinedBy: nullableString,
  joinCount: v.optional(v.number()),
}

const channelPostReactionValidator = v.object({
  emoji: v.string(),
  userIds: v.array(v.string()),
})

export const channelPostFields = {
  id: v.string(),
  conversationId: v.string(),
  title: v.string(),
  content: v.string(),
  reactions: v.optional(v.array(channelPostReactionValidator)),
  createdBy: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
}

export const channelPostCommentFields = {
  id: v.string(),
  postId: v.string(),
  content: v.string(),
  mentionUserIds: v.optional(v.array(v.string())),
  createdBy: v.string(),
  createdAt: v.string(),
}
