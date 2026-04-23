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
  getPrivateDocumentIndexScopeKeys,
  getPrivateSearchSeedScopeKeys,
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
import {
  parseReadModelScopeKey,
  READ_MODEL_SCOPE_KINDS,
} from "@/lib/scoped-sync/scope-keys"

async function loadSnapshotForSession(session: AuthenticatedSession) {
  return (await getSnapshotServer({
    workosUserId: session.user.id,
    email: session.user.email ?? undefined,
  })) as AppSnapshot
}

function parseScopedCollectionScopeId(value: string) {
  if (value.startsWith("workspace_")) {
    return {
      scopeType: "workspace" as const,
      scopeId: value.slice("workspace_".length),
    }
  }

  if (value.startsWith("team_")) {
    return {
      scopeType: "team" as const,
      scopeId: value.slice("team_".length),
    }
  }

  if (value.startsWith("personal_")) {
    return {
      scopeType: "personal" as const,
      scopeId: value.slice("personal_".length),
    }
  }

  return null
}

function isAuthorizedReadModelScope(snapshot: AppSnapshot, scopeKey: string) {
  const descriptor = parseReadModelScopeKey(scopeKey)

  if (!descriptor) {
    throw new Error(`Invalid scoped read model key: ${scopeKey}`)
  }

  const workspaceIds = new Set(snapshot.workspaces.map((workspace) => workspace.id))
  const teamIds = new Set(snapshot.teams.map((team) => team.id))
  const documentIds = new Set(snapshot.documents.map((document) => document.id))
  const workItemIds = new Set(snapshot.workItems.map((item) => item.id))
  const projectIds = new Set(snapshot.projects.map((project) => project.id))
  const conversationIds = new Set(
    snapshot.conversations.map((conversation) => conversation.id)
  )

  switch (descriptor.kind) {
    case READ_MODEL_SCOPE_KINDS.shellContext:
      return true

    case READ_MODEL_SCOPE_KINDS.workspaceMembership:
    case READ_MODEL_SCOPE_KINDS.searchSeed:
      return descriptor.parts.length === 1 && workspaceIds.has(descriptor.parts[0])

    case READ_MODEL_SCOPE_KINDS.privateDocumentIndex:
    case READ_MODEL_SCOPE_KINDS.privateSearchSeed:
      return (
        descriptor.parts.length === 2 &&
        workspaceIds.has(descriptor.parts[0]) &&
        descriptor.parts[1] === snapshot.currentUserId
      )

    case READ_MODEL_SCOPE_KINDS.notificationInbox:
    case READ_MODEL_SCOPE_KINDS.conversationList:
      return (
        descriptor.parts.length === 1 &&
        descriptor.parts[0] === snapshot.currentUserId
      )

    case READ_MODEL_SCOPE_KINDS.documentDetail:
      return descriptor.parts.length === 1 && documentIds.has(descriptor.parts[0])

    case READ_MODEL_SCOPE_KINDS.workItemDetail:
      return descriptor.parts.length === 1 && workItemIds.has(descriptor.parts[0])

    case READ_MODEL_SCOPE_KINDS.projectDetail:
      return descriptor.parts.length === 1 && projectIds.has(descriptor.parts[0])

    case READ_MODEL_SCOPE_KINDS.conversationThread:
    case READ_MODEL_SCOPE_KINDS.channelFeed:
      return (
        descriptor.parts.length === 1 &&
        conversationIds.has(descriptor.parts[0])
      )

    case READ_MODEL_SCOPE_KINDS.documentIndex:
    case READ_MODEL_SCOPE_KINDS.projectIndex:
    case READ_MODEL_SCOPE_KINDS.viewCatalog: {
      if (descriptor.parts.length !== 1) {
        return false
      }

      const collectionScope = parseScopedCollectionScopeId(descriptor.parts[0])

      if (!collectionScope) {
        return false
      }

      return collectionScope.scopeType === "workspace"
        ? workspaceIds.has(collectionScope.scopeId)
        : collectionScope.scopeType === "team"
          ? teamIds.has(collectionScope.scopeId)
          : false
    }

    case READ_MODEL_SCOPE_KINDS.workIndex: {
      if (descriptor.parts.length !== 1) {
        return false
      }

      const collectionScope = parseScopedCollectionScopeId(descriptor.parts[0])

      if (!collectionScope) {
        return false
      }

      if (collectionScope.scopeType === "workspace") {
        return workspaceIds.has(collectionScope.scopeId)
      }

      if (collectionScope.scopeType === "team") {
        return teamIds.has(collectionScope.scopeId)
      }

      return collectionScope.scopeId === snapshot.currentUserId
    }

    default:
      return false
  }
}

export async function authorizeScopedReadModelScopeKeysServer(
  session: AuthenticatedSession,
  scopeKeys: string[]
) {
  const snapshot = await loadSnapshotForSession(session)

  for (const scopeKey of scopeKeys) {
    if (!isAuthorizedReadModelScope(snapshot, scopeKey)) {
      throw new Error(`Unauthorized scoped read model key: ${scopeKey}`)
    }
  }
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
