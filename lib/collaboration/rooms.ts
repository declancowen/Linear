const DOCUMENT_COLLABORATION_ROOM_PREFIX = "doc"
const CHAT_COLLABORATION_ROOM_PREFIX = "chat"
const ROOM_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/

export type CollaborationRoomKind = "doc" | "chat"

export type CollaborationRoomDescriptor = {
  kind: CollaborationRoomKind
  roomId: string
  entityId: string
}

function normalizeRoomSegment(value: string, label: string) {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(`${label} is required`)
  }

  if (!ROOM_SEGMENT_PATTERN.test(normalized)) {
    throw new Error(
      `${label} must use only letters, numbers, underscores, or hyphens`
    )
  }

  return normalized
}

export function createDocumentCollaborationRoomId(documentId: string) {
  const normalizedDocumentId = normalizeRoomSegment(documentId, "documentId")

  return `${DOCUMENT_COLLABORATION_ROOM_PREFIX}:${normalizedDocumentId}`
}

export function createChatCollaborationRoomId(conversationId: string) {
  const normalizedConversationId = normalizeRoomSegment(
    conversationId,
    "conversationId"
  )

  return `${CHAT_COLLABORATION_ROOM_PREFIX}:${normalizedConversationId}`
}

export function parseCollaborationRoomId(
  roomId: string
): CollaborationRoomDescriptor | null {
  const normalizedRoomId = roomId.trim()

  if (!normalizedRoomId) {
    return null
  }

  const [prefix, entityId, ...rest] = normalizedRoomId.split(":")

  if (
    (prefix !== DOCUMENT_COLLABORATION_ROOM_PREFIX &&
      prefix !== CHAT_COLLABORATION_ROOM_PREFIX) ||
    rest.length > 0
  ) {
    return null
  }

  if (!entityId || !ROOM_SEGMENT_PATTERN.test(entityId)) {
    return null
  }

  return {
    kind:
      prefix === DOCUMENT_COLLABORATION_ROOM_PREFIX
        ? "doc"
        : "chat",
    roomId: normalizedRoomId,
    entityId,
  }
}

export function isDocumentCollaborationRoomId(
  roomId: string,
  documentId: string
) {
  try {
    return roomId === createDocumentCollaborationRoomId(documentId)
  } catch {
    return false
  }
}

export function isChatCollaborationRoomId(
  roomId: string,
  conversationId: string
) {
  try {
    return roomId === createChatCollaborationRoomId(conversationId)
  } catch {
    return false
  }
}
