export type CollaborationErrorCode =
  | "collaboration_unauthenticated"
  | "collaboration_forbidden"
  | "collaboration_room_mismatch"
  | "collaboration_private_document"
  | "collaboration_document_deleted"
  | "collaboration_access_revoked"
  | "collaboration_schema_version_required"
  | "collaboration_schema_version_unsupported"
  | "collaboration_invalid_payload"
  | "collaboration_too_many_connections"
  | "collaboration_payload_too_large"
  | "collaboration_state_too_large"
  | "collaboration_sync_timeout"
  | "collaboration_stale_client_snapshot_rejected"
  | "collaboration_conflict_reload_required"
  | "collaboration_persist_failed"
  | "collaboration_unknown"

export type CollaborationErrorResponse = {
  ok: false
  code: CollaborationErrorCode
  message: string
  retryable?: boolean
  reloadRequired?: boolean
}

export const COLLABORATION_CLOSE_CODES = {
  unauthenticated: 4401,
  forbidden: 4403,
  notFound: 4404,
  timeout: 4408,
  invalidPayload: 4422,
  reloadRequired: 4499,
  tooManyConnections: 4503,
  tooLarge: 1009,
  internalError: 1011,
} as const

const DEFAULT_MESSAGES: Record<CollaborationErrorCode, string> = {
  collaboration_unauthenticated: "Collaboration authentication is required",
  collaboration_forbidden:
    "You do not have access to this collaboration session",
  collaboration_room_mismatch: "Collaboration room mismatch",
  collaboration_private_document:
    "Private documents do not support collaboration sessions",
  collaboration_document_deleted: "This document was deleted",
  collaboration_access_revoked: "Your access to this document changed",
  collaboration_schema_version_required:
    "Collaboration schema version is required",
  collaboration_schema_version_unsupported:
    "This page is out of date. Reload to continue editing.",
  collaboration_invalid_payload: "Invalid collaboration request payload",
  collaboration_too_many_connections:
    "This document has too many active editors",
  collaboration_payload_too_large: "Collaboration payload is too large",
  collaboration_state_too_large: "Collaboration document is too large",
  collaboration_sync_timeout:
    "Timed out waiting for collaboration document sync",
  collaboration_stale_client_snapshot_rejected:
    "Stale collaboration content was rejected",
  collaboration_conflict_reload_required:
    "This document changed elsewhere. Reload to continue editing.",
  collaboration_persist_failed: "Failed to persist collaboration document",
  collaboration_unknown: "Collaboration failed",
}

const RELOAD_REQUIRED_CODES = new Set<CollaborationErrorCode>([
  "collaboration_schema_version_required",
  "collaboration_schema_version_unsupported",
  "collaboration_conflict_reload_required",
])

const RETRYABLE_CODES = new Set<CollaborationErrorCode>([
  "collaboration_sync_timeout",
  "collaboration_persist_failed",
  "collaboration_unknown",
])

const COLLABORATION_ERROR_CODES = new Set<CollaborationErrorCode>(
  Object.keys(DEFAULT_MESSAGES) as CollaborationErrorCode[]
)

export function isCollaborationErrorCode(
  value: unknown
): value is CollaborationErrorCode {
  return (
    typeof value === "string" &&
    COLLABORATION_ERROR_CODES.has(value as CollaborationErrorCode)
  )
}

export function createCollaborationErrorResponse(
  code: CollaborationErrorCode,
  message = DEFAULT_MESSAGES[code]
): CollaborationErrorResponse {
  return {
    ok: false,
    code,
    message,
    ...(RETRYABLE_CODES.has(code) ? { retryable: true } : {}),
    ...(RELOAD_REQUIRED_CODES.has(code) ? { reloadRequired: true } : {}),
  }
}

export function isCollaborationErrorResponse(
  value: unknown
): value is CollaborationErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === false &&
    "code" in value &&
    typeof value.code === "string" &&
    "message" in value &&
    typeof value.message === "string"
  )
}

export function getCollaborationCloseCode(code: CollaborationErrorCode) {
  switch (code) {
    case "collaboration_unauthenticated":
      return COLLABORATION_CLOSE_CODES.unauthenticated
    case "collaboration_forbidden":
    case "collaboration_access_revoked":
    case "collaboration_private_document":
      return COLLABORATION_CLOSE_CODES.forbidden
    case "collaboration_document_deleted":
      return COLLABORATION_CLOSE_CODES.notFound
    case "collaboration_schema_version_required":
    case "collaboration_invalid_payload":
    case "collaboration_payload_too_large":
      return COLLABORATION_CLOSE_CODES.invalidPayload
    case "collaboration_schema_version_unsupported":
    case "collaboration_conflict_reload_required":
      return COLLABORATION_CLOSE_CODES.reloadRequired
    case "collaboration_too_many_connections":
      return COLLABORATION_CLOSE_CODES.tooManyConnections
    case "collaboration_state_too_large":
      return COLLABORATION_CLOSE_CODES.tooLarge
    case "collaboration_sync_timeout":
      return COLLABORATION_CLOSE_CODES.timeout
    default:
      return COLLABORATION_CLOSE_CODES.internalError
  }
}

export function getCollaborationErrorStatus(code: CollaborationErrorCode) {
  switch (code) {
    case "collaboration_unauthenticated":
      return 401
    case "collaboration_forbidden":
    case "collaboration_access_revoked":
    case "collaboration_private_document":
      return 403
    case "collaboration_document_deleted":
      return 404
    case "collaboration_conflict_reload_required":
      return 409
    case "collaboration_too_many_connections":
      return 429
    case "collaboration_schema_version_required":
    case "collaboration_schema_version_unsupported":
    case "collaboration_invalid_payload":
    case "collaboration_payload_too_large":
    case "collaboration_state_too_large":
      return 422
    case "collaboration_sync_timeout":
    case "collaboration_persist_failed":
      return 503
    default:
      return 500
  }
}

export function getCollaborationErrorCodeForCloseCode(
  closeCode: number
): CollaborationErrorCode | null {
  switch (closeCode) {
    case COLLABORATION_CLOSE_CODES.unauthenticated:
      return "collaboration_unauthenticated"
    case COLLABORATION_CLOSE_CODES.forbidden:
      return "collaboration_forbidden"
    case COLLABORATION_CLOSE_CODES.notFound:
      return "collaboration_document_deleted"
    case COLLABORATION_CLOSE_CODES.timeout:
      return "collaboration_sync_timeout"
    case COLLABORATION_CLOSE_CODES.invalidPayload:
      return "collaboration_invalid_payload"
    case COLLABORATION_CLOSE_CODES.reloadRequired:
      return "collaboration_conflict_reload_required"
    case COLLABORATION_CLOSE_CODES.tooManyConnections:
      return "collaboration_too_many_connections"
    case COLLABORATION_CLOSE_CODES.tooLarge:
      return "collaboration_state_too_large"
    case COLLABORATION_CLOSE_CODES.internalError:
      return "collaboration_persist_failed"
    default:
      return null
  }
}
