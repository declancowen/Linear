import type {
  AppSnapshot,
  Attachment,
  ChannelPost,
  ChannelPostComment,
  ChatMessage,
  Comment,
  Conversation,
  Document,
  Invite,
  Notification,
  Project,
  ProjectUpdate,
  Team,
  TeamMembership,
  UserProfile,
  ViewDefinition,
  WorkItemActivity,
  WorkItem,
  Workspace,
  WorkspaceMembership,
} from "@/lib/domain/types"
import {
  getCustomPropertyScopeType,
  getLabelScopeType,
} from "@/lib/domain/labels"
import { getWorkItemAssigneeIds } from "@/lib/domain/work-item-assignees"
import { isWorkspaceMembershipInvite } from "@/lib/scoped-sync/invite-selection"
import { shouldShowNotificationInInbox } from "@/lib/domain/notification-visibility"

import {
  createChannelFeedScopeKey,
  createConversationListScopeKey,
  createConversationThreadScopeKey,
  createDocumentDetailScopeKey,
  createDocumentIndexScopeKey,
  createNotificationInboxScopeKey,
  createPrivateDocumentIndexScopeKey,
  createPrivateSearchSeedScopeKey,
  createProjectDetailScopeKey,
  createProjectIndexScopeKey,
  createScopedCollectionScopeId,
  createSearchSeedScopeKey,
  createViewCatalogScopeKey,
  createWorkIndexScopeKey,
  createWorkItemDetailScopeKey,
  createWorkspaceMembershipScopeKey,
  createWorkspacePeopleScopeKey,
} from "./scope-keys"

export type ScopedReadModelPatch = Partial<AppSnapshot>

export type ScopedReadModelReplaceInstruction =
  | {
      kind: "document-detail"
      documentId: string
    }
  | {
      kind: "missing-document-detail"
      documentId: string
    }
  | {
      kind: "document-index"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | {
      kind: "work-item-detail"
      itemId: string
    }
  | {
      kind: "missing-work-item-detail"
      itemId: string
    }
  | {
      kind: "work-index"
      scopeType: "team" | "workspace" | "personal"
      scopeId: string
    }
  | {
      kind: "project-detail"
      projectId: string
    }
  | {
      kind: "missing-project-detail"
      projectId: string
    }
  | {
      kind: "project-index"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | {
      kind: "workspace-membership"
      workspaceId: string
    }
  | {
      kind: "workspace-people"
      workspaceId: string
    }
  | {
      kind: "view-catalog"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | {
      kind: "notification-inbox"
      userId: string
    }
  | {
      kind: "conversation-list"
      userId: string
    }
  | {
      kind: "conversation-thread"
      conversationId: string
    }
  | {
      kind: "channel-feed"
      conversationId: string
    }
  | {
      kind: "search-seed"
      workspaceId: string
    }

type ScopedReadModelReplaceKind = ScopedReadModelReplaceInstruction["kind"]

type ScopedReadModelSelector<TKind extends ScopedReadModelReplaceKind> = (
  snapshot: AppSnapshot,
  instruction: Extract<ScopedReadModelReplaceInstruction, { kind: TKind }>
) => ScopedReadModelPatch | null

function collectCommentUserIds(targetComments: Comment[]) {
  const userIds = new Set<string>()

  for (const comment of targetComments) {
    userIds.add(comment.createdBy)

    for (const mentionUserId of comment.mentionUserIds ?? []) {
      userIds.add(mentionUserId)
    }

    for (const reaction of comment.reactions ?? []) {
      for (const reactionUserId of reaction.userIds) {
        userIds.add(reactionUserId)
      }
    }
  }

  return userIds
}

function collectAttachmentUserIds(targetAttachments: Attachment[]) {
  const userIds = new Set<string>()

  for (const attachment of targetAttachments) {
    userIds.add(attachment.uploadedBy)
  }

  return userIds
}

function extractDocumentPreviewText(document: Document) {
  const rawPreview = document.content
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const preview = rawPreview.startsWith(document.title)
    ? rawPreview.slice(document.title.length).trim()
    : rawPreview

  return preview.length > 0 ? preview : ""
}

function toDocumentPreviewEntry(document: Document): Document {
  return {
    ...document,
    content: "",
    previewText: extractDocumentPreviewText(document),
  }
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0
}

function compactStringIds(values: Iterable<string | null | undefined>) {
  return [...values].filter(isNonEmptyString)
}

function selectUsers(snapshot: AppSnapshot, userIds: Iterable<string>) {
  const userIdSet = new Set([...userIds].filter(Boolean))

  if (userIdSet.size === 0) {
    return [] as UserProfile[]
  }

  return snapshot.users.filter((user) => userIdSet.has(user.id))
}

function selectDocumentComments(snapshot: AppSnapshot, documentId: string) {
  return snapshot.comments.filter(
    (comment) =>
      comment.targetType === "document" && comment.targetId === documentId
  )
}

function selectTopLevelViews(
  snapshot: AppSnapshot,
  entityKind: ViewDefinition["entityKind"]
) {
  return snapshot.views.filter(
    (view) => !view.containerType && view.entityKind === entityKind
  )
}

function selectWorkspaceRouteViews(
  snapshot: AppSnapshot,
  scopeId: string,
  entityKind: ViewDefinition["entityKind"]
) {
  return selectTopLevelViews(snapshot, entityKind).filter((view) => {
    if (view.scopeType === "workspace" && view.scopeId === scopeId) {
      return true
    }

    return (
      scopeId === snapshot.currentWorkspaceId &&
      view.scopeType === "personal" &&
      view.scopeId === snapshot.currentUserId &&
      view.route.startsWith("/workspace/")
    )
  })
}

function selectTeamRouteViews(
  snapshot: AppSnapshot,
  scopeId: string,
  entityKind: ViewDefinition["entityKind"]
) {
  return selectTopLevelViews(snapshot, entityKind).filter(
    (view) => view.scopeType === "team" && view.scopeId === scopeId
  )
}

function selectProjectIndexViews(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return scopeType === "workspace"
    ? selectWorkspaceRouteViews(snapshot, scopeId, "projects")
    : selectTeamRouteViews(snapshot, scopeId, "projects")
}

function selectDocumentIndexViews(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return scopeType === "workspace"
    ? selectWorkspaceRouteViews(snapshot, scopeId, "docs")
    : selectTeamRouteViews(snapshot, scopeId, "docs")
}

function selectWorkIndexViews(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
) {
  if (scopeType === "workspace") {
    return selectWorkspaceRouteViews(snapshot, scopeId, "items")
  }

  if (scopeType === "team") {
    return selectTeamRouteViews(snapshot, scopeId, "items")
  }

  return selectTopLevelViews(snapshot, "items").filter(
    (view) => view.scopeType === "personal" && view.scopeId === scopeId
  )
}

function getAccessibleTeamIds(snapshot: AppSnapshot) {
  return new Set(
    snapshot.teamMemberships
      .filter((membership) => membership.userId === snapshot.currentUserId)
      .map((membership) => membership.teamId)
  )
}

function selectViewCatalogViews(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  if (scopeType === "team") {
    return snapshot.views.filter(
      (view) =>
        !view.containerType &&
        view.scopeType === "team" &&
        view.scopeId === scopeId
    )
  }

  const accessibleTeamIds = new Set(
    selectAccessibleTeamsForScope(snapshot, "workspace", scopeId).map(
      (team) => team.id
    )
  )

  return snapshot.views.filter((view) => {
    if (view.containerType) {
      return false
    }

    if (view.scopeType === "workspace") {
      return view.scopeId === scopeId
    }

    if (view.scopeType === "team") {
      return accessibleTeamIds.has(view.scopeId)
    }

    return (
      scopeId === snapshot.currentWorkspaceId &&
      view.scopeId === snapshot.currentUserId &&
      view.route.startsWith("/workspace/")
    )
  })
}

function selectProjectsForScope(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  if (scopeType === "team") {
    return snapshot.projects.filter(
      (project) => project.scopeType === "team" && project.scopeId === scopeId
    )
  }

  const accessibleTeamIds = new Set(
    selectAccessibleTeamsForScope(snapshot, "workspace", scopeId).map(
      (team) => team.id
    )
  )

  return snapshot.projects.filter((project) => {
    if (project.scopeType === "workspace") {
      return project.scopeId === scopeId
    }

    return accessibleTeamIds.has(project.scopeId)
  })
}

function isProjectScopedToTeamOrWorkspaceIds(
  project: AppSnapshot["projects"][number],
  teamIds: ReadonlySet<string>,
  workspaceIds: ReadonlySet<string>
) {
  if (project.scopeType === "team") {
    return teamIds.has(project.scopeId)
  }

  return workspaceIds.has(project.scopeId)
}

function selectMilestonesForProjects(
  snapshot: AppSnapshot,
  projects: AppSnapshot["projects"]
) {
  const projectIds = new Set(projects.map((project) => project.id))

  return snapshot.milestones.filter((milestone) =>
    projectIds.has(milestone.projectId)
  )
}

function selectLabelsForWorkspaceIds(
  snapshot: AppSnapshot,
  workspaceIds: ReadonlySet<string>
) {
  return (snapshot.labels ?? []).filter(
    (label) =>
      workspaceIds.has(label.workspaceId) &&
      getLabelScopeType(label) === "workspace"
  )
}

function selectCustomPropertyDefinitionsForTeamIds(
  snapshot: AppSnapshot,
  teamIds: ReadonlySet<string>,
  options: {
    includeTeam?: boolean
  } = {}
) {
  const includeTeam = options.includeTeam ?? true
  return (snapshot.customPropertyDefinitions ?? []).filter(
    (definition) =>
      teamIds.has(definition.teamId) &&
      !definition.isArchived &&
      includeTeam &&
      getCustomPropertyScopeType(definition) === "team"
  )
}

function selectCustomPropertyValuesForWorkItemIds(
  snapshot: AppSnapshot,
  workItemIds: ReadonlySet<string>,
  definitions: AppSnapshot["customPropertyDefinitions"]
) {
  const propertyIds = new Set(definitions.map((definition) => definition.id))

  return (snapshot.customPropertyValues ?? []).filter(
    (value) =>
      workItemIds.has(value.workItemId) && propertyIds.has(value.propertyId)
  )
}

function collectCustomPropertyValueUserIds(
  definitions: AppSnapshot["customPropertyDefinitions"],
  values: AppSnapshot["customPropertyValues"]
) {
  const personPropertyIds = new Set(
    definitions
      .filter((definition) => definition.type === "person")
      .map((definition) => definition.id)
  )
  const userIds = new Set<string>()

  for (const value of values) {
    if (!personPropertyIds.has(value.propertyId)) {
      continue
    }

    if (typeof value.value === "string") {
      userIds.add(value.value)
    }
  }

  return userIds
}

function selectAccessibleTeamsForScope(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
) {
  if (scopeType === "team") {
    return snapshot.teams.filter((team) => team.id === scopeId)
  }

  const accessibleTeamIds = getAccessibleTeamIds(snapshot)

  if (scopeType === "workspace") {
    return snapshot.teams.filter(
      (team) => team.workspaceId === scopeId && accessibleTeamIds.has(team.id)
    )
  }

  return snapshot.teams.filter((team) => accessibleTeamIds.has(team.id))
}

function selectWorkItemsForScope(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
) {
  if (scopeType === "team") {
    return snapshot.workItems.filter(
      (item) =>
        item.teamId === scopeId && (item.visibility ?? "team") === "team"
    )
  }

  const teamIds = new Set(
    selectAccessibleTeamsForScope(snapshot, scopeType, scopeId).map(
      (team) => team.id
    )
  )

  if (scopeType === "personal") {
    return snapshot.workItems.filter((item) => {
      if ((item.visibility ?? "team") === "private") {
        return item.creatorId === scopeId
      }

      return teamIds.has(item.teamId ?? "")
    })
  }

  return snapshot.workItems.filter(
    (item) =>
      teamIds.has(item.teamId ?? "") && (item.visibility ?? "team") === "team"
  )
}

function selectDocumentsForScope(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  if (scopeType === "team") {
    return snapshot.documents.filter(
      (document) =>
        document.kind === "team-document" && document.teamId === scopeId
    )
  }

  return snapshot.documents.filter((document) => {
    if (document.kind === "workspace-document") {
      return document.workspaceId === scopeId
    }

    return (
      document.kind === "private-document" &&
      document.workspaceId === scopeId &&
      document.createdBy === snapshot.currentUserId
    )
  })
}

function collectDocumentUserIds(documents: Document[]) {
  const userIds = new Set<string>()

  for (const document of documents) {
    userIds.add(document.createdBy)
    userIds.add(document.updatedBy)
  }

  return userIds
}

function collectWorkItemUserIds(items: WorkItem[]) {
  const userIds = new Set<string>()

  for (const item of items) {
    userIds.add(item.creatorId)
    for (const assigneeId of getWorkItemAssigneeIds(item)) {
      userIds.add(assigneeId)
    }

    for (const subscriberId of item.subscriberIds) {
      userIds.add(subscriberId)
    }
  }

  return userIds
}

function selectDocumentAttachments(snapshot: AppSnapshot, documentId: string) {
  return snapshot.attachments.filter(
    (attachment) =>
      attachment.targetType === "document" && attachment.targetId === documentId
  )
}

function selectWorkItemComments(snapshot: AppSnapshot, itemId: string) {
  return snapshot.comments.filter(
    (comment) =>
      comment.targetType === "workItem" && comment.targetId === itemId
  )
}

function selectWorkItemAttachments(snapshot: AppSnapshot, itemId: string) {
  return snapshot.attachments.filter(
    (attachment) =>
      attachment.targetType === "workItem" && attachment.targetId === itemId
  )
}

function selectWorkItemActivities(
  snapshot: AppSnapshot,
  itemIds: Iterable<string>
) {
  const itemIdSet = new Set(itemIds)

  return snapshot.workItemActivities.filter((activity) =>
    itemIdSet.has(activity.itemId)
  )
}

function resolveSnapshotWorkItemWorkspaceId(
  snapshot: AppSnapshot,
  item: AppSnapshot["workItems"][number]
) {
  if ((item.visibility ?? "team") === "private") {
    return item.workspaceId ?? null
  }

  return item.teamId
    ? (snapshot.teams.find((team) => team.id === item.teamId)?.workspaceId ??
        null)
    : null
}

function collectWorkItemActivityUserIds(activities: WorkItemActivity[]) {
  return activities.map((activity) => activity.actorId)
}

function selectProjectViews(snapshot: AppSnapshot, project: Project) {
  return snapshot.views.filter(
    (view) =>
      view.entityKind === "items" &&
      ((view.containerType === "project-items" &&
        view.containerId === project.id) ||
        (!view.containerType &&
          view.scopeType === project.scopeType &&
          view.scopeId === project.scopeId))
  )
}

function addValuesToSet(target: Set<string>, values: Iterable<string>) {
  for (const value of values) {
    target.add(value)
  }
}

function collectViewFilterUserIds(view: ViewDefinition) {
  return [
    ...view.filters.assigneeIds,
    ...view.filters.creatorIds,
    ...(view.filters.updatedByIds ?? []),
    ...view.filters.leadIds,
  ]
}

function collectViewScopeUserIds(view: ViewDefinition) {
  return view.scopeType === "personal" ? [view.scopeId] : []
}

function collectViewUserIds(views: ViewDefinition[]) {
  const userIds = new Set<string>()

  for (const view of views) {
    addValuesToSet(userIds, collectViewScopeUserIds(view))
    addValuesToSet(userIds, collectViewFilterUserIds(view))
  }

  return userIds
}

function collectConversationUserIds(conversations: Conversation[]) {
  const userIds = new Set<string>()

  for (const conversation of conversations) {
    userIds.add(conversation.createdBy)

    for (const participantId of conversation.participantIds) {
      userIds.add(participantId)
    }
  }

  return userIds
}

function getChannelPostConversations(
  snapshot: AppSnapshot,
  channelPosts: ChannelPost[]
) {
  return channelPosts
    .map(
      (post) =>
        snapshot.conversations.find(
          (conversation) => conversation.id === post.conversationId
        ) ?? null
    )
    .filter(
      (conversation): conversation is Conversation => conversation !== null
    )
}

function getScopedConversationIds(
  conversations: Conversation[],
  scopeType: "team" | "workspace"
) {
  return conversations
    .filter((conversation) => conversation.scopeType === scopeType)
    .map((conversation) => conversation.scopeId)
}

function collectChatMessageUserIds(messages: ChatMessage[]) {
  const userIds = new Set<string>()

  for (const message of messages) {
    userIds.add(message.createdBy)

    for (const mentionUserId of message.mentionUserIds ?? []) {
      userIds.add(mentionUserId)
    }

    for (const reaction of message.reactions ?? []) {
      for (const reactionUserId of reaction.userIds) {
        userIds.add(reactionUserId)
      }
    }
  }

  return userIds
}

function collectCallUserIds(calls: AppSnapshot["calls"]) {
  const userIds = new Set<string>()

  for (const call of calls) {
    userIds.add(call.startedBy)

    if (call.lastJoinedBy) {
      userIds.add(call.lastJoinedBy)
    }

    for (const participantUserId of call.participantUserIds) {
      userIds.add(participantUserId)
    }
  }

  return userIds
}

function collectChannelPostUserIds(posts: ChannelPost[]) {
  const userIds = new Set<string>()

  for (const post of posts) {
    userIds.add(post.createdBy)

    for (const mentionUserId of post.mentionUserIds ?? []) {
      userIds.add(mentionUserId)
    }

    for (const reaction of post.reactions ?? []) {
      for (const reactionUserId of reaction.userIds) {
        userIds.add(reactionUserId)
      }
    }
  }

  return userIds
}

function collectChannelPostCommentUserIds(comments: ChannelPostComment[]) {
  const userIds = new Set<string>()

  for (const comment of comments) {
    userIds.add(comment.createdBy)

    for (const mentionUserId of comment.mentionUserIds ?? []) {
      userIds.add(mentionUserId)
    }

    for (const reaction of comment.reactions ?? []) {
      for (const reactionUserId of reaction.userIds) {
        userIds.add(reactionUserId)
      }
    }
  }

  return userIds
}

function collectNotificationUserIds(notifications: Notification[]) {
  const userIds = new Set<string>()

  for (const notification of notifications) {
    userIds.add(notification.userId)
    userIds.add(notification.actorId)
  }

  return userIds
}

function selectWorkspaceMembershipRecordsForTeams(
  snapshot: AppSnapshot,
  teams: Team[]
) {
  const workspaceIds = new Set(teams.map((team) => team.workspaceId))

  return snapshot.workspaceMemberships.filter((membership) =>
    workspaceIds.has(membership.workspaceId)
  )
}

function selectWorkspaceOwnersForTeams(snapshot: AppSnapshot, teams: Team[]) {
  const workspaceIds = new Set(teams.map((team) => team.workspaceId))

  return snapshot.workspaces.filter((workspace) =>
    workspaceIds.has(workspace.id)
  )
}

function selectConversationListConversations(
  snapshot: AppSnapshot,
  userId: string
) {
  const accessibleWorkspaceIds = collectAccessibleWorkspaceIds(snapshot, userId)
  const accessibleTeamIds = new Set(
    snapshot.teamMemberships
      .filter((membership) => membership.userId === userId)
      .map((membership) => membership.teamId)
  )

  return snapshot.conversations.filter((conversation) => {
    if (conversation.kind === "chat") {
      if (conversation.scopeType === "team") {
        return accessibleTeamIds.has(conversation.scopeId)
      }

      return conversation.participantIds.includes(userId)
    }

    if (conversation.scopeType === "team") {
      return accessibleTeamIds.has(conversation.scopeId)
    }

    return accessibleWorkspaceIds.has(conversation.scopeId)
  })
}

function selectChatMessagesForConversations(
  snapshot: AppSnapshot,
  conversationIds: Iterable<string>
) {
  const conversationIdSet = new Set(conversationIds)

  return snapshot.chatMessages.filter(
    (message) =>
      conversationIdSet.has(message.conversationId) &&
      isChatMessageVisibleToCurrentUser(snapshot, message)
  )
}

function selectChatReadStatesForConversations(
  snapshot: AppSnapshot,
  userId: string,
  conversationIds: Iterable<string>,
  options: {
    includeMessageReceipts?: boolean
  } = {}
) {
  const conversationIdSet = new Set(conversationIds)
  const readStates = snapshot.chatReadStates.filter(
    (state) =>
      state.userId === userId && conversationIdSet.has(state.conversationId)
  )

  if (options.includeMessageReceipts) {
    return readStates
  }

  return readStates.map((state) => {
    const readState = { ...state }

    delete readState.messageReadAtById

    return readState
  })
}

function selectChatReadStatesForConversationThread(
  snapshot: AppSnapshot,
  userId: string,
  conversationIds: Iterable<string>
) {
  return selectChatReadStatesForConversations(
    snapshot,
    userId,
    conversationIds,
    {
      includeMessageReceipts: true,
    }
  )
}

function isChatMessageVisibleToCurrentUser(
  snapshot: AppSnapshot,
  message: ChatMessage
) {
  return !message.deletedAt || message.createdBy === snapshot.currentUserId
}

function selectChannelPostCommentsForPosts(
  snapshot: AppSnapshot,
  postIds: Iterable<string>
) {
  const postIdSet = new Set(postIds)

  return snapshot.channelPostComments.filter((comment) =>
    postIdSet.has(comment.postId)
  )
}

function collectAccessibleWorkspaceIds(snapshot: AppSnapshot, userId: string) {
  const workspaceIds = new Set<string>()
  const teamWorkspaceById = new Map(
    snapshot.teams.map((team) => [team.id, team.workspaceId])
  )

  for (const workspace of snapshot.workspaces) {
    if (workspace.createdBy === userId) {
      workspaceIds.add(workspace.id)
    }
  }

  for (const membership of snapshot.workspaceMemberships) {
    if (membership.userId === userId) {
      workspaceIds.add(membership.workspaceId)
    }
  }

  for (const membership of snapshot.teamMemberships) {
    if (membership.userId !== userId) {
      continue
    }

    const workspaceId = teamWorkspaceById.get(membership.teamId)

    if (workspaceId) {
      workspaceIds.add(workspaceId)
    }
  }

  if (snapshot.currentWorkspaceId) {
    workspaceIds.add(snapshot.currentWorkspaceId)
  }

  return workspaceIds
}

function selectResolvedWorkspace(
  snapshot: AppSnapshot,
  requestedWorkspaceId: string,
  accessibleWorkspaceIds: Set<string>
) {
  const candidateWorkspaceIds = [
    requestedWorkspaceId,
    snapshot.currentWorkspaceId,
    ...accessibleWorkspaceIds,
  ].filter(Boolean)

  const resolvedWorkspaceId =
    candidateWorkspaceIds.find((workspaceId) =>
      accessibleWorkspaceIds.has(workspaceId)
    ) ?? ""

  const workspace =
    snapshot.workspaces.find((entry) => entry.id === resolvedWorkspaceId) ??
    null

  return {
    resolvedWorkspaceId,
    workspace,
  }
}

function selectWorkspaceMembershipInvites(
  snapshot: AppSnapshot,
  resolvedWorkspaceId: string,
  currentUserEmail: string | null
) {
  const normalizedCurrentUserEmail =
    currentUserEmail?.trim().toLowerCase() ?? ""

  return snapshot.invites.filter((invite) =>
    isWorkspaceMembershipInvite(
      invite,
      resolvedWorkspaceId,
      normalizedCurrentUserEmail
    )
  )
}

function selectWorkspaceMembershipUsers(
  snapshot: AppSnapshot,
  input: {
    currentUserId: string
    workspace: Workspace | null
    workspaceMemberships: WorkspaceMembership[]
    teamMemberships: AppSnapshot["teamMemberships"]
    invites: Invite[]
  }
) {
  const userIds = new Set<string>([
    input.currentUserId,
    input.workspace?.createdBy ?? "",
    ...input.workspaceMemberships.map((membership) => membership.userId),
    ...input.teamMemberships.map((membership) => membership.userId),
    ...input.invites.map((invite) => invite.invitedBy),
  ])

  return selectUsers(snapshot, userIds)
}

export function selectDocumentDetailReadModel(
  snapshot: AppSnapshot,
  documentId: string
): ScopedReadModelPatch | null {
  const document =
    snapshot.documents.find((entry) => entry.id === documentId) ?? null

  if (!document) {
    return null
  }

  const comments = selectDocumentComments(snapshot, documentId)
  const attachments = selectDocumentAttachments(snapshot, documentId)
  const users = selectUsers(snapshot, [
    document.createdBy,
    document.updatedBy,
    ...collectCommentUserIds(comments),
    ...collectAttachmentUserIds(attachments),
  ])

  return {
    documents: [document],
    comments,
    attachments,
    users,
  }
}

function selectMissingDocumentDetailReadModel(
  snapshot: AppSnapshot,
  documentId: string
): ScopedReadModelPatch {
  return {
    documents: snapshot.documents.filter((entry) => entry.id === documentId),
  }
}

function selectDocumentIndexProjects(
  snapshot: AppSnapshot,
  documents: Document[]
) {
  const projectIds = new Set(
    documents.flatMap((document) => document.linkedProjectIds)
  )

  return snapshot.projects.filter((project) => projectIds.has(project.id))
}

function selectDocumentIndexWorkItems(
  snapshot: AppSnapshot,
  documents: Document[]
) {
  const workItemIds = new Set(
    documents.flatMap((document) => document.linkedWorkItemIds)
  )

  return snapshot.workItems.filter((item) => workItemIds.has(item.id))
}

function selectDocumentIndexTeams(
  snapshot: AppSnapshot,
  documents: Document[],
  projects: Project[],
  workItems: WorkItem[]
) {
  const teamIds = new Set(
    compactStringIds([
      ...documents.map((document) => document.teamId),
      ...projects.map((project) =>
        project.scopeType === "team" ? project.scopeId : null
      ),
      ...workItems.map((item) => item.teamId),
    ])
  )

  return snapshot.teams.filter((team) => teamIds.has(team.id))
}

export function selectDocumentIndexReadModel(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace",
  scopeId: string
): ScopedReadModelPatch {
  const documents = selectDocumentsForScope(snapshot, scopeType, scopeId).map(
    toDocumentPreviewEntry
  )
  const projects = selectDocumentIndexProjects(snapshot, documents)
  const workItems = selectDocumentIndexWorkItems(snapshot, documents)
  const teams = selectDocumentIndexTeams(
    snapshot,
    documents,
    projects,
    workItems
  )
  const views = selectDocumentIndexViews(snapshot, scopeType, scopeId)
  const users = selectUsers(snapshot, collectDocumentUserIds(documents))

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    documents,
    projects,
    workItems,
    teams,
    views,
    users,
  }
}

export function selectWorkItemDetailReadModel(
  snapshot: AppSnapshot,
  itemId: string
): ScopedReadModelPatch | null {
  const item = snapshot.workItems.find((entry) => entry.id === itemId) ?? null

  if (!item) {
    return null
  }

  const workspaceId = resolveSnapshotWorkItemWorkspaceId(snapshot, item)
  const workItems =
    (item.visibility ?? "team") === "private"
      ? workspaceId
        ? snapshot.workItems.filter(
            (candidate) =>
              (candidate.visibility ?? "team") === "private" &&
              candidate.creatorId === item.creatorId &&
              resolveSnapshotWorkItemWorkspaceId(snapshot, candidate) ===
                workspaceId
          )
        : [item]
      : snapshot.workItems.filter(
          (candidate) =>
            candidate.teamId === item.teamId &&
            (candidate.visibility ?? "team") === "team"
        )
  const comments = selectWorkItemComments(snapshot, itemId)
  const attachments = selectWorkItemAttachments(snapshot, itemId)
  const workItemActivities = selectWorkItemActivities(snapshot, [item.id])
  const linkedDocumentIds = new Set<string>([
    item.descriptionDocId,
    ...item.linkedDocumentIds,
    ...snapshot.documents
      .filter((document) => document.linkedWorkItemIds.includes(item.id))
      .map((document) => document.id),
  ])
  const documents = snapshot.documents
    .filter((document) => linkedDocumentIds.has(document.id))
    .map((document) =>
      document.id === item.descriptionDocId
        ? document
        : toDocumentPreviewEntry(document)
    )
  const relatedProjectIds = new Set<string>(
    [
      item.primaryProjectId,
      ...item.linkedProjectIds,
      ...workItems
        .filter(
          (candidate) =>
            candidate.id === item.id ||
            candidate.parentId === item.id ||
            item.parentId === candidate.id
        )
        .flatMap((candidate) => [
          candidate.primaryProjectId,
          ...candidate.linkedProjectIds,
        ]),
    ].filter((value): value is string => Boolean(value))
  )
  const detailTeamIds = new Set(compactStringIds([item.teamId]))
  const detailWorkItemIds = new Set(workItems.map((candidate) => candidate.id))
  const detailWorkspaceIds = new Set(workspaceId ? [workspaceId] : [])
  const projects = snapshot.projects.filter((project) => {
    if (relatedProjectIds.has(project.id)) {
      return true
    }

    return isProjectScopedToTeamOrWorkspaceIds(
      project,
      detailTeamIds,
      detailWorkspaceIds
    )
  })
  const milestones = selectMilestonesForProjects(snapshot, projects)
  const labels = selectLabelsForWorkspaceIds(snapshot, detailWorkspaceIds)
  const teamMemberships = snapshot.teamMemberships.filter(
    (membership) => item.teamId !== null && membership.teamId === item.teamId
  )
  const customPropertyDefinitions = selectCustomPropertyDefinitionsForTeamIds(
    snapshot,
    detailTeamIds,
    {
      includeTeam: (item.visibility ?? "team") !== "private",
    }
  )
  const customPropertyValues = selectCustomPropertyValuesForWorkItemIds(
    snapshot,
    detailWorkItemIds,
    customPropertyDefinitions
  )
  const users = selectUsers(snapshot, [
    item.creatorId,
    ...getWorkItemAssigneeIds(item),
    ...item.subscriberIds,
    ...teamMemberships.map((membership) => membership.userId),
    ...projects.flatMap((project) => [project.leadId, ...project.memberIds]),
    ...documents.flatMap((document) => [
      document.createdBy,
      document.updatedBy,
    ]),
    ...workItems.flatMap((candidate) => [
      candidate.creatorId,
      ...getWorkItemAssigneeIds(candidate),
      ...candidate.subscriberIds,
    ]),
    ...collectCustomPropertyValueUserIds(
      customPropertyDefinitions,
      customPropertyValues
    ),
    ...collectCommentUserIds(comments),
    ...collectAttachmentUserIds(attachments),
    ...collectWorkItemActivityUserIds(workItemActivities),
  ])

  return {
    workItems,
    workItemActivities,
    customPropertyDefinitions,
    customPropertyValues,
    labels,
    projects,
    milestones,
    documents,
    comments,
    attachments,
    teamMemberships,
    users,
  }
}

function selectMissingWorkItemDetailReadModel(
  snapshot: AppSnapshot,
  itemId: string
): ScopedReadModelPatch {
  return {
    workItems: snapshot.workItems.filter((entry) => entry.id === itemId),
    workItemActivities: selectWorkItemActivities(snapshot, [itemId]),
  }
}

export function selectProjectDetailReadModel(
  snapshot: AppSnapshot,
  projectId: string
): ScopedReadModelPatch | null {
  const project =
    snapshot.projects.find((entry) => entry.id === projectId) ?? null

  if (!project) {
    return null
  }

  const accessibleTeamIds = getAccessibleTeamIds(snapshot)
  const projectTeam =
    project.scopeType === "team"
      ? (snapshot.teams.find(
          (team) =>
            team.id === project.scopeId && accessibleTeamIds.has(team.id)
        ) ?? null)
      : null
  const inaccessibleTeamProject =
    project.scopeType === "team" && projectTeam === null

  if (inaccessibleTeamProject) {
    return null
  }

  const projectWorkspaceId =
    project.scopeType === "workspace"
      ? project.scopeId
      : (projectTeam?.workspaceId ?? null)
  const accessibleProjectTeamIds =
    project.scopeType === "workspace"
      ? new Set(
          selectAccessibleTeamsForScope(
            snapshot,
            "workspace",
            project.scopeId
          ).map((team) => team.id)
        )
      : accessibleTeamIds
  const items = snapshot.workItems.filter(
    (item) =>
      accessibleProjectTeamIds.has(item.teamId ?? "") &&
      (item.primaryProjectId === project.id ||
        item.linkedProjectIds.includes(project.id) ||
        (item.referencedProjectIds ?? []).includes(project.id))
  )
  const projectTeamIds = new Set(
    compactStringIds([
      ...items.map((item) => item.teamId),
      ...(projectTeam ? [projectTeam.id] : []),
    ])
  )
  const teams = snapshot.teams.filter((team) => projectTeamIds.has(team.id))
  const workspaceIds = new Set([
    ...(projectWorkspaceId ? [projectWorkspaceId] : []),
    ...teams.map((team) => team.workspaceId),
  ])
  const workspaces = snapshot.workspaces.filter((workspace) =>
    workspaceIds.has(workspace.id)
  )
  const projectWorkItemIds = new Set(items.map((item) => item.id))
  const customPropertyDefinitions = selectCustomPropertyDefinitionsForTeamIds(
    snapshot,
    projectTeamIds
  )
  const customPropertyValues = selectCustomPropertyValuesForWorkItemIds(
    snapshot,
    projectWorkItemIds,
    customPropertyDefinitions
  )
  const teamMemberships = snapshot.teamMemberships.filter((membership) =>
    projectTeamIds.has(membership.teamId)
  )
  const milestones = snapshot.milestones.filter(
    (milestone) => milestone.projectId === project.id
  )
  const updates = snapshot.projectUpdates.filter(
    (update) => update.projectId === project.id
  )
  const documents = snapshot.documents
    .filter(
      (document) =>
        document.kind !== "item-description" &&
        document.linkedProjectIds.includes(project.id)
    )
    .map(toDocumentPreviewEntry)
  const views = selectProjectViews(snapshot, project)
  const users = selectUsers(snapshot, [
    project.leadId,
    ...project.memberIds,
    ...teamMemberships.map((membership) => membership.userId),
    ...items.flatMap((item) => [
      item.creatorId,
      ...getWorkItemAssigneeIds(item),
      ...item.subscriberIds,
    ]),
    ...updates.map((update) => update.createdBy),
    ...documents.flatMap((document) => [
      document.createdBy,
      document.updatedBy,
    ]),
    ...collectViewUserIds(views),
    ...collectCustomPropertyValueUserIds(
      customPropertyDefinitions,
      customPropertyValues
    ),
  ])

  return {
    projects: [project],
    teams,
    workspaces,
    milestones,
    projectUpdates: updates as ProjectUpdate[],
    workItems: items,
    customPropertyDefinitions,
    customPropertyValues,
    documents,
    views,
    teamMemberships,
    users,
  }
}

function selectMissingProjectDetailReadModel(
  snapshot: AppSnapshot,
  projectId: string
): ScopedReadModelPatch {
  return {
    projects: snapshot.projects.filter((entry) => entry.id === projectId),
  }
}

export function selectProjectIndexReadModel(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace",
  scopeId: string
): ScopedReadModelPatch {
  const projects = selectProjectsForScope(snapshot, scopeType, scopeId)
  const projectIds = new Set(projects.map((project) => project.id))
  const accessibleTeamIds = new Set(
    selectAccessibleTeamsForScope(snapshot, scopeType, scopeId).map(
      (team) => team.id
    )
  )
  const workItems = snapshot.workItems.filter(
    (item) =>
      accessibleTeamIds.has(item.teamId ?? "") &&
      ((item.primaryProjectId && projectIds.has(item.primaryProjectId)) ||
        item.linkedProjectIds.some((projectId) => projectIds.has(projectId)))
  )
  const workItemIds = new Set(workItems.map((item) => item.id))
  const teams =
    scopeType === "workspace"
      ? selectAccessibleTeamsForScope(snapshot, scopeType, scopeId)
      : snapshot.teams.filter((team) => team.id === scopeId)
  const users = selectUsers(
    snapshot,
    projects.map((project) => project.leadId)
  )
  const customPropertyDefinitions = selectCustomPropertyDefinitionsForTeamIds(
    snapshot,
    new Set(compactStringIds(workItems.map((item) => item.teamId)))
  )
  const customPropertyValues = selectCustomPropertyValuesForWorkItemIds(
    snapshot,
    workItemIds,
    customPropertyDefinitions
  )
  const views = selectProjectIndexViews(snapshot, scopeType, scopeId)

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    projects,
    workItems,
    customPropertyDefinitions,
    customPropertyValues,
    teams,
    views,
    users,
  }
}

function selectWorkspaceMembershipReadModel(
  snapshot: AppSnapshot,
  requestedWorkspaceId: string
): ScopedReadModelPatch {
  const currentUser =
    snapshot.users.find((user) => user.id === snapshot.currentUserId) ?? null
  const accessibleWorkspaceIds = collectAccessibleWorkspaceIds(
    snapshot,
    snapshot.currentUserId
  )
  const { resolvedWorkspaceId, workspace } = selectResolvedWorkspace(
    snapshot,
    requestedWorkspaceId,
    accessibleWorkspaceIds
  )
  const workspaces = snapshot.workspaces.filter((entry) =>
    accessibleWorkspaceIds.has(entry.id)
  )
  const workspaceMemberships = snapshot.workspaceMemberships.filter(
    (membership) =>
      membership.workspaceId === resolvedWorkspaceId ||
      (membership.userId === snapshot.currentUserId &&
        accessibleWorkspaceIds.has(membership.workspaceId))
  )
  const teams = snapshot.teams.filter(
    (team) => team.workspaceId === resolvedWorkspaceId
  )
  const teamIds = new Set(teams.map((team) => team.id))
  const teamMemberships = snapshot.teamMemberships.filter((membership) =>
    teamIds.has(membership.teamId)
  )
  const invites = selectWorkspaceMembershipInvites(
    snapshot,
    resolvedWorkspaceId,
    currentUser?.email ?? null
  )
  const labels = snapshot.labels.filter(
    (label) => label.workspaceId === resolvedWorkspaceId
  )
  const users = selectWorkspaceMembershipUsers(snapshot, {
    currentUserId: snapshot.currentUserId,
    workspace,
    workspaceMemberships,
    teamMemberships,
    invites,
  })

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: resolvedWorkspaceId,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
    labels,
    users,
    invites,
  }
}

function selectChannelConversationsForWorkspace(
  snapshot: AppSnapshot,
  workspaceId: string
) {
  const workspaceTeamIds = new Set(
    snapshot.teams
      .filter((team) => team.workspaceId === workspaceId)
      .map((team) => team.id)
  )

  return selectConversationListConversations(
    snapshot,
    snapshot.currentUserId
  ).filter((conversation) => {
    if (conversation.kind !== "channel") {
      return false
    }

    if (conversation.scopeType === "workspace") {
      return conversation.scopeId === workspaceId
    }

    return workspaceTeamIds.has(conversation.scopeId)
  })
}

function selectCommentsForTargets(
  snapshot: AppSnapshot,
  input: {
    workItemIds: ReadonlySet<string>
    documentIds: ReadonlySet<string>
  }
) {
  return snapshot.comments.filter((comment) => {
    if (comment.targetType === "workItem") {
      return input.workItemIds.has(comment.targetId)
    }

    if (comment.targetType === "document") {
      return input.documentIds.has(comment.targetId)
    }

    return false
  })
}

function selectDocumentsForWorkspacePeople(
  snapshot: AppSnapshot,
  workspaceId: string
) {
  const accessibleTeamIds = new Set(
    selectAccessibleTeamsForScope(snapshot, "workspace", workspaceId).map(
      (team) => team.id
    )
  )

  return snapshot.documents.filter((document) => {
    if (document.workspaceId !== workspaceId) {
      return false
    }

    if (document.kind === "workspace-document") {
      return true
    }

    if (document.kind === "team-document") {
      return document.teamId ? accessibleTeamIds.has(document.teamId) : false
    }

    return (
      document.kind === "private-document" &&
      document.createdBy === snapshot.currentUserId
    )
  })
}

export function selectWorkspacePeopleReadModel(
  snapshot: AppSnapshot,
  workspaceId: string
): ScopedReadModelPatch | null {
  const accessibleWorkspaceIds = collectAccessibleWorkspaceIds(
    snapshot,
    snapshot.currentUserId
  )

  if (!accessibleWorkspaceIds.has(workspaceId)) {
    return null
  }

  const membership = selectWorkspaceMembershipReadModel(snapshot, workspaceId)
  const workItems = selectWorkItemsForScope(snapshot, "workspace", workspaceId)
  const workItemIds = new Set(workItems.map((item) => item.id))
  const documents = selectDocumentsForWorkspacePeople(
    snapshot,
    workspaceId
  ).map(toDocumentPreviewEntry)
  const documentIds = new Set(documents.map((document) => document.id))
  const comments = selectCommentsForTargets(snapshot, {
    workItemIds,
    documentIds,
  })
  const projects = selectProjectsForScope(snapshot, "workspace", workspaceId)
  const projectIds = new Set(projects.map((project) => project.id))
  const projectUpdates = snapshot.projectUpdates.filter((update) =>
    projectIds.has(update.projectId)
  )
  const conversations = selectChannelConversationsForWorkspace(
    snapshot,
    workspaceId
  )
  const conversationIds = new Set(
    conversations.map((conversation) => conversation.id)
  )
  const channelPosts = snapshot.channelPosts.filter((post) =>
    conversationIds.has(post.conversationId)
  )
  const channelPostComments = selectChannelPostCommentsForPosts(
    snapshot,
    channelPosts.map((post) => post.id)
  )
  const users = selectUsers(snapshot, [
    ...(membership.users ?? []).map((user) => user.id),
    ...collectWorkItemUserIds(workItems),
    ...collectDocumentUserIds(documents),
    ...collectCommentUserIds(comments),
    ...projects.flatMap((project) => [project.leadId, ...project.memberIds]),
    ...projectUpdates.map((update) => update.createdBy),
    ...collectConversationUserIds(conversations),
    ...collectChannelPostUserIds(channelPosts),
    ...collectChannelPostCommentUserIds(channelPostComments),
  ])

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    workspaces: membership.workspaces,
    workspaceMemberships: membership.workspaceMemberships,
    teams: membership.teams,
    teamMemberships: membership.teamMemberships,
    users,
    workItems,
    documents,
    comments,
    projects,
    projectUpdates,
    conversations,
    channelPosts,
    channelPostComments,
  }
}

export function selectWorkIndexReadModel(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
): ScopedReadModelPatch {
  const workItems = selectWorkItemsForScope(snapshot, scopeType, scopeId)
  const workItemIds = new Set(workItems.map((item) => item.id))
  const teams = selectAccessibleTeamsForScope(snapshot, scopeType, scopeId)
  const teamIds = new Set(teams.map((team) => team.id))
  const workspaceIds = new Set(teams.map((team) => team.workspaceId))
  const teamMemberships = snapshot.teamMemberships.filter((membership) =>
    teamIds.has(membership.teamId)
  )
  const workspaceMemberships = snapshot.workspaceMemberships.filter(
    (membership) =>
      workspaceIds.has(membership.workspaceId) &&
      membership.userId === snapshot.currentUserId
  )
  const workspaces = snapshot.workspaces.filter((workspace) =>
    workspaceIds.has(workspace.id)
  )
  const projects = snapshot.projects.filter((project) =>
    isProjectScopedToTeamOrWorkspaceIds(project, teamIds, workspaceIds)
  )
  const milestones = selectMilestonesForProjects(snapshot, projects)
  const labels = selectLabelsForWorkspaceIds(snapshot, workspaceIds)
  const views = selectWorkIndexViews(snapshot, scopeType, scopeId)
  const customPropertyDefinitions = selectCustomPropertyDefinitionsForTeamIds(
    snapshot,
    teamIds
  )
  const customPropertyValues = selectCustomPropertyValuesForWorkItemIds(
    snapshot,
    workItemIds,
    customPropertyDefinitions
  )
  const users = selectUsers(snapshot, [
    ...collectWorkItemUserIds(workItems),
    ...teamMemberships.map((membership) => membership.userId),
    ...projects.flatMap((project) => [project.leadId, ...project.memberIds]),
    ...collectViewUserIds(views),
    ...collectCustomPropertyValueUserIds(
      customPropertyDefinitions,
      customPropertyValues
    ),
  ])

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
    users,
    labels,
    projects,
    milestones,
    workItems,
    customPropertyDefinitions,
    customPropertyValues,
    views,
  }
}

export function selectViewCatalogReadModel(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace",
  scopeId: string
): ScopedReadModelPatch {
  const views = selectViewCatalogViews(snapshot, scopeType, scopeId)
  const teams =
    scopeType === "workspace"
      ? selectAccessibleTeamsForScope(snapshot, "workspace", scopeId)
      : snapshot.teams.filter((team) => team.id === scopeId)
  const teamIds = new Set(teams.map((team) => team.id))
  const workspaceIds =
    scopeType === "workspace"
      ? new Set([scopeId])
      : new Set(teams.map((team) => team.workspaceId))
  const workspaces = snapshot.workspaces.filter((workspace) =>
    workspaceIds.has(workspace.id)
  )
  const workspaceMemberships = snapshot.workspaceMemberships.filter(
    (membership) =>
      workspaceIds.has(membership.workspaceId) &&
      membership.userId === snapshot.currentUserId
  )
  const teamMemberships = snapshot.teamMemberships.filter((membership) =>
    teamIds.has(membership.teamId)
  )

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
    customPropertyDefinitions: selectCustomPropertyDefinitionsForTeamIds(
      snapshot,
      teamIds
    ),
    views,
  }
}

export function selectNotificationInboxReadModel(
  snapshot: AppSnapshot,
  userId: string
): ScopedReadModelPatch {
  const notifications = snapshot.notifications.filter(
    (notification) =>
      notification.userId === userId &&
      shouldShowNotificationInInbox(notification)
  )
  const invites = snapshot.invites.filter((invite) =>
    notifications.some(
      (notification) =>
        notification.entityType === "invite" &&
        notification.entityId === invite.id
    )
  )
  const conversationIds = new Set(
    notifications
      .filter((notification) => notification.entityType === "chat")
      .map((notification) => notification.entityId)
  )
  const postIds = new Set(
    notifications
      .filter((notification) => notification.entityType === "channelPost")
      .map((notification) => notification.entityId)
  )
  const projectIds = new Set(
    notifications
      .filter((notification) => notification.entityType === "project")
      .map((notification) => notification.entityId)
  )
  const conversations = snapshot.conversations.filter((conversation) =>
    conversationIds.has(conversation.id)
  )
  const channelPosts = snapshot.channelPosts.filter((post) =>
    postIds.has(post.id)
  )
  const projects = snapshot.projects.filter((project) =>
    projectIds.has(project.id)
  )
  const channelPostConversations = getChannelPostConversations(
    snapshot,
    channelPosts
  )
  const workspaceIds = new Set<string>([
    ...invites.map((invite) => invite.workspaceId),
    ...getScopedConversationIds(conversations, "workspace"),
    ...projects
      .filter((project) => project.scopeType === "workspace")
      .map((project) => project.scopeId),
    ...getScopedConversationIds(channelPostConversations, "workspace"),
  ])
  const teamIds = new Set<string>([
    ...invites.map((invite) => invite.teamId),
    ...getScopedConversationIds(conversations, "team"),
    ...projects
      .filter((project) => project.scopeType === "team")
      .map((project) => project.scopeId),
    ...getScopedConversationIds(channelPostConversations, "team"),
  ])
  const workspaces = snapshot.workspaces.filter((workspace) =>
    workspaceIds.has(workspace.id)
  )
  const teams = snapshot.teams.filter((team) => teamIds.has(team.id))
  const users = selectUsers(snapshot, [
    ...collectNotificationUserIds(notifications),
    ...invites.map((invite) => invite.invitedBy),
    ...collectConversationUserIds(conversations),
    ...channelPosts.map((post) => post.createdBy),
    ...projects.flatMap((project) => [project.leadId, ...project.memberIds]),
  ])

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    workspaces,
    teams,
    users,
    notifications,
    invites,
    conversations,
    channelPosts,
    projects,
  }
}

export function selectConversationListReadModel(
  snapshot: AppSnapshot,
  userId: string
): ScopedReadModelPatch {
  const conversations = selectConversationListConversations(snapshot, userId)
  const chatConversationIds = conversations
    .filter((conversation) => conversation.kind === "chat")
    .map((conversation) => conversation.id)
  const teams = snapshot.teams.filter((team) => {
    const hasConversation = conversations.some(
      (conversation) =>
        conversation.scopeType === "team" && conversation.scopeId === team.id
    )

    if (hasConversation) {
      return true
    }

    return snapshot.teamMemberships.some(
      (membership) =>
        membership.teamId === team.id && membership.userId === userId
    )
  })
  const workspaces = selectWorkspaceOwnersForTeams(snapshot, teams)
  const workspaceMemberships = selectWorkspaceMembershipRecordsForTeams(
    snapshot,
    teams
  )
  const teamMemberships = snapshot.teamMemberships.filter((membership) =>
    teams.some((team) => team.id === membership.teamId)
  )
  const users = selectUsers(
    snapshot,
    compactStringIds([
      ...collectConversationUserIds(conversations),
      ...collectChatMessageUserIds(
        selectChatMessagesForConversations(snapshot, chatConversationIds)
      ),
      ...teamMemberships.map((membership) => membership.userId),
      ...workspaces.map((workspace) => workspace.createdBy),
    ])
  )

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
    users,
    conversations,
    chatMessages: selectChatMessagesForConversations(
      snapshot,
      chatConversationIds
    ),
    chatReadStates: selectChatReadStatesForConversations(
      snapshot,
      userId,
      chatConversationIds
    ),
  }
}

function selectConversationScopeTeams(
  snapshot: AppSnapshot,
  conversation: Conversation
) {
  return conversation.scopeType === "team"
    ? snapshot.teams.filter((team) => team.id === conversation.scopeId)
    : snapshot.teams.filter((team) => team.workspaceId === conversation.scopeId)
}

function selectConversationScopeWorkspaces(
  snapshot: AppSnapshot,
  conversation: Conversation,
  teams: Team[]
) {
  return conversation.scopeType === "workspace"
    ? snapshot.workspaces.filter(
        (workspace) => workspace.id === conversation.scopeId
      )
    : selectWorkspaceOwnersForTeams(snapshot, teams)
}

function selectTeamMembershipsForTeams(snapshot: AppSnapshot, teams: Team[]) {
  const teamIds = new Set(teams.map((team) => team.id))

  return snapshot.teamMemberships.filter((membership) =>
    teamIds.has(membership.teamId)
  )
}

function buildConversationScopeReadModel(input: {
  snapshot: AppSnapshot
  conversation: Conversation
  teams: Team[]
  workspaces: Workspace[]
  teamMemberships: TeamMembership[]
  userIds: Iterable<string | null | undefined>
  extra: ScopedReadModelPatch
}): ScopedReadModelPatch {
  return {
    currentUserId: input.snapshot.currentUserId,
    currentWorkspaceId: input.snapshot.currentWorkspaceId,
    workspaces: input.workspaces,
    workspaceMemberships: selectWorkspaceMembershipRecordsForTeams(
      input.snapshot,
      input.teams
    ),
    teams: input.teams,
    teamMemberships: input.teamMemberships,
    users: selectUsers(
      input.snapshot,
      compactStringIds([
        ...input.userIds,
        ...input.teamMemberships.map((membership) => membership.userId),
        ...input.workspaces.map((workspace) => workspace.createdBy),
      ])
    ),
    conversations: [input.conversation],
    ...input.extra,
  }
}

function resolveConversationScope(
  snapshot: AppSnapshot,
  conversationId: string,
  kind: Conversation["kind"]
) {
  const conversation =
    snapshot.conversations.find((entry) => entry.id === conversationId) ?? null

  if (!conversation || conversation.kind !== kind) {
    return null
  }

  const teams = selectConversationScopeTeams(snapshot, conversation)
  const workspaces = selectConversationScopeWorkspaces(
    snapshot,
    conversation,
    teams
  )

  return {
    conversation,
    teams,
    workspaces,
    teamMemberships: selectTeamMembershipsForTeams(snapshot, teams),
  }
}

export function selectConversationThreadReadModel(
  snapshot: AppSnapshot,
  conversationId: string
): ScopedReadModelPatch | null {
  const scope = resolveConversationScope(snapshot, conversationId, "chat")

  if (!scope) {
    return null
  }

  const messages = snapshot.chatMessages.filter(
    (message) =>
      message.conversationId === conversationId &&
      isChatMessageVisibleToCurrentUser(snapshot, message)
  )
  const calls = snapshot.calls.filter(
    (call) => call.conversationId === conversationId
  )

  return buildConversationScopeReadModel({
    snapshot,
    ...scope,
    userIds: [
      ...collectConversationUserIds([scope.conversation]),
      ...collectChatMessageUserIds(messages),
      ...collectCallUserIds(calls),
    ],
    extra: {
      calls,
      chatMessages: messages,
      chatReadStates: selectChatReadStatesForConversationThread(
        snapshot,
        snapshot.currentUserId,
        [conversationId]
      ),
    },
  })
}

export function selectChannelFeedReadModel(
  snapshot: AppSnapshot,
  conversationId: string
): ScopedReadModelPatch | null {
  const scope = resolveConversationScope(snapshot, conversationId, "channel")

  if (!scope) {
    return null
  }

  const posts = snapshot.channelPosts.filter(
    (post) => post.conversationId === conversationId
  )
  const comments = selectChannelPostCommentsForPosts(
    snapshot,
    posts.map((post) => post.id)
  )

  return buildConversationScopeReadModel({
    snapshot,
    ...scope,
    userIds: [
      ...collectConversationUserIds([scope.conversation]),
      ...collectChannelPostUserIds(posts),
      ...collectChannelPostCommentUserIds(comments),
    ],
    extra: {
      channelPosts: posts,
      channelPostComments: comments,
    },
  })
}

export function selectSearchSeedReadModel(
  snapshot: AppSnapshot,
  workspaceId: string
): ScopedReadModelPatch {
  const teams = selectAccessibleTeamsForScope(
    snapshot,
    "workspace",
    workspaceId
  )
  const teamIds = new Set(teams.map((team) => team.id))
  const workItems = selectWorkItemsForScope(snapshot, "workspace", workspaceId)
  const projects = selectProjectsForScope(snapshot, "workspace", workspaceId)
  const documents = selectDocumentsForScope(
    snapshot,
    "workspace",
    workspaceId
  ).map(toDocumentPreviewEntry)
  const workspaces = snapshot.workspaces.filter(
    (workspace) => workspace.id === workspaceId
  )
  const workspaceMemberships = snapshot.workspaceMemberships.filter(
    (membership) => membership.workspaceId === workspaceId
  )
  const teamMemberships = snapshot.teamMemberships.filter((membership) =>
    teamIds.has(membership.teamId)
  )
  const users = selectUsers(
    snapshot,
    compactStringIds([
      ...teamMemberships.map((membership) => membership.userId),
      ...workspaceMemberships.map((membership) => membership.userId),
      ...collectWorkItemUserIds(workItems),
      ...projects.flatMap((project) => [project.leadId, ...project.memberIds]),
      ...collectDocumentUserIds(documents),
      ...workspaces.map((workspace) => workspace.createdBy),
    ])
  )

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
    users,
    projects,
    documents,
    workItems,
  }
}

const readModelSelectors = {
  "document-detail": (snapshot, instruction) =>
    selectDocumentDetailReadModel(snapshot, instruction.documentId),
  "missing-document-detail": (snapshot, instruction) =>
    selectMissingDocumentDetailReadModel(snapshot, instruction.documentId),
  "document-index": (snapshot, instruction) =>
    selectDocumentIndexReadModel(
      snapshot,
      instruction.scopeType,
      instruction.scopeId
    ),
  "work-item-detail": (snapshot, instruction) =>
    selectWorkItemDetailReadModel(snapshot, instruction.itemId),
  "missing-work-item-detail": (snapshot, instruction) =>
    selectMissingWorkItemDetailReadModel(snapshot, instruction.itemId),
  "work-index": (snapshot, instruction) =>
    selectWorkIndexReadModel(
      snapshot,
      instruction.scopeType,
      instruction.scopeId
    ),
  "project-detail": (snapshot, instruction) =>
    selectProjectDetailReadModel(snapshot, instruction.projectId),
  "missing-project-detail": (snapshot, instruction) =>
    selectMissingProjectDetailReadModel(snapshot, instruction.projectId),
  "project-index": (snapshot, instruction) =>
    selectProjectIndexReadModel(
      snapshot,
      instruction.scopeType,
      instruction.scopeId
    ),
  "workspace-membership": (snapshot, instruction) =>
    selectWorkspaceMembershipReadModel(snapshot, instruction.workspaceId),
  "workspace-people": (snapshot, instruction) =>
    selectWorkspacePeopleReadModel(snapshot, instruction.workspaceId),
  "view-catalog": (snapshot, instruction) =>
    selectViewCatalogReadModel(
      snapshot,
      instruction.scopeType,
      instruction.scopeId
    ),
  "notification-inbox": (snapshot, instruction) =>
    selectNotificationInboxReadModel(snapshot, instruction.userId),
  "conversation-list": (snapshot, instruction) =>
    selectConversationListReadModel(snapshot, instruction.userId),
  "conversation-thread": (snapshot, instruction) =>
    selectConversationThreadReadModel(snapshot, instruction.conversationId),
  "channel-feed": (snapshot, instruction) =>
    selectChannelFeedReadModel(snapshot, instruction.conversationId),
  "search-seed": (snapshot, instruction) =>
    selectSearchSeedReadModel(snapshot, instruction.workspaceId),
} satisfies {
  [TKind in ScopedReadModelReplaceKind]: ScopedReadModelSelector<TKind>
}

export function selectReadModelForInstruction(
  snapshot: AppSnapshot,
  instruction: ScopedReadModelReplaceInstruction
): ScopedReadModelPatch | null {
  const selectReadModel = readModelSelectors[instruction.kind] as (
    snapshot: AppSnapshot,
    instruction: ScopedReadModelReplaceInstruction
  ) => ScopedReadModelPatch | null

  return selectReadModel(snapshot, instruction)
}

export function getDocumentDetailScopeKeys(documentId: string) {
  return [createDocumentDetailScopeKey(documentId)]
}

export function getDocumentIndexScopeKeys(
  scopeType: "team" | "workspace",
  scopeId: string,
  currentUserId?: string | null
) {
  const scopeKeys = [
    createDocumentIndexScopeKey(
      createScopedCollectionScopeId(scopeType, scopeId)
    ),
  ]

  if (scopeType === "workspace" && currentUserId) {
    scopeKeys.push(...getPrivateDocumentIndexScopeKeys(scopeId, currentUserId))
  }

  return scopeKeys
}

export function getPrivateDocumentIndexScopeKeys(
  workspaceId: string,
  userId: string
) {
  return [createPrivateDocumentIndexScopeKey(workspaceId, userId)]
}

function addDocumentIndexScopeKeyForDocument(
  scopeKeys: Set<string>,
  document: Document
) {
  if (document.kind === "item-description") {
    return
  }

  if (document.kind === "private-document") {
    scopeKeys.add(
      createPrivateDocumentIndexScopeKey(
        document.workspaceId,
        document.createdBy
      )
    )
    return
  }

  const scopeType = document.kind === "team-document" ? "team" : "workspace"
  const scopeId =
    document.kind === "team-document" ? document.teamId : document.workspaceId

  if (!scopeId) {
    return
  }

  scopeKeys.add(
    createDocumentIndexScopeKey(
      createScopedCollectionScopeId(scopeType, scopeId)
    )
  )
}

function addLinkedDocumentIndexScopeKeys(
  snapshot: AppSnapshot,
  scopeKeys: Set<string>,
  isLinkedDocument: (document: Document) => boolean
) {
  for (const document of snapshot.documents) {
    if (isLinkedDocument(document)) {
      addDocumentIndexScopeKeyForDocument(scopeKeys, document)
    }
  }
}

export function getDocumentRelatedScopeKeys(
  snapshot: AppSnapshot,
  documentId: string
) {
  const document =
    snapshot.documents.find((entry) => entry.id === documentId) ?? null
  const scopeKeys = new Set<string>([createDocumentDetailScopeKey(documentId)])

  if (!document || document.kind === "item-description") {
    return [...scopeKeys]
  }

  if (document.kind === "private-document") {
    scopeKeys.add(
      createPrivateDocumentIndexScopeKey(
        document.workspaceId,
        document.createdBy
      )
    )
    scopeKeys.add(
      createPrivateSearchSeedScopeKey(document.workspaceId, document.createdBy)
    )
    if (document.createdBy === snapshot.currentUserId) {
      scopeKeys.add(createWorkspacePeopleScopeKey(document.workspaceId))
    }
    return [...scopeKeys]
  }

  for (const scopeKey of getDocumentIndexScopeKeys(
    document.kind === "team-document" ? "team" : "workspace",
    document.kind === "team-document"
      ? (document.teamId ?? "")
      : document.workspaceId
  )) {
    scopeKeys.add(scopeKey)
  }

  scopeKeys.add(createSearchSeedScopeKey(document.workspaceId))
  scopeKeys.add(createWorkspacePeopleScopeKey(document.workspaceId))

  return [...scopeKeys]
}

function buildWorkspaceMembershipScopeKeys(workspaceIds: Iterable<string>) {
  const scopeKeys = new Set<string>()

  for (const workspaceId of workspaceIds) {
    if (!workspaceId) {
      continue
    }

    scopeKeys.add(createWorkspaceMembershipScopeKey(workspaceId))
    scopeKeys.add(createWorkspacePeopleScopeKey(workspaceId))
    scopeKeys.add(createSearchSeedScopeKey(workspaceId))
  }

  return [...scopeKeys]
}

export function getWorkspaceMembershipScopeKeys(workspaceId: string) {
  return buildWorkspaceMembershipScopeKeys([workspaceId])
}

export function getWorkspacePeopleScopeKeys(workspaceId: string) {
  return [createWorkspacePeopleScopeKey(workspaceId)]
}

export function getProjectIndexScopeKeys(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return [
    createProjectIndexScopeKey(
      createScopedCollectionScopeId(scopeType, scopeId)
    ),
  ]
}

export function getProjectRelatedScopeKeys(
  snapshot: AppSnapshot,
  projectId: string
) {
  const project =
    snapshot.projects.find((entry) => entry.id === projectId) ?? null
  const scopeKeys = new Set<string>([createProjectDetailScopeKey(projectId)])

  addLinkedDocumentIndexScopeKeys(snapshot, scopeKeys, (document) =>
    document.linkedProjectIds.includes(projectId)
  )

  if (
    !project ||
    (project.scopeType !== "team" && project.scopeType !== "workspace")
  ) {
    return [...scopeKeys]
  }

  for (const scopeKey of getProjectIndexScopeKeys(
    project.scopeType,
    project.scopeId
  )) {
    scopeKeys.add(scopeKey)
  }

  if (project.scopeType === "workspace") {
    scopeKeys.add(createWorkspacePeopleScopeKey(project.scopeId))
    scopeKeys.add(createSearchSeedScopeKey(project.scopeId))
  } else {
    const team =
      snapshot.teams.find((entry) => entry.id === project.scopeId) ?? null

    if (team) {
      scopeKeys.add(createWorkspacePeopleScopeKey(team.workspaceId))
      scopeKeys.add(createSearchSeedScopeKey(team.workspaceId))
    }
  }

  return [...scopeKeys]
}

export function getWorkIndexScopeKeys(
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
) {
  return [
    createWorkIndexScopeKey(createScopedCollectionScopeId(scopeType, scopeId)),
  ]
}

function addCustomPropertyWorkspaceScopeKeys(
  snapshot: AppSnapshot,
  teamId: string,
  scopeKeys: Set<string>
) {
  const team = snapshot.teams.find((entry) => entry.id === teamId) ?? null

  if (!team) {
    return
  }

  addScopeKeys(scopeKeys, getWorkIndexScopeKeys("workspace", team.workspaceId))
  addScopeKeys(
    scopeKeys,
    getViewCatalogScopeKeys("workspace", team.workspaceId)
  )
  addScopeKeys(
    scopeKeys,
    getProjectIndexScopeKeys("workspace", team.workspaceId)
  )
}

function collectWorkItemProjectIds(item: AppSnapshot["workItems"][number]) {
  return [item.primaryProjectId, ...item.linkedProjectIds].filter(
    (projectId): projectId is string => Boolean(projectId)
  )
}

function collectCustomPropertyTeamProjectIds(
  snapshot: AppSnapshot,
  teamId: string,
  scopeKeys: Set<string>
) {
  const projectIds = new Set<string>()

  for (const item of snapshot.workItems) {
    if (item.teamId !== teamId) {
      continue
    }

    scopeKeys.add(createWorkItemDetailScopeKey(item.id))
    for (const projectId of collectWorkItemProjectIds(item)) {
      projectIds.add(projectId)
    }
  }

  return projectIds
}

function addCustomPropertyProjectScopeKeys(
  snapshot: AppSnapshot,
  projectIds: Iterable<string>,
  scopeKeys: Set<string>
) {
  for (const projectId of projectIds) {
    const project =
      snapshot.projects.find((entry) => entry.id === projectId) ?? null

    if (!project) {
      continue
    }

    scopeKeys.add(createProjectDetailScopeKey(project.id))
    addScopeKeys(
      scopeKeys,
      getProjectIndexScopeKeys(project.scopeType, project.scopeId)
    )
  }
}

function addTeamMemberPersonalWorkScopeKeys(
  snapshot: AppSnapshot,
  teamId: string,
  scopeKeys: Set<string>
) {
  for (const membership of snapshot.teamMemberships) {
    if (membership.teamId === teamId) {
      addScopeKeys(
        scopeKeys,
        getWorkIndexScopeKeys("personal", membership.userId)
      )
    }
  }
}

export function getCustomPropertyDefinitionScopeKeys(
  snapshot: AppSnapshot,
  teamId: string
) {
  const scopeKeys = new Set<string>([
    ...getWorkIndexScopeKeys("team", teamId),
    ...getViewCatalogScopeKeys("team", teamId),
  ])
  const projectIds = collectCustomPropertyTeamProjectIds(
    snapshot,
    teamId,
    scopeKeys
  )

  addCustomPropertyWorkspaceScopeKeys(snapshot, teamId, scopeKeys)
  addCustomPropertyProjectScopeKeys(snapshot, projectIds, scopeKeys)
  addTeamMemberPersonalWorkScopeKeys(snapshot, teamId, scopeKeys)

  return [...scopeKeys]
}

export function getViewCatalogScopeKeys(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return [
    createViewCatalogScopeKey(
      createScopedCollectionScopeId(scopeType, scopeId)
    ),
  ]
}

export function getUserWorkspaceMembershipScopeKeys(
  snapshot: AppSnapshot,
  userId: string
) {
  return buildWorkspaceMembershipScopeKeys(
    collectAccessibleWorkspaceIds(snapshot, userId)
  )
}

function addWorkItemProjectRelatedScopeKeys(
  snapshot: AppSnapshot,
  item: AppSnapshot["workItems"][number],
  scopeKeys: Set<string>
) {
  for (const projectId of compactStringIds([
    item.primaryProjectId,
    ...item.linkedProjectIds,
  ])) {
    addScopeKeys(scopeKeys, getProjectRelatedScopeKeys(snapshot, projectId))
  }
}

function addPrivateWorkItemRelatedScopeKeys(
  item: AppSnapshot["workItems"][number],
  scopeKeys: Set<string>
) {
  if ((item.visibility ?? "team") !== "private") {
    return false
  }

  addScopeKeys(scopeKeys, getWorkIndexScopeKeys("personal", item.creatorId))

  if (item.workspaceId) {
    scopeKeys.add(
      createPrivateSearchSeedScopeKey(item.workspaceId, item.creatorId)
    )
  }

  return true
}

function addWorkItemTeamRelatedScopeKeys(
  snapshot: AppSnapshot,
  item: AppSnapshot["workItems"][number],
  scopeKeys: Set<string>
) {
  if (addPrivateWorkItemRelatedScopeKeys(item, scopeKeys)) {
    return
  }

  if (!item.teamId) {
    return
  }

  addScopeKeys(scopeKeys, getWorkIndexScopeKeys("team", item.teamId))

  const team = snapshot.teams.find((entry) => entry.id === item.teamId) ?? null

  if (team) {
    scopeKeys.add(createWorkspacePeopleScopeKey(team.workspaceId))
    scopeKeys.add(createSearchSeedScopeKey(team.workspaceId))
  }
}

function addExistingWorkItemDetailScopeKeys(
  snapshot: AppSnapshot,
  item: AppSnapshot["workItems"][number],
  scopeKeys: Set<string>
) {
  if (addPrivateWorkItemRelatedScopeKeys(item, scopeKeys)) {
    return
  }

  if (!item.teamId) {
    return
  }

  addWorkItemProjectRelatedScopeKeys(snapshot, item, scopeKeys)
  addWorkItemTeamRelatedScopeKeys(snapshot, item, scopeKeys)
  addTeamMemberPersonalWorkScopeKeys(snapshot, item.teamId, scopeKeys)
}

export function getWorkItemDetailScopeKeys(
  snapshot: AppSnapshot,
  itemId: string
) {
  const item = snapshot.workItems.find((entry) => entry.id === itemId) ?? null
  const scopeKeys = new Set<string>([createWorkItemDetailScopeKey(itemId)])

  addLinkedDocumentIndexScopeKeys(snapshot, scopeKeys, (document) =>
    document.linkedWorkItemIds.includes(itemId)
  )

  if (!item) {
    return [...scopeKeys]
  }

  addExistingWorkItemDetailScopeKeys(snapshot, item, scopeKeys)

  return [...scopeKeys]
}

export function getProjectDetailScopeKeys(projectId: string) {
  return [createProjectDetailScopeKey(projectId)]
}

export function getNotificationInboxScopeKeys(userId: string) {
  return [createNotificationInboxScopeKey(userId)]
}

export function getConversationListScopeKeys(userId: string) {
  return [createConversationListScopeKey(userId)]
}

export function getConversationThreadScopeKeys(conversationId: string) {
  return [createConversationThreadScopeKey(conversationId)]
}

export function getChannelFeedScopeKeys(conversationId: string) {
  return [createChannelFeedScopeKey(conversationId)]
}

export function getSearchSeedScopeKeys(
  workspaceId: string,
  currentUserId?: string | null
) {
  const scopeKeys = [createSearchSeedScopeKey(workspaceId)]

  if (currentUserId) {
    scopeKeys.push(...getPrivateSearchSeedScopeKeys(workspaceId, currentUserId))
  }

  return scopeKeys
}

export function getPrivateSearchSeedScopeKeys(
  workspaceId: string,
  userId: string
) {
  return [createPrivateSearchSeedScopeKey(workspaceId, userId)]
}

function addScopeKeys(target: Set<string>, keys: Iterable<string>) {
  for (const scopeKey of keys) {
    target.add(scopeKey)
  }
}

function getWorkspaceRouteScopeId(snapshot: AppSnapshot, route: string) {
  return route.startsWith("/workspace/") ? snapshot.currentWorkspaceId : null
}

function isSharedViewScope(
  view: ViewDefinition
): view is ViewDefinition & { scopeType: "team" | "workspace" } {
  return view.scopeType === "team" || view.scopeType === "workspace"
}

function addViewCatalogScopeKeys(
  target: Set<string>,
  snapshot: AppSnapshot,
  view: ViewDefinition
) {
  if (isSharedViewScope(view)) {
    addScopeKeys(target, getViewCatalogScopeKeys(view.scopeType, view.scopeId))
    return
  }

  const workspaceId = getWorkspaceRouteScopeId(snapshot, view.route)

  if (workspaceId) {
    addScopeKeys(target, getViewCatalogScopeKeys("workspace", workspaceId))
  }
}

function getViewEntityIndexScope(
  snapshot: AppSnapshot,
  view: ViewDefinition
): { scopeType: "team" | "workspace"; scopeId: string } | null {
  if (isSharedViewScope(view)) {
    return {
      scopeType: view.scopeType,
      scopeId: view.scopeId,
    }
  }

  const workspaceId = getWorkspaceRouteScopeId(snapshot, view.route)

  return workspaceId
    ? {
        scopeType: "workspace",
        scopeId: workspaceId,
      }
    : null
}

function getViewEntityIndexScopeKeys(
  snapshot: AppSnapshot,
  view: ViewDefinition
) {
  const scope = getViewEntityIndexScope(snapshot, view)

  if (!scope) {
    return []
  }

  const scopeKeyFactories: Partial<
    Record<
      ViewDefinition["entityKind"],
      (scopeType: "team" | "workspace", scopeId: string) => string[]
    >
  > = {
    docs: getDocumentIndexScopeKeys,
    projects: getProjectIndexScopeKeys,
  }
  const createScopeKeys = scopeKeyFactories[view.entityKind]

  return createScopeKeys ? createScopeKeys(scope.scopeType, scope.scopeId) : []
}

function addViewEntityScopeKeys(
  target: Set<string>,
  snapshot: AppSnapshot,
  view: ViewDefinition
) {
  addScopeKeys(target, getViewEntityIndexScopeKeys(snapshot, view))
}

function addViewWorkIndexScopeKeys(target: Set<string>, view: ViewDefinition) {
  if (view.entityKind === "items") {
    const scopeType = isSharedViewScope(view) ? view.scopeType : "personal"
    addScopeKeys(target, getWorkIndexScopeKeys(scopeType, view.scopeId))
  }
}

export function getViewRelatedScopeKeys(snapshot: AppSnapshot, viewId: string) {
  const view = snapshot.views.find((entry) => entry.id === viewId) ?? null
  const scopeKeys = new Set<string>()

  if (!view || view.containerType) {
    return []
  }

  addViewCatalogScopeKeys(scopeKeys, snapshot, view)
  addViewWorkIndexScopeKeys(scopeKeys, view)

  addViewEntityScopeKeys(scopeKeys, snapshot, view)

  return [...scopeKeys]
}

function collectConversationScopeUserIds(
  snapshot: AppSnapshot,
  conversation: Conversation
) {
  if (conversation.scopeType === "team") {
    return snapshot.teamMemberships
      .filter((membership) => membership.teamId === conversation.scopeId)
      .map((membership) => membership.userId)
  }

  if (conversation.kind === "channel") {
    const teamIds = snapshot.teams
      .filter((team) => team.workspaceId === conversation.scopeId)
      .map((team) => team.id)
    const userIds = new Set<string>(
      compactStringIds([
        ...snapshot.workspaceMemberships
          .filter(
            (membership) => membership.workspaceId === conversation.scopeId
          )
          .map((membership) => membership.userId),
        ...snapshot.teamMemberships
          .filter((membership) => teamIds.includes(membership.teamId))
          .map((membership) => membership.userId),
        ...snapshot.workspaces
          .filter((workspace) => workspace.id === conversation.scopeId)
          .map((workspace) => workspace.createdBy),
      ])
    )

    return [...userIds]
  }

  return conversation.participantIds
}

export function getConversationRelatedScopeKeys(
  snapshot: AppSnapshot,
  conversationId: string
) {
  const conversation =
    snapshot.conversations.find((entry) => entry.id === conversationId) ?? null
  const scopeKeys = new Set<string>()

  if (!conversation) {
    return []
  }

  for (const userId of collectConversationScopeUserIds(
    snapshot,
    conversation
  )) {
    scopeKeys.add(createConversationListScopeKey(userId))
    scopeKeys.add(createNotificationInboxScopeKey(userId))
  }

  if (conversation.kind === "chat") {
    scopeKeys.add(createConversationThreadScopeKey(conversation.id))
  } else {
    scopeKeys.add(createChannelFeedScopeKey(conversation.id))
    if (conversation.scopeType === "workspace") {
      scopeKeys.add(createWorkspacePeopleScopeKey(conversation.scopeId))
    } else {
      const team =
        snapshot.teams.find((entry) => entry.id === conversation.scopeId) ??
        null

      if (team) {
        scopeKeys.add(createWorkspacePeopleScopeKey(team.workspaceId))
      }
    }
  }

  return [...scopeKeys]
}

export function getChannelPostRelatedScopeKeys(
  snapshot: AppSnapshot,
  postId: string
) {
  const post =
    snapshot.channelPosts.find((entry) => entry.id === postId) ?? null

  if (!post) {
    return []
  }

  return getConversationRelatedScopeKeys(snapshot, post.conversationId)
}

export function getChatMessageRelatedScopeKeys(
  snapshot: AppSnapshot,
  messageId: string
) {
  const message =
    snapshot.chatMessages.find((entry) => entry.id === messageId) ?? null

  if (!message) {
    return []
  }

  return getConversationRelatedScopeKeys(snapshot, message.conversationId)
}
