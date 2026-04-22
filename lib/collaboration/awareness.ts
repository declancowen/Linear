export type CollaborationRange = {
  anchor: number
  head: number
}

export type CollaborationCaretSide = "before" | "after"

export type CollaborationCaretRect = {
  left: number
  top: number
  height: number
}

export type CollaborationAwarenessInput = {
  userId: string
  sessionId: string
  name: string
  avatarUrl?: string | null
  color?: string | null
  typing?: boolean
  activeBlockId?: string | null
  cursor?: CollaborationRange | null
  selection?: CollaborationRange | null
  cursorSide?: CollaborationCaretSide | null
  cursorRect?: CollaborationCaretRect | null
}

export type CollaborationAwarenessState = {
  userId: string
  sessionId: string
  name: string
  avatarUrl: string | null
  color: string | null
  typing: boolean
  activeBlockId: string | null
  cursor: CollaborationRange | null
  selection: CollaborationRange | null
  cursorSide: CollaborationCaretSide | null
  cursorRect: CollaborationCaretRect | null
}

function requireNonEmpty(value: string, label: string) {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(`${label} is required`)
  }

  return normalized
}

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim()

  return normalized ? normalized : null
}

function normalizeRange(
  range: CollaborationRange | null | undefined
): CollaborationRange | null {
  if (!range) {
    return null
  }

  if (
    !Number.isInteger(range.anchor) ||
    !Number.isInteger(range.head) ||
    range.anchor < 0 ||
    range.head < 0
  ) {
    return null
  }

  return {
    anchor: range.anchor,
    head: range.head,
  }
}

function normalizeCursorSide(
  cursorSide: CollaborationCaretSide | null | undefined
) {
  return cursorSide === "before" || cursorSide === "after"
    ? cursorSide
    : null
}

function normalizeCursorRect(
  cursorRect: CollaborationCaretRect | null | undefined
): CollaborationCaretRect | null {
  if (!cursorRect) {
    return null
  }

  if (
    !Number.isFinite(cursorRect.left) ||
    !Number.isFinite(cursorRect.top) ||
    !Number.isFinite(cursorRect.height) ||
    cursorRect.height <= 0
  ) {
    return null
  }

  return {
    left: Math.round(cursorRect.left),
    top: Math.round(cursorRect.top),
    height: Math.max(1, Math.round(cursorRect.height)),
  }
}

export function createCollaborationAwarenessState(
  input: CollaborationAwarenessInput
): CollaborationAwarenessState {
  return {
    userId: requireNonEmpty(input.userId, "userId"),
    sessionId: requireNonEmpty(input.sessionId, "sessionId"),
    name: requireNonEmpty(input.name, "name"),
    avatarUrl: normalizeOptionalString(input.avatarUrl),
    color: normalizeOptionalString(input.color),
    typing: input.typing ?? false,
    activeBlockId: normalizeOptionalString(input.activeBlockId),
    cursor: normalizeRange(input.cursor),
    selection: normalizeRange(input.selection),
    cursorSide: normalizeCursorSide(input.cursorSide),
    cursorRect: normalizeCursorRect(input.cursorRect),
  }
}

export function areCollaborationRangesEqual(
  left: CollaborationRange | null,
  right: CollaborationRange | null
) {
  if (left === right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  return left.anchor === right.anchor && left.head === right.head
}
