import {
  createCollaborationErrorResponse,
  getCollaborationCloseCode,
  getCollaborationErrorStatus,
  type CollaborationErrorCode,
} from "../../../lib/collaboration/errors"

export class PartyKitCollaborationError extends Error {
  readonly code: CollaborationErrorCode
  readonly status: number
  readonly closeCode: number

  constructor(code: CollaborationErrorCode, message?: string) {
    const response = createCollaborationErrorResponse(code, message)
    super(response.message)
    this.name = "PartyKitCollaborationError"
    this.code = code
    this.status = getCollaborationErrorStatus(code)
    this.closeCode = getCollaborationCloseCode(code)
  }
}

const EXACT_COLLABORATION_ERROR_CODES: Array<{
  messages: readonly string[]
  code: CollaborationErrorCode
}> = [
  {
    messages: [
      "Missing collaboration token",
      "Invalid collaboration token",
      "Invalid collaboration token signature",
      "Expired collaboration token",
    ],
    code: "collaboration_unauthenticated",
  },
  {
    messages: ["Document not found", "Work item not found"],
    code: "collaboration_document_deleted",
  },
  {
    messages: [
      "You do not have permission to edit this document",
      "Collaboration flush requires editor access",
    ],
    code: "collaboration_forbidden",
  },
  {
    messages: ["Private documents do not support collaboration sessions"],
    code: "collaboration_private_document",
  },
  {
    messages: [
      "Invalid collaboration flush request",
      "Invalid collaboration refresh request",
    ],
    code: "collaboration_invalid_payload",
  },
]

const SUBSTRING_COLLABORATION_ERROR_CODES: Array<{
  match: string
  code: CollaborationErrorCode
}> = [
  {
    match: "room mismatch",
    code: "collaboration_room_mismatch",
  },
  {
    match: "too many active editors",
    code: "collaboration_too_many_connections",
  },
  {
    match: "too large",
    code: "collaboration_payload_too_large",
  },
  {
    match: "JSON",
    code: "collaboration_invalid_payload",
  },
]

function getCollaborationErrorCodeForMessage(
  message: string
): CollaborationErrorCode {
  const exactMatch = EXACT_COLLABORATION_ERROR_CODES.find((entry) =>
    entry.messages.includes(message)
  )

  if (exactMatch) {
    return exactMatch.code
  }

  const substringMatch = SUBSTRING_COLLABORATION_ERROR_CODES.find((entry) =>
    message.includes(entry.match)
  )

  if (substringMatch) {
    return substringMatch.code
  }

  if (message.includes("schemaVersion") || message.includes("protocolVersion")) {
    return message.includes("required")
      ? "collaboration_schema_version_required"
      : "collaboration_schema_version_unsupported"
  }

  return "collaboration_unknown"
}

export function toCollaborationError(error: unknown) {
  if (error instanceof PartyKitCollaborationError) {
    return error
  }

  const message = error instanceof Error ? error.message : String(error)

  return new PartyKitCollaborationError(
    getCollaborationErrorCodeForMessage(message),
    message
  )
}
