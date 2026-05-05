export type PresenceSessionFallbackState = {
  userId: string | null
  sessionId: string
}

export function createPresenceSessionId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID()
  }

  return `presence_${Math.random().toString(36).slice(2, 10)}`
}

function createFallbackPresenceSessionState(currentUserId?: string | null) {
  return {
    userId: currentUserId ?? null,
    sessionId: createPresenceSessionId(),
  }
}

export function getNextFallbackPresenceSessionState(
  currentState: PresenceSessionFallbackState | null,
  currentUserId?: string | null
) {
  if (!currentState) {
    return createFallbackPresenceSessionState(currentUserId)
  }

  if (currentUserId && !currentState.userId) {
    return {
      ...currentState,
      userId: currentUserId,
    }
  }

  if (currentUserId && currentState.userId !== currentUserId) {
    return createFallbackPresenceSessionState(currentUserId)
  }

  return currentState
}
