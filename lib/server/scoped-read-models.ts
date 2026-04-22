import type { AppSnapshot } from "@/lib/domain/types"
import type { AuthenticatedSession } from "@/lib/server/route-auth"
import {
  bumpScopedReadModelVersionsServer,
  getSnapshotServer,
} from "@/lib/server/convex"
import {
  getChannelPostRelatedScopeKeys,
  getChatMessageRelatedScopeKeys,
  getConversationRelatedScopeKeys,
  getDocumentIndexScopeKeys,
  getDocumentRelatedScopeKeys,
  getDocumentDetailScopeKeys,
  getNotificationInboxScopeKeys,
  getProjectIndexScopeKeys,
  getProjectRelatedScopeKeys,
  getProjectDetailScopeKeys,
  getTeamWorkspaceMembershipScopeKeys,
  getUserWorkspaceMembershipScopeKeys,
  getViewCatalogScopeKeys,
  getViewRelatedScopeKeys,
  getWorkIndexScopeKeys,
  getWorkItemDetailScopeKeys,
  getWorkspaceMembershipScopeKeys,
  getSearchSeedScopeKeys,
} from "@/lib/scoped-sync/read-models"

async function loadSnapshotForSession(session: AuthenticatedSession) {
  return (await getSnapshotServer({
    workosUserId: session.user.id,
    email: session.user.email ?? undefined,
  })) as AppSnapshot
}

export async function bumpDocumentReadModelScopesServer(documentId: string) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getDocumentDetailScopeKeys(documentId),
  })
}

export async function resolveDocumentReadModelScopeKeysServer(
  session: AuthenticatedSession,
  documentId: string
) {
  const snapshot = await loadSnapshotForSession(session)

  return getDocumentRelatedScopeKeys(snapshot, documentId)
}

export async function bumpDocumentIndexReadModelScopesServer(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getDocumentIndexScopeKeys(scopeType, scopeId),
  })
}

export async function bumpWorkspaceMembershipReadModelScopesServer(
  workspaceId: string
) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getWorkspaceMembershipScopeKeys(workspaceId),
  })
}

export async function bumpTeamWorkspaceMembershipReadModelScopesServer(
  session: AuthenticatedSession,
  teamId: string
) {
  const snapshot = await loadSnapshotForSession(session)

  await bumpScopedReadModelVersionsServer({
    scopeKeys: getTeamWorkspaceMembershipScopeKeys(snapshot, teamId),
  })
}

export async function bumpUserWorkspaceMembershipReadModelScopesServer(
  session: AuthenticatedSession,
  userId: string
) {
  const snapshot = await loadSnapshotForSession(session)

  await bumpScopedReadModelVersionsServer({
    scopeKeys: getUserWorkspaceMembershipScopeKeys(snapshot, userId),
  })
}

export async function bumpWorkItemReadModelScopesServer(
  session: AuthenticatedSession,
  itemId: string
) {
  const snapshot = await loadSnapshotForSession(session)

  await bumpScopedReadModelVersionsServer({
    scopeKeys: getWorkItemDetailScopeKeys(snapshot, itemId),
  })
}

export async function resolveWorkItemReadModelScopeKeysServer(
  session: AuthenticatedSession,
  itemId: string
) {
  const snapshot = await loadSnapshotForSession(session)

  return getWorkItemDetailScopeKeys(snapshot, itemId)
}

export async function bumpProjectReadModelScopesServer(projectId: string) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getProjectDetailScopeKeys(projectId),
  })
}

export async function resolveProjectReadModelScopeKeysServer(
  session: AuthenticatedSession,
  projectId: string
) {
  const snapshot = await loadSnapshotForSession(session)

  return getProjectRelatedScopeKeys(snapshot, projectId)
}

export async function bumpProjectIndexReadModelScopesServer(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getProjectIndexScopeKeys(scopeType, scopeId),
  })
}

export async function bumpWorkIndexReadModelScopesServer(
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getWorkIndexScopeKeys(scopeType, scopeId),
  })
}

export async function bumpViewCatalogReadModelScopesServer(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getViewCatalogScopeKeys(scopeType, scopeId),
  })
}

export async function resolveViewReadModelScopeKeysServer(
  session: AuthenticatedSession,
  viewId: string
) {
  const snapshot = await loadSnapshotForSession(session)

  return getViewRelatedScopeKeys(snapshot, viewId)
}

export async function bumpNotificationInboxReadModelScopesServer(
  userIds: Iterable<string>
) {
  const scopeKeys = new Set<string>()

  for (const userId of userIds) {
    for (const scopeKey of getNotificationInboxScopeKeys(userId)) {
      scopeKeys.add(scopeKey)
    }
  }

  if (scopeKeys.size === 0) {
    return
  }

  await bumpScopedReadModelVersionsServer({
    scopeKeys: [...scopeKeys],
  })
}

export async function resolveConversationReadModelScopeKeysServer(
  session: AuthenticatedSession,
  conversationId: string
) {
  const snapshot = await loadSnapshotForSession(session)

  return getConversationRelatedScopeKeys(snapshot, conversationId)
}

export async function resolveChannelPostReadModelScopeKeysServer(
  session: AuthenticatedSession,
  postId: string
) {
  const snapshot = await loadSnapshotForSession(session)

  return getChannelPostRelatedScopeKeys(snapshot, postId)
}

export async function resolveChatMessageReadModelScopeKeysServer(
  session: AuthenticatedSession,
  messageId: string
) {
  const snapshot = await loadSnapshotForSession(session)

  return getChatMessageRelatedScopeKeys(snapshot, messageId)
}

export async function bumpSearchSeedReadModelScopesServer(workspaceId: string) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getSearchSeedScopeKeys(workspaceId),
  })
}

export async function bumpCommentTargetReadModelScopesServer(
  session: AuthenticatedSession,
  input: {
    targetType: "workItem" | "document"
    targetId: string
  }
) {
  if (input.targetType === "document") {
    await bumpDocumentReadModelScopesServer(input.targetId)
    return
  }

  await bumpWorkItemReadModelScopesServer(session, input.targetId)
}

export async function bumpAttachmentTargetReadModelScopesServer(
  session: AuthenticatedSession,
  input: {
    targetType: "workItem" | "document"
    targetId: string
  }
) {
  await bumpCommentTargetReadModelScopesServer(session, input)
}
