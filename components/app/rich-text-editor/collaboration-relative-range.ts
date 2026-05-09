export type CollaborationRelativePositionJson = Record<string, unknown>

export type CollaborationRelativeRange = {
  anchor: CollaborationRelativePositionJson | null
  head: CollaborationRelativePositionJson | null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function normalizeCollaborationRelativePosition(
  value: unknown
): CollaborationRelativePositionJson | null {
  return isRecord(value) ? value : null
}

export function normalizeCollaborationRelativeRange(
  value: unknown
): CollaborationRelativeRange | null {
  if (!isRecord(value)) {
    return null
  }

  const anchor = normalizeCollaborationRelativePosition(value.anchor)
  const head = normalizeCollaborationRelativePosition(value.head)

  if (!anchor || !head) {
    return null
  }

  return { anchor, head }
}
