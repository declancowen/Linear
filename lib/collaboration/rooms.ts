const DOCUMENT_COLLABORATION_ROOM_PREFIX = "doc"
const ROOM_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/

export type CollaborationRoomKind = "doc"

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

export function parseCollaborationRoomId(
  roomId: string
): CollaborationRoomDescriptor | null {
  const normalizedRoomId = roomId.trim()

  if (!normalizedRoomId) {
    return null
  }

  const [prefix, entityId, ...rest] = normalizedRoomId.split(":")

  if (prefix !== DOCUMENT_COLLABORATION_ROOM_PREFIX || rest.length > 0) {
    return null
  }

  if (!entityId || !ROOM_SEGMENT_PATTERN.test(entityId)) {
    return null
  }

  return {
    kind: "doc",
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
