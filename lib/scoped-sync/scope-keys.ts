const SCOPE_PART_PATTERN = /^[A-Za-z0-9_-]+$/

export const READ_MODEL_SCOPE_KINDS = {
  shellContext: "shell-context",
  workspaceMembership: "workspace-membership",
  workIndex: "work-index",
  workItemDetail: "work-item-detail",
  documentIndex: "document-index",
  privateDocumentIndex: "private-document-index",
  documentDetail: "document-detail",
  projectIndex: "project-index",
  projectDetail: "project-detail",
  viewCatalog: "view-catalog",
  notificationInbox: "notification-inbox",
  conversationList: "conversation-list",
  conversationThread: "conversation-thread",
  channelFeed: "channel-feed",
  searchSeed: "search-seed",
  privateSearchSeed: "private-search-seed",
} as const

export type ReadModelScopeKind =
  (typeof READ_MODEL_SCOPE_KINDS)[keyof typeof READ_MODEL_SCOPE_KINDS]

export type ReadModelScopeDescriptor = {
  kind: ReadModelScopeKind
  parts: string[]
  scopeKey: string
}

const READ_MODEL_SCOPE_KIND_SET = new Set<ReadModelScopeKind>(
  Object.values(READ_MODEL_SCOPE_KINDS)
)

function normalizeScopePart(value: string, label: string) {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(`${label} is required`)
  }

  if (!SCOPE_PART_PATTERN.test(normalized)) {
    throw new Error(
      `${label} must use only letters, numbers, underscores, or hyphens`
    )
  }

  return normalized
}

export function createReadModelScopeKey(
  kind: ReadModelScopeKind,
  ...parts: string[]
) {
  if (!READ_MODEL_SCOPE_KIND_SET.has(kind)) {
    throw new Error(`unsupported read-model scope kind: ${kind}`)
  }

  if (kind === READ_MODEL_SCOPE_KINDS.shellContext && parts.length > 0) {
    throw new Error("shell-context does not accept scope parts")
  }

  const normalizedParts = parts.map((part, index) =>
    normalizeScopePart(part, `scope part ${index + 1}`)
  )

  return [kind, ...normalizedParts].join(":")
}

export function parseReadModelScopeKey(
  scopeKey: string
): ReadModelScopeDescriptor | null {
  const normalizedScopeKey = scopeKey.trim()

  if (!normalizedScopeKey) {
    return null
  }

  const [kind, ...parts] = normalizedScopeKey.split(":")

  if (!READ_MODEL_SCOPE_KIND_SET.has(kind as ReadModelScopeKind)) {
    return null
  }

  if (
    (kind === READ_MODEL_SCOPE_KINDS.shellContext && parts.length > 0) ||
    parts.some((part) => !part || !SCOPE_PART_PATTERN.test(part))
  ) {
    return null
  }

  return {
    kind: kind as ReadModelScopeKind,
    parts,
    scopeKey: normalizedScopeKey,
  }
}

export function createShellContextScopeKey() {
  return READ_MODEL_SCOPE_KINDS.shellContext
}

export function createWorkspaceMembershipScopeKey(workspaceId: string) {
  return createReadModelScopeKey(
    READ_MODEL_SCOPE_KINDS.workspaceMembership,
    workspaceId
  )
}

export function createScopedCollectionScopeId(
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
) {
  return `${scopeType}_${scopeId}`
}

export function createWorkIndexScopeKey(scopeId: string) {
  return createReadModelScopeKey(READ_MODEL_SCOPE_KINDS.workIndex, scopeId)
}

export function createWorkItemDetailScopeKey(workItemId: string) {
  return createReadModelScopeKey(
    READ_MODEL_SCOPE_KINDS.workItemDetail,
    workItemId
  )
}

export function createDocumentIndexScopeKey(scopeId: string) {
  return createReadModelScopeKey(READ_MODEL_SCOPE_KINDS.documentIndex, scopeId)
}

export function createPrivateDocumentIndexScopeKey(
  workspaceId: string,
  userId: string
) {
  return createReadModelScopeKey(
    READ_MODEL_SCOPE_KINDS.privateDocumentIndex,
    workspaceId,
    userId
  )
}

export function createDocumentDetailScopeKey(documentId: string) {
  return createReadModelScopeKey(
    READ_MODEL_SCOPE_KINDS.documentDetail,
    documentId
  )
}

export function createProjectIndexScopeKey(scopeId: string) {
  return createReadModelScopeKey(READ_MODEL_SCOPE_KINDS.projectIndex, scopeId)
}

export function createProjectDetailScopeKey(projectId: string) {
  return createReadModelScopeKey(
    READ_MODEL_SCOPE_KINDS.projectDetail,
    projectId
  )
}

export function createViewCatalogScopeKey(scopeId: string) {
  return createReadModelScopeKey(READ_MODEL_SCOPE_KINDS.viewCatalog, scopeId)
}

export function createNotificationInboxScopeKey(userId: string) {
  return createReadModelScopeKey(
    READ_MODEL_SCOPE_KINDS.notificationInbox,
    userId
  )
}

export function createConversationListScopeKey(userId: string) {
  return createReadModelScopeKey(
    READ_MODEL_SCOPE_KINDS.conversationList,
    userId
  )
}

export function createConversationThreadScopeKey(conversationId: string) {
  return createReadModelScopeKey(
    READ_MODEL_SCOPE_KINDS.conversationThread,
    conversationId
  )
}

export function createChannelFeedScopeKey(conversationId: string) {
  return createReadModelScopeKey(
    READ_MODEL_SCOPE_KINDS.channelFeed,
    conversationId
  )
}

export function createSearchSeedScopeKey(scopeId: string) {
  return createReadModelScopeKey(READ_MODEL_SCOPE_KINDS.searchSeed, scopeId)
}

export function createPrivateSearchSeedScopeKey(
  workspaceId: string,
  userId: string
) {
  return createReadModelScopeKey(
    READ_MODEL_SCOPE_KINDS.privateSearchSeed,
    workspaceId,
    userId
  )
}
