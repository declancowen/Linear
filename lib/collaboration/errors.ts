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

const COLLABORATION_CLOSE_CODES = {
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

const CLOSE_CODE_BY_COLLABORATION_ERROR_CODE: Partial<
  Record<CollaborationErrorCode, number>
> = {
  collaboration_unauthenticated: COLLABORATION_CLOSE_CODES.unauthenticated,
  collaboration_room_mismatch: COLLABORATION_CLOSE_CODES.unauthenticated,
  collaboration_forbidden: COLLABORATION_CLOSE_CODES.forbidden,
  collaboration_access_revoked: COLLABORATION_CLOSE_CODES.forbidden,
  collaboration_private_document: COLLABORATION_CLOSE_CODES.forbidden,
  collaboration_document_deleted: COLLABORATION_CLOSE_CODES.notFound,
  collaboration_schema_version_required: COLLABORATION_CLOSE_CODES.invalidPayload,
  collaboration_invalid_payload: COLLABORATION_CLOSE_CODES.invalidPayload,
  collaboration_payload_too_large: COLLABORATION_CLOSE_CODES.invalidPayload,
  collaboration_schema_version_unsupported:
    COLLABORATION_CLOSE_CODES.reloadRequired,
  collaboration_conflict_reload_required:
    COLLABORATION_CLOSE_CODES.reloadRequired,
  collaboration_too_many_connections: COLLABORATION_CLOSE_CODES.tooManyConnections,
  collaboration_state_too_large: COLLABORATION_CLOSE_CODES.tooLarge,
  collaboration_sync_timeout: COLLABORATION_CLOSE_CODES.timeout,
}

const STATUS_BY_COLLABORATION_ERROR_CODE: Partial<
  Record<CollaborationErrorCode, number>
> = {
  collaboration_unauthenticated: 401,
  collaboration_room_mismatch: 401,
  collaboration_forbidden: 403,
  collaboration_access_revoked: 403,
  collaboration_private_document: 403,
  collaboration_document_deleted: 404,
  collaboration_conflict_reload_required: 409,
  collaboration_too_many_connections: 429,
  collaboration_schema_version_required: 422,
  collaboration_schema_version_unsupported: 422,
  collaboration_invalid_payload: 422,
  collaboration_payload_too_large: 422,
  collaboration_state_too_large: 422,
  collaboration_sync_timeout: 503,
  collaboration_persist_failed: 503,
}

const COLLABORATION_ERROR_CODE_BY_CLOSE_CODE = new Map<
  number,
  CollaborationErrorCode
>([
  [COLLABORATION_CLOSE_CODES.unauthenticated, "collaboration_unauthenticated"],
  [COLLABORATION_CLOSE_CODES.forbidden, "collaboration_forbidden"],
  [COLLABORATION_CLOSE_CODES.notFound, "collaboration_document_deleted"],
  [COLLABORATION_CLOSE_CODES.timeout, "collaboration_sync_timeout"],
  [COLLABORATION_CLOSE_CODES.invalidPayload, "collaboration_invalid_payload"],
  [
    COLLABORATION_CLOSE_CODES.reloadRequired,
    "collaboration_conflict_reload_required",
  ],
  [
    COLLABORATION_CLOSE_CODES.tooManyConnections,
    "collaboration_too_many_connections",
  ],
  [COLLABORATION_CLOSE_CODES.tooLarge, "collaboration_state_too_large"],
  [COLLABORATION_CLOSE_CODES.internalError, "collaboration_persist_failed"],
])

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
    isCollaborationErrorCode(value.code) &&
    "message" in value &&
    typeof value.message === "string"
  )
}

export function getCollaborationCloseCode(code: CollaborationErrorCode) {
  return (
    CLOSE_CODE_BY_COLLABORATION_ERROR_CODE[code] ??
    COLLABORATION_CLOSE_CODES.internalError
  )
}

export function getCollaborationErrorStatus(code: CollaborationErrorCode) {
  return STATUS_BY_COLLABORATION_ERROR_CODE[code] ?? 500
}

export function getCollaborationErrorCodeForCloseCode(
  closeCode: number
): CollaborationErrorCode | null {
  return COLLABORATION_ERROR_CODE_BY_CLOSE_CODE.get(closeCode) ?? null
}
