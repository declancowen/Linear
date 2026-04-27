export type CollaborationEventName =
  | "session_issued"
  | "connect_accepted"
  | "connect_rejected"
  | "room_seeded"
  | "flush_started"
  | "flush_succeeded"
  | "flush_failed"
  | "teardown_flush_skipped"
  | "refresh_received"
  | "refresh_applied"
  | "refresh_conflict"
  | "room_closed"
  | "limit_rejected"

export type CollaborationEventInput = {
  event: CollaborationEventName
  level?: "info" | "warn" | "error"
  roomId?: string | null
  documentId?: string | null
  sessionId?: string | null
  userId?: string | null
  code?: string | null
  durationMs?: number | null
  message?: string | null
}

export function recordCollaborationEvent(input: CollaborationEventInput) {
  const { level = "info", ...payload } = input
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  )

  if (level === "error") {
    console.error("[collaboration]", sanitizedPayload)
    return
  }

  if (level === "warn") {
    console.warn("[collaboration]", sanitizedPayload)
    return
  }

  console.info("[collaboration]", sanitizedPayload)
}
