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
  UserProfile,
  ViewDefinition,
  WorkItem,
  Workspace,
  WorkspaceMembership,
} from "@/lib/domain/types"

import {
  createChannelFeedScopeKey,
  createConversationListScopeKey,
  createConversationThreadScopeKey,
  createDocumentDetailScopeKey,
  createDocumentIndexScopeKey,
  createNotificationInboxScopeKey,
  createProjectDetailScopeKey,
  createProjectIndexScopeKey,
  createScopedCollectionScopeId,
  createSearchSeedScopeKey,
  createShellContextScopeKey,
  createViewCatalogScopeKey,
  createWorkIndexScopeKey,
  createWorkItemDetailScopeKey,
  createWorkspaceMembershipScopeKey,
} from "./scope-keys"

export type ScopedReadModelPatch = Partial<AppSnapshot>

export type ScopedReadModelReplaceInstruction =
  | {
      kind: "document-detail"
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
      kind: "work-index"
      scopeType: "team" | "workspace" | "personal"
      scopeId: string
    }
  | {
      kind: "project-detail"
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
    (comment) => comment.targetType === "document" && comment.targetId === documentId
  )
}

function selectTopLevelViews(snapshot: AppSnapshot, entityKind: ViewDefinition["entityKind"]) {
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
    snapshot.teamMemberships
      .filter((membership) => membership.userId === snapshot.currentUserId)
      .map((membership) => membership.teamId)
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
    snapshot.teamMemberships
      .filter((membership) => membership.userId === snapshot.currentUserId)
      .map((membership) => membership.teamId)
  )

  return snapshot.projects.filter((project) => {
    if (project.scopeType === "workspace") {
      return project.scopeId === scopeId
    }

    return accessibleTeamIds.has(project.scopeId)
  })
}

function selectAccessibleTeamsForScope(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
) {
  if (scopeType === "team") {
    return snapshot.teams.filter((team) => team.id === scopeId)
  }

  const accessibleTeamIds = new Set(
    snapshot.teamMemberships
      .filter((membership) => membership.userId === snapshot.currentUserId)
      .map((membership) => membership.teamId)
  )

  if (scopeType === "workspace") {
    return snapshot.teams.filter(
      (team) =>
        team.workspaceId === scopeId && accessibleTeamIds.has(team.id)
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
    return snapshot.workItems.filter((item) => item.teamId === scopeId)
  }

  const teamIds = new Set(
    selectAccessibleTeamsForScope(snapshot, scopeType, scopeId).map(
      (team) => team.id
    )
  )

  return snapshot.workItems.filter((item) => teamIds.has(item.teamId))
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
    userIds.add(item.assigneeId ?? "")

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
    (comment) => comment.targetType === "workItem" && comment.targetId === itemId
  )
}

function selectWorkItemAttachments(snapshot: AppSnapshot, itemId: string) {
  return snapshot.attachments.filter(
    (attachment) =>
      attachment.targetType === "workItem" && attachment.targetId === itemId
  )
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

function collectViewUserIds(views: ViewDefinition[]) {
  const userIds = new Set<string>()

  for (const view of views) {
    if (view.scopeType === "personal") {
      userIds.add(view.scopeId)
    }

    for (const assigneeId of view.filters.assigneeIds) {
      userIds.add(assigneeId)
    }

    for (const creatorId of view.filters.creatorIds) {
      userIds.add(creatorId)
    }

    for (const leadId of view.filters.leadIds) {
      userIds.add(leadId)
    }
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

  return snapshot.workspaces.filter((workspace) => workspaceIds.has(workspace.id))
}

function selectConversationListConversations(snapshot: AppSnapshot, userId: string) {
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

  return snapshot.chatMessages.filter((message) =>
    conversationIdSet.has(message.conversationId)
  )
}

function selectChannelPostsForConversations(
  snapshot: AppSnapshot,
  conversationIds: Iterable<string>
) {
  const conversationIdSet = new Set(conversationIds)

  return snapshot.channelPosts.filter((post) =>
    conversationIdSet.has(post.conversationId)
  )
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
    snapshot.workspaces.find((entry) => entry.id === resolvedWorkspaceId) ?? null

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
  const normalizedCurrentUserEmail = currentUserEmail?.trim().toLowerCase() ?? ""

  return snapshot.invites.filter((invite) => {
    const isPendingCurrentUserInvite =
      normalizedCurrentUserEmail.length > 0 &&
      invite.email.toLowerCase() === normalizedCurrentUserEmail &&
      !invite.acceptedAt &&
      !invite.declinedAt

    return invite.workspaceId === resolvedWorkspaceId || isPendingCurrentUserInvite
  })
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

export function selectDocumentIndexReadModel(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace",
  scopeId: string
): ScopedReadModelPatch {
  const documents = selectDocumentsForScope(snapshot, scopeType, scopeId).map(
    toDocumentPreviewEntry
  )
  const views = selectDocumentIndexViews(snapshot, scopeType, scopeId)
  const users = selectUsers(snapshot, collectDocumentUserIds(documents))

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    documents,
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

  const team = snapshot.teams.find((entry) => entry.id === item.teamId) ?? null
  const workspaceId = team?.workspaceId ?? null
  const workItems = snapshot.workItems.filter(
    (candidate) => candidate.teamId === item.teamId
  )
  const comments = selectWorkItemComments(snapshot, itemId)
  const attachments = selectWorkItemAttachments(snapshot, itemId)
  const linkedDocumentIds = new Set<string>([
    item.descriptionDocId,
    ...item.linkedDocumentIds,
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
  const projects = snapshot.projects.filter((project) => {
    if (relatedProjectIds.has(project.id)) {
      return true
    }

    if (project.scopeType === "team") {
      return project.scopeId === item.teamId
    }

    return workspaceId !== null && project.scopeId === workspaceId
  })
  const projectIds = new Set(projects.map((project) => project.id))
  const milestones = snapshot.milestones.filter((milestone) =>
    projectIds.has(milestone.projectId)
  )
  const labels = workspaceId
    ? snapshot.labels.filter((label) => label.workspaceId === workspaceId)
    : []
  const teamMemberships = snapshot.teamMemberships.filter(
    (membership) => membership.teamId === item.teamId
  )
  const users = selectUsers(snapshot, [
    item.creatorId,
    item.assigneeId ?? "",
    ...item.subscriberIds,
    ...teamMemberships.map((membership) => membership.userId),
    ...projects.flatMap((project) => [project.leadId, ...project.memberIds]),
    ...documents.flatMap((document) => [document.createdBy, document.updatedBy]),
    ...workItems.flatMap((candidate) => [
      candidate.creatorId,
      candidate.assigneeId ?? "",
      ...candidate.subscriberIds,
    ]),
    ...collectCommentUserIds(comments),
    ...collectAttachmentUserIds(attachments),
  ])

  return {
    workItems,
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

export function selectProjectDetailReadModel(
  snapshot: AppSnapshot,
  projectId: string
): ScopedReadModelPatch | null {
  const project =
    snapshot.projects.find((entry) => entry.id === projectId) ?? null

  if (!project) {
    return null
  }

  const items = snapshot.workItems.filter(
    (item) =>
      item.primaryProjectId === project.id || item.linkedProjectIds.includes(project.id)
  )
  const milestones = snapshot.milestones.filter(
    (milestone) => milestone.projectId === project.id
  )
  const updates = snapshot.projectUpdates.filter(
    (update) => update.projectId === project.id
  )
  const documents = snapshot.documents.filter(
    (document) =>
      document.kind !== "item-description" &&
      document.linkedProjectIds.includes(project.id)
  ).map(toDocumentPreviewEntry)
  const views = selectProjectViews(snapshot, project)
  const users = selectUsers(snapshot, [
    project.leadId,
    ...project.memberIds,
    ...items.flatMap((item) => [
      item.creatorId,
      item.assigneeId ?? "",
      ...item.subscriberIds,
    ]),
    ...updates.map((update) => update.createdBy),
    ...documents.flatMap((document) => [document.createdBy, document.updatedBy]),
    ...collectViewUserIds(views),
  ])

  return {
    projects: [project],
    milestones,
    projectUpdates: updates as ProjectUpdate[],
    workItems: items,
    documents,
    views,
    users,
  }
}

export function selectProjectIndexReadModel(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace",
  scopeId: string
): ScopedReadModelPatch {
  const projects = selectProjectsForScope(snapshot, scopeType, scopeId)
  const projectIds = new Set(projects.map((project) => project.id))
  const workItems = snapshot.workItems.filter(
    (item) =>
      (item.primaryProjectId && projectIds.has(item.primaryProjectId)) ||
      item.linkedProjectIds.some((projectId) => projectIds.has(projectId))
  )
  const teams =
    scopeType === "workspace"
      ? snapshot.teams.filter((team) => team.workspaceId === scopeId)
      : snapshot.teams.filter((team) => team.id === scopeId)
  const users = selectUsers(snapshot, projects.map((project) => project.leadId))
  const views = selectProjectIndexViews(snapshot, scopeType, scopeId)

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    projects,
    workItems,
    teams,
    views,
    users,
  }
}

export function selectWorkspaceMembershipReadModel(
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

export function selectWorkIndexReadModel(
  snapshot: AppSnapshot,
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
): ScopedReadModelPatch {
  const workItems = selectWorkItemsForScope(snapshot, scopeType, scopeId)
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
  const projects = snapshot.projects.filter((project) => {
    if (project.scopeType === "team") {
      return teamIds.has(project.scopeId)
    }

    return workspaceIds.has(project.scopeId)
  })
  const projectIds = new Set(projects.map((project) => project.id))
  const milestones = snapshot.milestones.filter((milestone) =>
    projectIds.has(milestone.projectId)
  )
  const labels = snapshot.labels.filter((label) =>
    workspaceIds.has(label.workspaceId)
  )
  const views = selectWorkIndexViews(snapshot, scopeType, scopeId)
  const users = selectUsers(snapshot, [
    ...collectWorkItemUserIds(workItems),
    ...teamMemberships.map((membership) => membership.userId),
    ...projects.flatMap((project) => [project.leadId, ...project.memberIds]),
    ...collectViewUserIds(views),
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
    views,
  }
}

export function selectNotificationInboxReadModel(
  snapshot: AppSnapshot,
  userId: string
): ScopedReadModelPatch {
  const notifications = snapshot.notifications.filter(
    (notification) => notification.userId === userId
  )
  const invites = snapshot.invites.filter((invite) =>
    notifications.some(
      (notification) =>
        notification.entityType === "invite" && notification.entityId === invite.id
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
  const channelPosts = snapshot.channelPosts.filter((post) => postIds.has(post.id))
  const projects = snapshot.projects.filter((project) => projectIds.has(project.id))
  const workspaceIds = new Set<string>([
    ...invites.map((invite) => invite.workspaceId),
    ...conversations
      .filter((conversation) => conversation.scopeType === "workspace")
      .map((conversation) => conversation.scopeId),
    ...projects
      .filter((project) => project.scopeType === "workspace")
      .map((project) => project.scopeId),
    ...channelPosts
      .map(
        (post) =>
          snapshot.conversations.find(
            (conversation) => conversation.id === post.conversationId
          ) ?? null
      )
      .filter(
        (conversation): conversation is Conversation =>
          conversation !== null && conversation.scopeType === "workspace"
      )
      .map((conversation) => conversation.scopeId),
  ])
  const teamIds = new Set<string>([
    ...invites.map((invite) => invite.teamId),
    ...conversations
      .filter((conversation) => conversation.scopeType === "team")
      .map((conversation) => conversation.scopeId),
    ...projects
      .filter((project) => project.scopeType === "team")
      .map((project) => project.scopeId),
    ...channelPosts
      .map(
        (post) =>
          snapshot.conversations.find(
            (conversation) => conversation.id === post.conversationId
          ) ?? null
      )
      .filter(
        (conversation): conversation is Conversation =>
          conversation !== null && conversation.scopeType === "team"
      )
      .map((conversation) => conversation.scopeId),
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
      (membership) => membership.teamId === team.id && membership.userId === userId
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
  const users = selectUsers(snapshot, compactStringIds([
    ...collectConversationUserIds(conversations),
    ...collectChatMessageUserIds(
      selectChatMessagesForConversations(snapshot, chatConversationIds)
    ),
    ...teamMemberships.map((membership) => membership.userId),
    ...workspaces.map((workspace) => workspace.createdBy),
  ]))

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
    users,
    conversations,
    chatMessages: selectChatMessagesForConversations(snapshot, chatConversationIds),
  }
}

export function selectConversationThreadReadModel(
  snapshot: AppSnapshot,
  conversationId: string
): ScopedReadModelPatch | null {
  const conversation =
    snapshot.conversations.find((entry) => entry.id === conversationId) ?? null

  if (!conversation || conversation.kind !== "chat") {
    return null
  }

  const messages = snapshot.chatMessages.filter(
    (message) => message.conversationId === conversationId
  )
  const calls = snapshot.calls.filter((call) => call.conversationId === conversationId)
  const teams =
    conversation.scopeType === "team"
      ? snapshot.teams.filter((team) => team.id === conversation.scopeId)
      : snapshot.teams.filter(
          (team) => team.workspaceId === conversation.scopeId
        )
  const workspaces =
    conversation.scopeType === "workspace"
      ? snapshot.workspaces.filter(
          (workspace) => workspace.id === conversation.scopeId
        )
      : selectWorkspaceOwnersForTeams(snapshot, teams)
  const workspaceMemberships = selectWorkspaceMembershipRecordsForTeams(
    snapshot,
    teams
  )
  const teamMemberships = snapshot.teamMemberships.filter((membership) =>
    teams.some((team) => team.id === membership.teamId)
  )
  const users = selectUsers(snapshot, compactStringIds([
    ...collectConversationUserIds([conversation]),
    ...collectChatMessageUserIds(messages),
    ...collectCallUserIds(calls),
    ...teamMemberships.map((membership) => membership.userId),
    ...workspaces.map((workspace) => workspace.createdBy),
  ]))

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
    users,
    conversations: [conversation],
    calls,
    chatMessages: messages,
  }
}

export function selectChannelFeedReadModel(
  snapshot: AppSnapshot,
  conversationId: string
): ScopedReadModelPatch | null {
  const conversation =
    snapshot.conversations.find((entry) => entry.id === conversationId) ?? null

  if (!conversation || conversation.kind !== "channel") {
    return null
  }

  const posts = snapshot.channelPosts.filter(
    (post) => post.conversationId === conversationId
  )
  const comments = selectChannelPostCommentsForPosts(
    snapshot,
    posts.map((post) => post.id)
  )
  const teams =
    conversation.scopeType === "team"
      ? snapshot.teams.filter((team) => team.id === conversation.scopeId)
      : snapshot.teams.filter(
          (team) => team.workspaceId === conversation.scopeId
        )
  const workspaces =
    conversation.scopeType === "workspace"
      ? snapshot.workspaces.filter(
          (workspace) => workspace.id === conversation.scopeId
        )
      : selectWorkspaceOwnersForTeams(snapshot, teams)
  const workspaceMemberships = selectWorkspaceMembershipRecordsForTeams(
    snapshot,
    teams
  )
  const teamMemberships = snapshot.teamMemberships.filter((membership) =>
    teams.some((team) => team.id === membership.teamId)
  )
  const users = selectUsers(snapshot, compactStringIds([
    ...collectConversationUserIds([conversation]),
    ...collectChannelPostUserIds(posts),
    ...collectChannelPostCommentUserIds(comments),
    ...teamMemberships.map((membership) => membership.userId),
    ...workspaces.map((workspace) => workspace.createdBy),
  ]))

  return {
    currentUserId: snapshot.currentUserId,
    currentWorkspaceId: snapshot.currentWorkspaceId,
    workspaces,
    workspaceMemberships,
    teams,
    teamMemberships,
    users,
    conversations: [conversation],
    channelPosts: posts,
    channelPostComments: comments,
  }
}

export function selectSearchSeedReadModel(
  snapshot: AppSnapshot,
  workspaceId: string
): ScopedReadModelPatch {
  const teams = selectAccessibleTeamsForScope(snapshot, "workspace", workspaceId)
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
  const users = selectUsers(snapshot, compactStringIds([
    ...teamMemberships.map((membership) => membership.userId),
    ...collectWorkItemUserIds(workItems),
    ...projects.flatMap((project) => [project.leadId, ...project.memberIds]),
    ...collectDocumentUserIds(documents),
    ...workspaces.map((workspace) => workspace.createdBy),
  ]))

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

export function selectReadModelForInstruction(
  snapshot: AppSnapshot,
  instruction: ScopedReadModelReplaceInstruction
): ScopedReadModelPatch | null {
  switch (instruction.kind) {
    case "document-detail":
      return selectDocumentDetailReadModel(snapshot, instruction.documentId)
    case "document-index":
      return selectDocumentIndexReadModel(
        snapshot,
        instruction.scopeType,
        instruction.scopeId
      )
    case "work-item-detail":
      return selectWorkItemDetailReadModel(snapshot, instruction.itemId)
    case "work-index":
      return selectWorkIndexReadModel(
        snapshot,
        instruction.scopeType,
        instruction.scopeId
      )
    case "project-detail":
      return selectProjectDetailReadModel(snapshot, instruction.projectId)
    case "project-index":
      return selectProjectIndexReadModel(
        snapshot,
        instruction.scopeType,
        instruction.scopeId
      )
    case "workspace-membership":
      return selectWorkspaceMembershipReadModel(snapshot, instruction.workspaceId)
    case "view-catalog":
      return selectViewCatalogReadModel(
        snapshot,
        instruction.scopeType,
        instruction.scopeId
      )
    case "notification-inbox":
      return selectNotificationInboxReadModel(snapshot, instruction.userId)
    case "conversation-list":
      return selectConversationListReadModel(snapshot, instruction.userId)
    case "conversation-thread":
      return selectConversationThreadReadModel(
        snapshot,
        instruction.conversationId
      )
    case "channel-feed":
      return selectChannelFeedReadModel(snapshot, instruction.conversationId)
    case "search-seed":
      return selectSearchSeedReadModel(snapshot, instruction.workspaceId)
    default:
      return null
  }
}

export function getDocumentDetailScopeKeys(documentId: string) {
  return [createDocumentDetailScopeKey(documentId)]
}

export function getDocumentIndexScopeKeys(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return [
    createDocumentIndexScopeKey(createScopedCollectionScopeId(scopeType, scopeId)),
  ]
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

  for (const scopeKey of getDocumentIndexScopeKeys(
    document.kind === "team-document" ? "team" : "workspace",
    document.kind === "team-document"
      ? (document.teamId ?? "")
      : document.workspaceId
  )) {
    scopeKeys.add(scopeKey)
  }

  scopeKeys.add(createSearchSeedScopeKey(document.workspaceId))

  return [...scopeKeys]
}

function buildWorkspaceMembershipScopeKeys(workspaceIds: Iterable<string>) {
  const scopeKeys = new Set<string>([createShellContextScopeKey()])

  for (const workspaceId of workspaceIds) {
    if (!workspaceId) {
      continue
    }

    scopeKeys.add(createWorkspaceMembershipScopeKey(workspaceId))
    scopeKeys.add(createSearchSeedScopeKey(workspaceId))
  }

  return [...scopeKeys]
}

export function getWorkspaceMembershipScopeKeys(workspaceId: string) {
  return buildWorkspaceMembershipScopeKeys([workspaceId])
}

export function getProjectIndexScopeKeys(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return [
    createProjectIndexScopeKey(createScopedCollectionScopeId(scopeType, scopeId)),
  ]
}

export function getProjectRelatedScopeKeys(
  snapshot: AppSnapshot,
  projectId: string
) {
  const project =
    snapshot.projects.find((entry) => entry.id === projectId) ?? null
  const scopeKeys = new Set<string>([createProjectDetailScopeKey(projectId)])

  if (!project || (project.scopeType !== "team" && project.scopeType !== "workspace")) {
    return [...scopeKeys]
  }

  for (const scopeKey of getProjectIndexScopeKeys(
    project.scopeType,
    project.scopeId
  )) {
    scopeKeys.add(scopeKey)
  }

  if (project.scopeType === "workspace") {
    scopeKeys.add(createSearchSeedScopeKey(project.scopeId))
  } else {
    const team = snapshot.teams.find((entry) => entry.id === project.scopeId) ?? null

    if (team) {
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

export function getTeamWorkspaceMembershipScopeKeys(
  snapshot: AppSnapshot,
  teamId: string
) {
  const team = snapshot.teams.find((entry) => entry.id === teamId) ?? null

  return buildWorkspaceMembershipScopeKeys(team ? [team.workspaceId] : [])
}

export function getUserWorkspaceMembershipScopeKeys(
  snapshot: AppSnapshot,
  userId: string
) {
  return buildWorkspaceMembershipScopeKeys(
    collectAccessibleWorkspaceIds(snapshot, userId)
  )
}

export function getWorkItemDetailScopeKeys(
  snapshot: AppSnapshot,
  itemId: string
) {
  const item = snapshot.workItems.find((entry) => entry.id === itemId) ?? null
  const scopeKeys = new Set<string>([createWorkItemDetailScopeKey(itemId)])

  if (!item) {
    return [...scopeKeys]
  }

  for (const projectId of [
    item.primaryProjectId,
    ...item.linkedProjectIds,
  ].filter((value): value is string => Boolean(value))) {
    for (const scopeKey of getProjectRelatedScopeKeys(snapshot, projectId)) {
      scopeKeys.add(scopeKey)
    }
  }

  for (const scopeKey of getWorkIndexScopeKeys("team", item.teamId)) {
    scopeKeys.add(scopeKey)
  }

  const team = snapshot.teams.find((entry) => entry.id === item.teamId) ?? null

  if (team) {
    scopeKeys.add(createSearchSeedScopeKey(team.workspaceId))
  }

  const teamMemberIds = snapshot.teamMemberships
    .filter((membership) => membership.teamId === item.teamId)
    .map((membership) => membership.userId)

  for (const userId of teamMemberIds) {
    for (const scopeKey of getWorkIndexScopeKeys("personal", userId)) {
      scopeKeys.add(scopeKey)
    }
  }

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

export function getSearchSeedScopeKeys(workspaceId: string) {
  return [createSearchSeedScopeKey(workspaceId)]
}

export function getViewRelatedScopeKeys(
  snapshot: AppSnapshot,
  viewId: string
) {
  const view = snapshot.views.find((entry) => entry.id === viewId) ?? null
  const scopeKeys = new Set<string>()

  if (!view || view.containerType) {
    return []
  }

  if (view.scopeType === "team" || view.scopeType === "workspace") {
    for (const scopeKey of getViewCatalogScopeKeys(view.scopeType, view.scopeId)) {
      scopeKeys.add(scopeKey)
    }
  } else if (
    view.route.startsWith("/workspace/") &&
    snapshot.currentWorkspaceId
  ) {
    for (const scopeKey of getViewCatalogScopeKeys(
      "workspace",
      snapshot.currentWorkspaceId
    )) {
      scopeKeys.add(scopeKey)
    }
  }

  if (view.entityKind === "items") {
    if (view.scopeType === "team" || view.scopeType === "workspace") {
      for (const scopeKey of getWorkIndexScopeKeys(view.scopeType, view.scopeId)) {
        scopeKeys.add(scopeKey)
      }
    } else {
      for (const scopeKey of getWorkIndexScopeKeys("personal", view.scopeId)) {
        scopeKeys.add(scopeKey)
      }
    }
  }

  if (
    view.entityKind === "projects" &&
    (view.scopeType === "team" || view.scopeType === "workspace")
  ) {
    for (const scopeKey of getProjectIndexScopeKeys(view.scopeType, view.scopeId)) {
      scopeKeys.add(scopeKey)
    }
  } else if (
    view.entityKind === "projects" &&
    view.route.startsWith("/workspace/") &&
    snapshot.currentWorkspaceId
  ) {
    for (const scopeKey of getProjectIndexScopeKeys(
      "workspace",
      snapshot.currentWorkspaceId
    )) {
      scopeKeys.add(scopeKey)
    }
  }

  if (
    view.entityKind === "docs" &&
    (view.scopeType === "team" || view.scopeType === "workspace")
  ) {
    for (const scopeKey of getDocumentIndexScopeKeys(view.scopeType, view.scopeId)) {
      scopeKeys.add(scopeKey)
    }
  } else if (
    view.entityKind === "docs" &&
    view.route.startsWith("/workspace/") &&
    snapshot.currentWorkspaceId
  ) {
    for (const scopeKey of getDocumentIndexScopeKeys(
      "workspace",
      snapshot.currentWorkspaceId
    )) {
      scopeKeys.add(scopeKey)
    }
  }

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
    const userIds = new Set<string>(compactStringIds([
      ...snapshot.workspaceMemberships
        .filter((membership) => membership.workspaceId === conversation.scopeId)
        .map((membership) => membership.userId),
      ...snapshot.teamMemberships
        .filter((membership) => teamIds.includes(membership.teamId))
        .map((membership) => membership.userId),
      ...snapshot.workspaces
        .filter((workspace) => workspace.id === conversation.scopeId)
        .map((workspace) => workspace.createdBy),
    ]))

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

  for (const userId of collectConversationScopeUserIds(snapshot, conversation)) {
    scopeKeys.add(createConversationListScopeKey(userId))
    scopeKeys.add(createNotificationInboxScopeKey(userId))
  }

  if (conversation.kind === "chat") {
    scopeKeys.add(createConversationThreadScopeKey(conversation.id))
  } else {
    scopeKeys.add(createChannelFeedScopeKey(conversation.id))
  }

  return [...scopeKeys]
}

export function getChannelPostRelatedScopeKeys(
  snapshot: AppSnapshot,
  postId: string
) {
  const post = snapshot.channelPosts.find((entry) => entry.id === postId) ?? null

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
