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

export function toCollaborationError(error: unknown) {
  if (error instanceof PartyKitCollaborationError) {
    return error
  }

  const message = error instanceof Error ? error.message : String(error)

  if (
    message === "Missing collaboration token" ||
    message === "Invalid collaboration token" ||
    message === "Invalid collaboration token signature" ||
    message === "Expired collaboration token"
  ) {
    return new PartyKitCollaborationError(
      "collaboration_unauthenticated",
      message
    )
  }

  if (message === "Document not found" || message === "Work item not found") {
    return new PartyKitCollaborationError(
      "collaboration_document_deleted",
      message
    )
  }

  if (
    message === "You do not have permission to edit this document" ||
    message === "Collaboration flush requires editor access"
  ) {
    return new PartyKitCollaborationError("collaboration_forbidden", message)
  }

  if (message === "Private documents do not support collaboration sessions") {
    return new PartyKitCollaborationError(
      "collaboration_private_document",
      message
    )
  }

  if (message.includes("room mismatch")) {
    return new PartyKitCollaborationError(
      "collaboration_room_mismatch",
      message
    )
  }

  if (message.includes("too many active editors")) {
    return new PartyKitCollaborationError(
      "collaboration_too_many_connections",
      message
    )
  }

  if (message.includes("too large")) {
    return new PartyKitCollaborationError(
      "collaboration_payload_too_large",
      message
    )
  }

  if (
    message === "Invalid collaboration flush request" ||
    message === "Invalid collaboration refresh request" ||
    message.includes("JSON")
  ) {
    return new PartyKitCollaborationError(
      "collaboration_invalid_payload",
      message
    )
  }

  if (
    message.includes("schemaVersion") ||
    message.includes("protocolVersion")
  ) {
    return new PartyKitCollaborationError(
      message.includes("required")
        ? "collaboration_schema_version_required"
        : "collaboration_schema_version_unsupported",
      message
    )
  }

  return new PartyKitCollaborationError("collaboration_unknown", message)
}
