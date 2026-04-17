import type { MutationCtx, QueryCtx } from "../_generated/server"

import { mergeMembershipRole, normalizeEmailAddress, normalizeJoinCode } from "./core"

export type AppCtx = MutationCtx | QueryCtx
const QUERY_BATCH_SIZE = 20

function uniqueValuesByKey<T>(
  values: Iterable<T>,
  key: (value: T) => string
) {
  return [
    ...new Map([...values].map((value) => [key(value), value] as const)).values(),
  ]
}

async function mapInBatches<T, R>(
  values: T[],
  loader: (value: T) => Promise<R>
) {
  const results: R[] = []

  for (let index = 0; index < values.length; index += QUERY_BATCH_SIZE) {
    const batch = values.slice(index, index + QUERY_BATCH_SIZE)
    results.push(...(await Promise.all(batch.map(loader))))
  }

  return results
}

async function flatMapInBatches<T, R>(
  values: T[],
  loader: (value: T) => Promise<R[]>
) {
  return (await mapInBatches(values, loader)).flat()
}

export async function getWorkspaceDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("workspaces")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getWorkspaceBySlug(ctx: AppCtx, slug: string) {
  return ctx.db
    .query("workspaces")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique()
}

export async function getTeamDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("teams")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getTeamBySlug(ctx: AppCtx, slug: string) {
  return ctx.db
    .query("teams")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique()
}

export async function getTeamByWorkspaceAndSlug(
  ctx: AppCtx,
  workspaceId: string,
  slug: string
) {
  return ctx.db
    .query("teams")
    .withIndex("by_workspace_and_slug", (q) =>
      q.eq("workspaceId", workspaceId).eq("slug", slug)
    )
    .unique()
}

export async function getTeamByJoinCode(ctx: AppCtx, code: string) {
  const normalizedCode = normalizeJoinCode(code)
  return ctx.db
    .query("teams")
    .withIndex("by_join_code", (q) =>
      q.eq("joinCodeNormalized", normalizedCode)
    )
    .unique()
}

export async function getLabelDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("labels")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function getUserDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("users")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listUsersByIds(ctx: AppCtx, userIds: Iterable<string>) {
  return (
    await mapInBatches([...new Set(userIds)], (userId) => getUserDoc(ctx, userId))
  ).filter((user) => user != null)
}

function isActiveUser(
  user:
    | {
        accountDeletedAt?: string | null
        accountDeletionPendingAt?: string | null
      }
    | null
    | undefined
) {
  return Boolean(user && !user.accountDeletedAt && !user.accountDeletionPendingAt)
}

export async function listActiveUsersByIds(
  ctx: AppCtx,
  userIds: Iterable<string>
) {
  return (await listUsersByIds(ctx, userIds)).filter((user) => isActiveUser(user))
}

export async function getTeamMembershipDoc(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  return ctx.db
    .query("teamMemberships")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", teamId).eq("userId", userId)
    )
    .unique()
}

export async function getWorkspaceMembershipDoc(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  return ctx.db
    .query("workspaceMemberships")
    .withIndex("by_workspace_and_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId)
    )
    .unique()
}

export async function listWorkspaceMembershipsByUser(
  ctx: AppCtx,
  userId: string
) {
  return ctx.db
    .query("workspaceMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
}

export async function listWorkspaceMembershipsByWorkspace(
  ctx: AppCtx,
  workspaceId: string
) {
  return ctx.db
    .query("workspaceMemberships")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect()
}

export async function listWorkspaceMembershipsByWorkspaces(
  ctx: AppCtx,
  workspaceIds: Iterable<string>
) {
  return flatMapInBatches([...new Set(workspaceIds)], (workspaceId) =>
    listWorkspaceMembershipsByWorkspace(ctx, workspaceId)
  )
}

export async function listTeamMembershipsByUser(ctx: AppCtx, userId: string) {
  return ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
}

export async function listTeamMembershipsByTeam(ctx: AppCtx, teamId: string) {
  return ctx.db
    .query("teamMemberships")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .collect()
}

export async function listTeamMembershipsByTeams(
  ctx: AppCtx,
  teamIds: Iterable<string>
) {
  return flatMapInBatches([...new Set(teamIds)], (teamId) =>
    listTeamMembershipsByTeam(ctx, teamId)
  )
}

export async function getUserAppState(ctx: AppCtx, userId: string) {
  return ctx.db
    .query("userAppStates")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
}

export async function isWorkspaceOwner(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  const workspace = await getWorkspaceDoc(ctx, workspaceId)
  return workspace?.createdBy === userId
}

export async function getProjectDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("projects")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listProjectsByScope(
  ctx: AppCtx,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return ctx.db
    .query("projects")
    .withIndex("by_scope", (q) =>
      q.eq("scopeType", scopeType).eq("scopeId", scopeId)
    )
    .collect()
}

export async function listProjectsByScopes(
  ctx: AppCtx,
  scopes: Iterable<{
    scopeType: "team" | "workspace"
    scopeId: string
  }>
) {
  const uniqueScopes = uniqueValuesByKey(
    scopes,
    (scope) => `${scope.scopeType}:${scope.scopeId}`
  )

  if (uniqueScopes.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueScopes, (scope) =>
    listProjectsByScope(ctx, scope.scopeType, scope.scopeId)
  )
}

export async function listMilestonesByProject(ctx: AppCtx, projectId: string) {
  return ctx.db
    .query("milestones")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect()
}

export async function listMilestonesByProjects(
  ctx: AppCtx,
  projectIds: Iterable<string>
) {
  const uniqueProjectIds = [...new Set(projectIds)]

  if (uniqueProjectIds.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueProjectIds, (projectId) =>
    listMilestonesByProject(ctx, projectId)
  )
}

export async function getUserByEmail(ctx: AppCtx, email: string) {
  const normalizedEmail = normalizeEmailAddress(email)
  const user = await ctx.db
    .query("users")
    .withIndex("by_email_normalized", (q) =>
      q.eq("emailNormalized", normalizedEmail)
    )
    .unique()

  if (user && !user.accountDeletedAt && !user.accountDeletionPendingAt) {
    return user
  }
  return null
}

export async function getUserByWorkOSUserId(ctx: AppCtx, workosUserId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
    .unique()
}

export function getAuthLifecycleError(
  user:
    | {
        accountDeletedAt?: string | null
        accountDeletionPendingAt?: string | null
      }
    | null
    | undefined
) {
  if (user?.accountDeletedAt) {
    return "This account has been deleted"
  }

  if (user?.accountDeletionPendingAt) {
    return "This account is being deleted"
  }

  return null
}

export async function resolveActiveUserByIdentity(
  ctx: AppCtx,
  input: {
    workosUserId?: string | null
    email?: string | null
  }
) {
  if (input.workosUserId) {
    const byWorkosId = await getUserByWorkOSUserId(ctx, input.workosUserId)
    const lifecycleError = getAuthLifecycleError(byWorkosId)

    if (lifecycleError) {
      throw new Error(lifecycleError)
    }

    if (byWorkosId) {
      return byWorkosId
    }
  }

  if (input.email) {
    const byEmail = await getUserByEmail(ctx, input.email)
    return byEmail
  }

  return null
}

export async function listWorkspaceTeams(ctx: AppCtx, workspaceId: string) {
  return ctx.db
    .query("teams")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect()
}

export async function listActiveTeamUsers(ctx: AppCtx, teamId: string) {
  const memberships = await listTeamMembershipsByTeam(ctx, teamId)

  return listActiveUsersByIds(
    ctx,
    memberships.map((membership) => membership.userId)
  )
}

export async function listActiveWorkspaceUsers(ctx: AppCtx, workspaceId: string) {
  const [workspace, workspaceTeams] = await Promise.all([
    getWorkspaceDoc(ctx, workspaceId),
    listWorkspaceTeams(ctx, workspaceId),
  ])
  const [workspaceMemberships, teamMemberships] = await Promise.all([
    listWorkspaceMembershipsByWorkspace(ctx, workspaceId),
    listTeamMembershipsByTeams(
      ctx,
      workspaceTeams.map((team) => team.id)
    ),
  ])
  const userIds = new Set([
    ...workspaceMemberships.map((membership) => membership.userId),
    ...teamMemberships.map((membership) => membership.userId),
  ])

  if (workspace?.createdBy) {
    userIds.add(workspace.createdBy)
  }

  return listActiveUsersByIds(ctx, userIds)
}

export async function listTeamsByIds(ctx: AppCtx, teamIds: Iterable<string>) {
  return (
    await mapInBatches([...new Set(teamIds)], (teamId) => getTeamDoc(ctx, teamId))
  ).filter((team) => team != null)
}

export async function listLabelsByWorkspace(ctx: AppCtx, workspaceId: string) {
  return ctx.db
    .query("labels")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect()
}

export async function listLabelsByWorkspaces(
  ctx: AppCtx,
  workspaceIds: Iterable<string>
) {
  return flatMapInBatches([...new Set(workspaceIds)], (workspaceId) =>
    listLabelsByWorkspace(ctx, workspaceId)
  )
}

export async function listWorkspacesOwnedByUser(ctx: AppCtx, userId: string) {
  return ctx.db
    .query("workspaces")
    .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
    .collect()
}

export async function listWorkspacesByIds(
  ctx: AppCtx,
  workspaceIds: Iterable<string>
) {
  return (
    await mapInBatches([...new Set(workspaceIds)], (workspaceId) =>
      getWorkspaceDoc(ctx, workspaceId)
    )
  ).filter((workspace) => workspace != null)
}

export async function getWorkItemDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("workItems")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listWorkItemsByTeam(ctx: AppCtx, teamId: string) {
  return ctx.db
    .query("workItems")
    .withIndex("by_team_id", (q) => q.eq("teamId", teamId))
    .collect()
}

export async function listWorkItemsByTeams(
  ctx: AppCtx,
  teamIds: Iterable<string>
) {
  return flatMapInBatches([...new Set(teamIds)], (teamId) =>
    listWorkItemsByTeam(ctx, teamId)
  )
}

export async function getDocumentDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("documents")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listDocumentsByIds(
  ctx: AppCtx,
  documentIds: Iterable<string>
) {
  return (
    await mapInBatches([...new Set(documentIds)], (documentId) =>
      getDocumentDoc(ctx, documentId)
    )
  ).filter((document) => document != null)
}

export async function listWorkspaceDocuments(ctx: AppCtx, workspaceId: string) {
  return ctx.db
    .query("documents")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect()
}

export async function listWorkspaceDocumentsByWorkspaces(
  ctx: AppCtx,
  workspaceIds: Iterable<string>
) {
  return flatMapInBatches([...new Set(workspaceIds)], (workspaceId) =>
    listWorkspaceDocuments(ctx, workspaceId)
  )
}

export async function listTeamDocuments(ctx: AppCtx, teamId: string) {
  return ctx.db
    .query("documents")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .collect()
}

export async function listTeamDocumentsByTeams(
  ctx: AppCtx,
  teamIds: Iterable<string>
) {
  return flatMapInBatches([...new Set(teamIds)], (teamId) =>
    listTeamDocuments(ctx, teamId)
  )
}

export async function listDocumentsByCreator(ctx: AppCtx, userId: string) {
  return ctx.db
    .query("documents")
    .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
    .collect()
}

export async function getCommentDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("comments")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listCommentsByTarget(
  ctx: AppCtx,
  targetType: "workItem" | "document",
  targetId: string
) {
  return ctx.db
    .query("comments")
    .withIndex("by_target", (q) =>
      q.eq("targetType", targetType).eq("targetId", targetId)
    )
    .collect()
}

export async function listCommentsByTargets(
  ctx: AppCtx,
  input: {
    targetType: "workItem" | "document"
    targetIds: Iterable<string>
  }
) {
  const targetIds = [...new Set(input.targetIds)]

  if (targetIds.length === 0) {
    return []
  }

  return flatMapInBatches(targetIds, (targetId) =>
    listCommentsByTarget(ctx, input.targetType, targetId)
  )
}

export async function listDocumentPresenceByUser(ctx: AppCtx, userId: string) {
  return ctx.db
    .query("documentPresence")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
}

export async function listDocumentPresenceByDocument(
  ctx: AppCtx,
  documentId: string
) {
  return ctx.db
    .query("documentPresence")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect()
}

export async function listDocumentPresenceByDocuments(
  ctx: AppCtx,
  documentIds: Iterable<string>
) {
  return flatMapInBatches([...new Set(documentIds)], (documentId) =>
    listDocumentPresenceByDocument(ctx, documentId)
  )
}

export async function getConversationDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("conversations")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listConversationsByScope(
  ctx: AppCtx,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return ctx.db
    .query("conversations")
    .withIndex("by_scope", (q) =>
      q.eq("scopeType", scopeType).eq("scopeId", scopeId)
    )
    .collect()
}

export async function listConversationsByScopes(
  ctx: AppCtx,
  scopes: Iterable<{
    scopeType: "team" | "workspace"
    scopeId: string
  }>
) {
  const uniqueScopes = uniqueValuesByKey(
    scopes,
    (scope) => `${scope.scopeType}:${scope.scopeId}`
  )

  if (uniqueScopes.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueScopes, (scope) =>
    listConversationsByScope(ctx, scope.scopeType, scope.scopeId)
  )
}

export async function getCallDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("calls")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listCallsByConversation(
  ctx: AppCtx,
  conversationId: string
) {
  return ctx.db
    .query("calls")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect()
}

export async function listCallsByConversations(
  ctx: AppCtx,
  conversationIds: Iterable<string>
) {
  const uniqueConversationIds = [...new Set(conversationIds)]

  if (uniqueConversationIds.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueConversationIds, (conversationId) =>
    listCallsByConversation(ctx, conversationId)
  )
}

export async function getChannelPostDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("channelPosts")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listChatMessagesByConversation(
  ctx: AppCtx,
  conversationId: string
) {
  return ctx.db
    .query("chatMessages")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect()
}

export async function listChatMessagesByConversations(
  ctx: AppCtx,
  conversationIds: Iterable<string>
) {
  const uniqueConversationIds = [...new Set(conversationIds)]

  if (uniqueConversationIds.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueConversationIds, (conversationId) =>
    listChatMessagesByConversation(ctx, conversationId)
  )
}

export async function listChannelPostsByConversation(
  ctx: AppCtx,
  conversationId: string
) {
  return ctx.db
    .query("channelPosts")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect()
}

export async function listChannelPostsByConversations(
  ctx: AppCtx,
  conversationIds: Iterable<string>
) {
  const uniqueConversationIds = [...new Set(conversationIds)]

  if (uniqueConversationIds.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueConversationIds, (conversationId) =>
    listChannelPostsByConversation(ctx, conversationId)
  )
}

export async function listChannelPostCommentsByPost(
  ctx: AppCtx,
  postId: string
) {
  return ctx.db
    .query("channelPostComments")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .collect()
}

export async function listChannelPostCommentsByPosts(
  ctx: AppCtx,
  postIds: Iterable<string>
) {
  const uniquePostIds = [...new Set(postIds)]

  if (uniquePostIds.length === 0) {
    return []
  }

  return flatMapInBatches(uniquePostIds, (postId) =>
    listChannelPostCommentsByPost(ctx, postId)
  )
}

export async function getAttachmentDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("attachments")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listAttachmentsByTarget(
  ctx: AppCtx,
  targetType: "workItem" | "document",
  targetId: string
) {
  return ctx.db
    .query("attachments")
    .withIndex("by_target", (q) =>
      q.eq("targetType", targetType).eq("targetId", targetId)
    )
    .collect()
}

export async function listAttachmentsByTargets(
  ctx: AppCtx,
  input: {
    targetType: "workItem" | "document"
    targetIds: Iterable<string>
  }
) {
  const targetIds = [...new Set(input.targetIds)]

  if (targetIds.length === 0) {
    return []
  }

  return flatMapInBatches(targetIds, (targetId) =>
    listAttachmentsByTarget(ctx, input.targetType, targetId)
  )
}

export async function getViewDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("views")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listViewsByScope(
  ctx: AppCtx,
  scopeType: "personal" | "team" | "workspace",
  scopeId: string
) {
  return ctx.db
    .query("views")
    .withIndex("by_scope", (q) =>
      q.eq("scopeType", scopeType).eq("scopeId", scopeId)
    )
    .collect()
}

export async function listViewsByScopes(
  ctx: AppCtx,
  scopes: Iterable<{
    scopeType: "team" | "workspace"
    scopeId: string
  }>
) {
  const uniqueScopes = uniqueValuesByKey(
    scopes,
    (scope) => `${scope.scopeType}:${scope.scopeId}`
  )

  if (uniqueScopes.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueScopes, (scope) =>
    listViewsByScope(ctx, scope.scopeType, scope.scopeId)
  )
}

export async function listPersonalViewsByUsers(
  ctx: AppCtx,
  userIds: Iterable<string>
) {
  const uniqueUserIds = [...new Set(userIds)]

  if (uniqueUserIds.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueUserIds, (userId) =>
    listViewsByScope(ctx, "personal", userId)
  )
}

export async function listViewsByScopeEntity(
  ctx: AppCtx,
  scopeType: "team" | "workspace",
  scopeId: string,
  entityKind: "items" | "projects"
) {
  return ctx.db
    .query("views")
    .withIndex("by_scope_entity_kind", (q) =>
      q
        .eq("scopeType", scopeType)
        .eq("scopeId", scopeId)
        .eq("entityKind", entityKind)
    )
    .collect()
}

export async function getNotificationDoc(ctx: AppCtx, id: string) {
  return ctx.db
    .query("notifications")
    .withIndex("by_domain_id", (q) => q.eq("id", id))
    .unique()
}

export async function listNotificationsByEntity(
  ctx: AppCtx,
  entityType:
    | "chat"
    | "team"
    | "workspace"
    | "project"
    | "workItem"
    | "document"
    | "invite"
    | "channelPost",
  entityId: string
) {
  return ctx.db
    .query("notifications")
    .withIndex("by_entity", (q) =>
      q.eq("entityType", entityType).eq("entityId", entityId)
    )
    .collect()
}

export async function listNotificationsByEntities(
  ctx: AppCtx,
  entities: Iterable<{
    entityType:
      | "chat"
      | "team"
      | "workspace"
      | "project"
      | "workItem"
      | "document"
      | "invite"
      | "channelPost"
    entityId: string
  }>
) {
  const uniqueEntities = uniqueValuesByKey(
    entities,
    (entity) => `${entity.entityType}:${entity.entityId}`
  )

  if (uniqueEntities.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueEntities, (entity) =>
    listNotificationsByEntity(ctx, entity.entityType, entity.entityId)
  )
}

export async function listNotificationsByUser(ctx: AppCtx, userId: string) {
  return ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
}

export async function listPendingDigestNotifications(ctx: AppCtx) {
  return ctx.db
    .query("notifications")
    .withIndex("by_emailed_at", (q) => q.eq("emailedAt", null))
    .collect()
}

export async function listInvitesByTeam(ctx: AppCtx, teamId: string) {
  return ctx.db
    .query("invites")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .collect()
}

export async function listInvitesByTeams(
  ctx: AppCtx,
  teamIds: Iterable<string>
) {
  const uniqueTeamIds = [...new Set(teamIds)]

  if (uniqueTeamIds.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueTeamIds, (teamId) =>
    listInvitesByTeam(ctx, teamId)
  )
}

export async function listInvitesByNormalizedEmail(ctx: AppCtx, email: string) {
  const normalizedEmail = normalizeEmailAddress(email)
  return ctx.db
    .query("invites")
    .withIndex("by_normalized_email", (q) =>
      q.eq("normalizedEmail", normalizedEmail)
    )
    .collect()
}

export async function getInviteByTokenDoc(ctx: AppCtx, token: string) {
  return ctx.db
    .query("invites")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique()
}

export async function getPendingInvitesForEmail(ctx: AppCtx, email: string) {
  const invites = (await listInvitesByNormalizedEmail(ctx, email)).filter(
    (invite) => !invite.acceptedAt && !invite.declinedAt
  )

  return Promise.all(
    invites.map(async (invite) => {
      const team = await getTeamDoc(ctx, invite.teamId)
      const workspace = await getWorkspaceDoc(ctx, invite.workspaceId)

      return {
        invite: {
          id: invite.id,
          token: invite.token,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
          acceptedAt: invite.acceptedAt,
          declinedAt: invite.declinedAt ?? null,
          joinCode: invite.joinCode,
        },
        team: team
          ? {
              id: team.id,
              slug: team.slug,
              name: team.name,
              summary: team.settings.summary,
              joinCode: team.settings.joinCode,
            }
          : null,
        workspace: workspace
          ? {
              id: workspace.id,
              slug: workspace.slug,
              name: workspace.name,
              logoUrl: workspace.logoUrl,
            }
          : null,
      }
    })
  )
}

export async function listProjectUpdatesByProject(
  ctx: AppCtx,
  projectId: string
) {
  return ctx.db
    .query("projectUpdates")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect()
}

export async function listProjectUpdatesByProjects(
  ctx: AppCtx,
  projectIds: Iterable<string>
) {
  const uniqueProjectIds = [...new Set(projectIds)]

  if (uniqueProjectIds.length === 0) {
    return []
  }

  return flatMapInBatches(uniqueProjectIds, (projectId) =>
    listProjectUpdatesByProject(ctx, projectId)
  )
}

export async function getActiveInvitesForTeamAndEmail(
  ctx: AppCtx,
  input: {
    teamId: string
    email: string
  }
) {
  const normalizedEmail = normalizeEmailAddress(input.email)
  const now = Date.now()
  const indexedInvites = await ctx.db
    .query("invites")
    .withIndex("by_team_and_normalized_email", (q) =>
      q.eq("teamId", input.teamId).eq("normalizedEmail", normalizedEmail)
    )
    .collect()
  return indexedInvites.filter(
    (invite) =>
      !invite.acceptedAt &&
      !invite.declinedAt &&
      new Date(invite.expiresAt).getTime() >= now
  )
}

export async function getAppConfig(ctx: AppCtx) {
  const configs = await ctx.db
    .query("appConfig")
    .withIndex("by_key", (q) => q.eq("key", "singleton"))
    .collect()

  if (configs.length === 0) {
    return null
  }

  return configs.reduce((selected, config) =>
    (config.snapshotVersion ?? 0) > (selected.snapshotVersion ?? 0)
      ? config
      : selected
  )
}

export async function getOrCreateAppConfig(ctx: MutationCtx) {
  const config = await getAppConfig(ctx)

  if (config) {
    return config
  }

  const configId = await ctx.db.insert("appConfig", {
    key: "singleton",
    snapshotVersion: 0,
  })

  const nextConfig = await ctx.db.get(configId)

  if (!nextConfig) {
    throw new Error("Failed to initialize app config")
  }

  return nextConfig
}

export async function setCurrentWorkspaceForUser(
  ctx: MutationCtx,
  userId: string,
  workspaceId: string
) {
  const existingState = await getUserAppState(ctx, userId)

  if (existingState) {
    await ctx.db.patch(existingState._id, {
      currentWorkspaceId: workspaceId,
    })
    return
  }

  await ctx.db.insert("userAppStates", {
    userId,
    currentWorkspaceId: workspaceId,
  })
}

export function resolvePreferredWorkspaceId(input: {
  selectedWorkspaceId?: string | null
  accessibleWorkspaceIds: Iterable<string>
  fallbackWorkspaceIds?: Array<string | null | undefined>
}) {
  const accessibleWorkspaceIds = new Set(input.accessibleWorkspaceIds)

  if (
    input.selectedWorkspaceId &&
    accessibleWorkspaceIds.has(input.selectedWorkspaceId)
  ) {
    return input.selectedWorkspaceId
  }

  for (const workspaceId of input.fallbackWorkspaceIds ?? []) {
    if (workspaceId && accessibleWorkspaceIds.has(workspaceId)) {
      return workspaceId
    }
  }

  return null
}

export function isDefinedString(
  value: string | null | undefined
): value is string {
  return typeof value === "string" && value.length > 0
}

export async function getWorkspaceRoleMapForUser(ctx: AppCtx, userId: string) {
  const [workspaceMemberships, memberships] = await Promise.all([
    listWorkspaceMembershipsByUser(ctx, userId),
    listTeamMembershipsByUser(ctx, userId),
  ])
  const teams = await listTeamsByIds(
    ctx,
    memberships.map((membership) => membership.teamId)
  )
  const workspaces = await listWorkspacesOwnedByUser(ctx, userId)
  const directWorkspaceIds = new Set(
    workspaceMemberships.map((membership) => membership.workspaceId)
  )
  const workspaceRoleMap = workspaceMemberships.reduce<
    Record<string, Array<(typeof memberships)[number]["role"]>>
  >((accumulator, membership) => {
    accumulator[membership.workspaceId] = [membership.role]
    return accumulator
  }, {})
  const fallbackWorkspaceRoleMap = memberships.reduce<
    Record<string, Array<(typeof memberships)[number]["role"]>>
  >((accumulator, membership) => {
    const team = teams.find((entry) => entry.id === membership.teamId)
    if (!team) {
      return accumulator
    }

    if (directWorkspaceIds.has(team.workspaceId)) {
      return accumulator
    }

    accumulator[team.workspaceId] = [
      ...(accumulator[team.workspaceId] ?? []),
      membership.role,
    ]

    return accumulator
  }, {})

  for (const [workspaceId, roles] of Object.entries(fallbackWorkspaceRoleMap)) {
    workspaceRoleMap[workspaceId] = roles
  }

  for (const workspace of workspaces) {
    if (workspace.createdBy !== userId) {
      continue
    }

    const ownedRoles = new Set<(typeof memberships)[number]["role"]>([
      ...(workspaceRoleMap[workspace.id] ?? []),
      "admin",
    ])

    workspaceRoleMap[workspace.id] = [...ownedRoles]
  }

  return workspaceRoleMap
}

export async function ensureWorkspaceMembership(
  ctx: MutationCtx,
  input: {
    workspaceId: string
    userId: string
    role: "admin" | "member" | "viewer" | "guest"
  }
) {
  const existingMembership = await getWorkspaceMembershipDoc(
    ctx,
    input.workspaceId,
    input.userId
  )

  if (existingMembership) {
    if (existingMembership.role !== input.role) {
      await ctx.db.patch(existingMembership._id, {
        role: input.role,
      })
    }

    return input.role
  }

  await ctx.db.insert("workspaceMemberships", {
    workspaceId: input.workspaceId,
    userId: input.userId,
    role: input.role,
  })

  return input.role
}

export async function syncWorkspaceMembershipRoleFromTeams(
  ctx: MutationCtx,
  input: {
    workspaceId: string
    userId: string
    fallbackRole?: "admin" | "member" | "viewer" | "guest"
  }
) {
  const workspace = await getWorkspaceDoc(ctx, input.workspaceId)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  if (workspace.createdBy === input.userId) {
    return ensureWorkspaceMembership(ctx, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: "admin",
    })
  }

  const memberships = await listTeamMembershipsByUser(ctx, input.userId)
  const teams = await listTeamsByIds(
    ctx,
    memberships.map((membership) => membership.teamId)
  )

  const highestTeamRole =
    memberships
      .filter((membership) =>
        teams.some(
          (team) =>
            team.id === membership.teamId &&
            team.workspaceId === input.workspaceId
        )
      )
      .reduce<(typeof memberships)[number]["role"] | null>(
        (currentRole, membership) =>
          mergeMembershipRole(currentRole, membership.role),
        null
      ) ?? null

  return ensureWorkspaceMembership(ctx, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    role: highestTeamRole ?? (input.fallbackRole ?? "viewer"),
  })
}

export async function bootstrapFirstAuthenticatedUser(
  ctx: MutationCtx,
  userId: string
) {
  void ctx
  void userId
  return false
}

export async function getEffectiveRole(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  const membership = await getTeamMembershipDoc(ctx, teamId, userId)

  return membership?.role ?? null
}

export async function isTeamMember(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  const membership = await getTeamMembershipDoc(ctx, teamId, userId)

  return Boolean(membership)
}
