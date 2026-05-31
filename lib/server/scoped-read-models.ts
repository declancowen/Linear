import { createEmptyState } from "@/lib/domain/empty-state"
import type { AppSnapshot } from "@/lib/domain/types"
import type { AuthenticatedSession } from "@/lib/server/route-auth"
import {
  bumpScopedReadModelVersionsServer,
  getSnapshotServer,
} from "@/lib/server/convex"
import {
  applySelectedWorkspaceIdToSnapshot,
  getSelectedWorkspaceIdFromCookies,
} from "@/lib/server/workspace-selection"
import {
  getChannelPostRelatedScopeKeys,
  getChatMessageRelatedScopeKeys,
  getConversationRelatedScopeKeys,
  getCustomPropertyDefinitionScopeKeys,
  getDocumentIndexScopeKeys,
  getDocumentRelatedScopeKeys,
  getNotificationInboxScopeKeys,
  getPrivateDocumentIndexScopeKeys,
  getPrivateSearchSeedScopeKeys,
  getProjectIndexScopeKeys,
  getProjectRelatedScopeKeys,
  getUserWorkspaceMembershipScopeKeys,
  getViewRelatedScopeKeys,
  getWorkItemDetailScopeKeys,
  getWorkspaceMembershipScopeKeys,
  getSearchSeedScopeKeys,
} from "@/lib/scoped-sync/read-models"
import {
  parseReadModelScopeKey,
  READ_MODEL_SCOPE_KINDS,
} from "@/lib/scoped-sync/scope-keys"

export async function loadScopedReadModelSnapshotForSession(
  session: AuthenticatedSession
) {
  const snapshot = normalizeScopedReadModelSnapshot(
    (await getSnapshotServer({
      workosUserId: session.user.id,
      email: session.user.email ?? undefined,
    })) as Partial<AppSnapshot> | null | undefined
  )
  const selectedWorkspaceId = await getSelectedWorkspaceIdFromCookies()

  return applySelectedWorkspaceIdToSnapshot(snapshot, selectedWorkspaceId)
}

function normalizeScopedReadModelSnapshot(
  snapshot: Partial<AppSnapshot> | null | undefined
): AppSnapshot {
  const { ui: discardedUi, ...emptySnapshot } = createEmptyState()
  void discardedUi

  return {
    ...emptySnapshot,
    ...(snapshot ?? {}),
  } as AppSnapshot
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

function hasSingleKnownPart(parts: string[], knownIds: ReadonlySet<string>) {
  return parts.length === 1 && knownIds.has(parts[0])
}

function isCurrentUserScopedPart(snapshot: AppSnapshot, parts: string[]) {
  return parts.length === 1 && parts[0] === snapshot.currentUserId
}

function isPrivateWorkspaceScopedPart(
  snapshot: AppSnapshot,
  parts: string[],
  workspaceIds: ReadonlySet<string>
) {
  return (
    parts.length === 2 &&
    workspaceIds.has(parts[0]) &&
    parts[1] === snapshot.currentUserId
  )
}

function isAuthorizedCollectionScope(input: {
  rawScopeId: string
  workspaceIds: ReadonlySet<string>
  teamIds: ReadonlySet<string>
  currentUserId?: string
}) {
  const collectionScope = parseScopedCollectionScopeId(input.rawScopeId)

  if (!collectionScope) {
    return false
  }

  switch (collectionScope.scopeType) {
    case "workspace":
      return input.workspaceIds.has(collectionScope.scopeId)
    case "team":
      return input.teamIds.has(collectionScope.scopeId)
    case "personal":
      return collectionScope.scopeId === input.currentUserId
  }
}

type ReadModelScopeDescriptor = NonNullable<
  ReturnType<typeof parseReadModelScopeKey>
>

type ReadModelScopeAuthorizationContext = {
  conversationIds: ReadonlySet<string>
  documentIds: ReadonlySet<string>
  projectIds: ReadonlySet<string>
  teamIds: ReadonlySet<string>
  workItemIds: ReadonlySet<string>
  workspaceIds: ReadonlySet<string>
}

const workspaceSinglePartScopeKinds = new Set<string>([
  READ_MODEL_SCOPE_KINDS.workspaceMembership,
  READ_MODEL_SCOPE_KINDS.workspacePeople,
  READ_MODEL_SCOPE_KINDS.searchSeed,
])

const privateWorkspaceScopeKinds = new Set<string>([
  READ_MODEL_SCOPE_KINDS.privateDocumentIndex,
  READ_MODEL_SCOPE_KINDS.privateSearchSeed,
])

const currentUserScopeKinds = new Set<string>([
  READ_MODEL_SCOPE_KINDS.notificationInbox,
  READ_MODEL_SCOPE_KINDS.conversationList,
])

const collectionScopeKinds = new Set<string>([
  READ_MODEL_SCOPE_KINDS.documentIndex,
  READ_MODEL_SCOPE_KINDS.projectIndex,
  READ_MODEL_SCOPE_KINDS.viewCatalog,
])

function getReadModelScopeAuthorizationContext(
  snapshot: AppSnapshot
): ReadModelScopeAuthorizationContext {
  return {
    conversationIds: new Set(
      snapshot.conversations.map((conversation) => conversation.id)
    ),
    documentIds: new Set(
      snapshot.documents.map((document) => document.id)
    ),
    projectIds: new Set(snapshot.projects.map((project) => project.id)),
    teamIds: new Set(snapshot.teams.map((team) => team.id)),
    workItemIds: new Set(snapshot.workItems.map((item) => item.id)),
    workspaceIds: new Set(
      snapshot.workspaces.map((workspace) => workspace.id)
    ),
  }
}

function getKnownEntityScopeIds(
  context: ReadModelScopeAuthorizationContext,
  kind: string
) {
  switch (kind) {
    case READ_MODEL_SCOPE_KINDS.documentDetail:
      return context.documentIds
    case READ_MODEL_SCOPE_KINDS.workItemDetail:
      return context.workItemIds
    case READ_MODEL_SCOPE_KINDS.projectDetail:
      return context.projectIds
    case READ_MODEL_SCOPE_KINDS.conversationThread:
    case READ_MODEL_SCOPE_KINDS.channelFeed:
      return context.conversationIds
    default:
      return null
  }
}

function isAuthorizedReadModelScope(snapshot: AppSnapshot, scopeKey: string) {
  const descriptor = parseReadModelScopeKey(scopeKey)

  if (!descriptor) {
    throw new Error(`Invalid scoped read model key: ${scopeKey}`)
  }

  return isAuthorizedReadModelDescriptor(
    snapshot,
    descriptor,
    getReadModelScopeAuthorizationContext(snapshot)
  )
}

function isAuthorizedReadModelDescriptor(
  snapshot: AppSnapshot,
  descriptor: ReadModelScopeDescriptor,
  context: ReadModelScopeAuthorizationContext
) {
  if (descriptor.kind === READ_MODEL_SCOPE_KINDS.shellContext) {
    return true
  }

  if (workspaceSinglePartScopeKinds.has(descriptor.kind)) {
    return hasSingleKnownPart(descriptor.parts, context.workspaceIds)
  }

  if (privateWorkspaceScopeKinds.has(descriptor.kind)) {
    return isPrivateWorkspaceScopedPart(
      snapshot,
      descriptor.parts,
      context.workspaceIds
    )
  }

  if (currentUserScopeKinds.has(descriptor.kind)) {
    return isCurrentUserScopedPart(snapshot, descriptor.parts)
  }

  const knownIds = getKnownEntityScopeIds(context, descriptor.kind)

  if (knownIds) {
    return hasSingleKnownPart(descriptor.parts, knownIds)
  }

  if (collectionScopeKinds.has(descriptor.kind)) {
    return (
      descriptor.parts.length === 1 &&
      isAuthorizedCollectionScope({
        rawScopeId: descriptor.parts[0],
        workspaceIds: context.workspaceIds,
        teamIds: context.teamIds,
      })
    )
  }

  return (
    descriptor.kind === READ_MODEL_SCOPE_KINDS.workIndex &&
    descriptor.parts.length === 1 &&
    isAuthorizedCollectionScope({
      rawScopeId: descriptor.parts[0],
      workspaceIds: context.workspaceIds,
      teamIds: context.teamIds,
      currentUserId: snapshot.currentUserId,
    })
  )
}

export async function authorizeScopedReadModelScopeKeysServer(
  session: AuthenticatedSession,
  scopeKeys: string[]
) {
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

  for (const scopeKey of scopeKeys) {
    if (!isAuthorizedReadModelScope(snapshot, scopeKey)) {
      throw new Error(`Unauthorized scoped read model key: ${scopeKey}`)
    }
  }
}

export async function resolveDocumentReadModelScopeKeysServer(
  session: AuthenticatedSession,
  documentId: string
) {
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

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

export async function bumpUserWorkspaceMembershipReadModelScopesServer(
  session: AuthenticatedSession,
  userId: string
) {
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

  await bumpScopedReadModelVersionsServer({
    scopeKeys: getUserWorkspaceMembershipScopeKeys(snapshot, userId),
  })
}

export async function bumpWorkItemReadModelScopesServer(
  session: AuthenticatedSession,
  itemId: string
) {
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

  await bumpScopedReadModelVersionsServer({
    scopeKeys: getWorkItemDetailScopeKeys(snapshot, itemId),
  })
}

export async function resolveWorkItemReadModelScopeKeysServer(
  session: AuthenticatedSession,
  itemId: string
) {
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

  return getWorkItemDetailScopeKeys(snapshot, itemId)
}

export async function resolveCustomPropertyDefinitionReadModelScopeKeysServer(
  session: AuthenticatedSession,
  teamId: string
) {
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

  return getCustomPropertyDefinitionScopeKeys(snapshot, teamId)
}

export async function resolveProjectReadModelScopeKeysServer(
  session: AuthenticatedSession,
  projectId: string
) {
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

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

export async function resolveViewReadModelScopeKeysServer(
  session: AuthenticatedSession,
  viewId: string
) {
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

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
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

  return getConversationRelatedScopeKeys(snapshot, conversationId)
}

export async function resolveChannelPostReadModelScopeKeysServer(
  session: AuthenticatedSession,
  postId: string
) {
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

  return getChannelPostRelatedScopeKeys(snapshot, postId)
}

export async function resolveChatMessageReadModelScopeKeysServer(
  session: AuthenticatedSession,
  messageId: string
) {
  const snapshot = await loadScopedReadModelSnapshotForSession(session)

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
    const snapshot = await loadScopedReadModelSnapshotForSession(session)

    await bumpScopedReadModelVersionsServer({
      scopeKeys: getDocumentRelatedScopeKeys(snapshot, input.targetId),
    })
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
