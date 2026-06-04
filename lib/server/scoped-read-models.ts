import type { AuthenticatedSession } from "@/lib/server/route-auth"
import {
  authorizeScopedReadModelScopeKeysConvexServer,
  bumpScopedReadModelVersionsServer,
  resolveScopedReadModelScopeKeysServer,
  type ScopedReadModelScopeKeyServerTarget,
} from "@/lib/server/convex"
import { getSelectedWorkspaceIdFromCookies } from "@/lib/server/workspace-selection"
import {
  getDocumentIndexScopeKeys,
  getNotificationInboxScopeKeys,
  getPrivateDocumentIndexScopeKeys,
  getPrivateSearchSeedScopeKeys,
  getProjectIndexScopeKeys,
  getSearchSeedScopeKeys,
  getWorkspaceMembershipScopeKeys,
} from "@/lib/scoped-sync/read-models"

async function getScopedReadModelServerIdentity(
  session: AuthenticatedSession
) {
  return {
    workosUserId: session.user.id,
    email: session.user.email ?? undefined,
    selectedWorkspaceId: await getSelectedWorkspaceIdFromCookies(),
  }
}

async function resolveScopedReadModelScopeKeysForSession(
  session: AuthenticatedSession,
  target: ScopedReadModelScopeKeyServerTarget
) {
  return resolveScopedReadModelScopeKeysServer({
    ...(await getScopedReadModelServerIdentity(session)),
    target,
  })
}

async function bumpResolvedScopedReadModelScopeKeys(
  scopeKeys: Promise<string[]> | string[]
) {
  const resolvedScopeKeys = await scopeKeys

  if (resolvedScopeKeys.length === 0) {
    return
  }

  await bumpScopedReadModelVersionsServer({
    scopeKeys: resolvedScopeKeys,
  })
}

export async function bumpScopedReadModelScopeKeysServer(scopeKeys: string[]) {
  await bumpResolvedScopedReadModelScopeKeys(scopeKeys)
}

export async function authorizeScopedReadModelScopeKeysServer(
  session: AuthenticatedSession,
  scopeKeys: string[]
) {
  await authorizeScopedReadModelScopeKeysConvexServer({
    ...(await getScopedReadModelServerIdentity(session)),
    scopeKeys,
  })
}

export async function resolveDocumentReadModelScopeKeysServer(
  session: AuthenticatedSession,
  documentId: string
) {
  return resolveScopedReadModelScopeKeysForSession(session, {
    kind: "document",
    documentId,
  })
}

export async function bumpDocumentIndexReadModelScopesServer(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getDocumentIndexScopeKeys(scopeType, scopeId),
  })
}

export async function bumpPrivateDocumentIndexReadModelScopesServer(
  workspaceId: string,
  userId: string
) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getPrivateDocumentIndexScopeKeys(workspaceId, userId),
  })
}

export async function bumpWorkspaceMembershipReadModelScopesServer(
  workspaceId: string
) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getWorkspaceMembershipScopeKeys(workspaceId),
  })
}

export async function bumpUserWorkspaceMembershipReadModelScopesServer(
  session: AuthenticatedSession,
  userId: string
) {
  await bumpResolvedScopedReadModelScopeKeys(
    resolveScopedReadModelScopeKeysForSession(session, {
      kind: "user-workspace-membership",
      userId,
    })
  )
}

export async function bumpWorkItemReadModelScopesServer(
  session: AuthenticatedSession,
  itemId: string
) {
  await bumpResolvedScopedReadModelScopeKeys(
    resolveWorkItemReadModelScopeKeysServer(session, itemId)
  )
}

export async function resolveWorkItemReadModelScopeKeysServer(
  session: AuthenticatedSession,
  itemId: string
) {
  return resolveScopedReadModelScopeKeysForSession(session, {
    kind: "work-item",
    itemId,
  })
}

export async function resolveCustomPropertyDefinitionReadModelScopeKeysServer(
  session: AuthenticatedSession,
  teamId: string
) {
  return resolveScopedReadModelScopeKeysForSession(session, {
    kind: "custom-property-definition",
    teamId,
  })
}

export async function resolveProjectReadModelScopeKeysServer(
  session: AuthenticatedSession,
  projectId: string
) {
  return resolveScopedReadModelScopeKeysForSession(session, {
    kind: "project",
    projectId,
  })
}

export async function bumpProjectIndexReadModelScopesServer(
  scopeType: "team" | "workspace",
  scopeId: string
) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getProjectIndexScopeKeys(scopeType, scopeId),
  })
}

export async function resolveViewReadModelScopeKeysServer(
  session: AuthenticatedSession,
  viewId: string
) {
  return resolveScopedReadModelScopeKeysForSession(session, {
    kind: "view",
    viewId,
  })
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
  return resolveScopedReadModelScopeKeysForSession(session, {
    kind: "conversation",
    conversationId,
  })
}

export async function resolveChannelPostReadModelScopeKeysServer(
  session: AuthenticatedSession,
  postId: string
) {
  return resolveScopedReadModelScopeKeysForSession(session, {
    kind: "channel-post",
    postId,
  })
}

export async function resolveChatMessageReadModelScopeKeysServer(
  session: AuthenticatedSession,
  messageId: string
) {
  return resolveScopedReadModelScopeKeysForSession(session, {
    kind: "chat-message",
    messageId,
  })
}

export async function bumpSearchSeedReadModelScopesServer(workspaceId: string) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getSearchSeedScopeKeys(workspaceId),
  })
}

export async function bumpPrivateSearchSeedReadModelScopesServer(
  workspaceId: string,
  userId: string
) {
  await bumpScopedReadModelVersionsServer({
    scopeKeys: getPrivateSearchSeedScopeKeys(workspaceId, userId),
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
    await bumpResolvedScopedReadModelScopeKeys(
      resolveDocumentReadModelScopeKeysServer(session, input.targetId)
    )
    return
  }

  await bumpWorkItemReadModelScopesServer(session, input.targetId)
}

export async function bumpAttachmentTargetReadModelScopesServer(
  session: AuthenticatedSession,
  input: {
    targetType: "workItem" | "document" | "conversation"
    targetId: string
  }
) {
  if (input.targetType === "conversation") {
    await bumpResolvedScopedReadModelScopeKeys(
      resolveConversationReadModelScopeKeysServer(session, input.targetId)
    )
    return
  }

  const commentTarget: {
    targetType: "workItem" | "document"
    targetId: string
  } = {
    targetType: input.targetType,
    targetId: input.targetId,
  }

  await bumpCommentTargetReadModelScopesServer(session, commentTarget)
}
