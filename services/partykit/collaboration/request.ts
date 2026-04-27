import type { JSONContent } from "@tiptap/core"
import type { Request as PartyRequest } from "partykit/server"

import {
  COLLABORATION_FLUSH_PATH,
} from "../../../lib/collaboration/constants"
import {
  getJsonByteLength,
  getUtf8ByteLength,
  type CollaborationLimits,
} from "../../../lib/collaboration/limits"
import { PartyKitCollaborationError } from "./errors"

export type CollaborationFlushRequest =
  | {
      kind: "content"
    }
  | {
      kind: "teardown-content"
      contentJson: JSONContent
    }
  | {
      kind: "document-title"
      documentTitle: string
    }
  | {
      kind: "work-item-main"
      workItemExpectedUpdatedAt?: string
      workItemTitle?: string
    }

export type CollaborationRoomRefreshRequest = {
  kind: "canonical-updated" | "document-deleted" | "access-changed"
  documentId: string
  reason?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isCollaborationFlushRequestUrl(url: URL) {
  return (
    url.searchParams.get("action") ===
    COLLABORATION_FLUSH_PATH.replace("/", "")
  )
}

export function isCollaborationRefreshRequestUrl(url: URL) {
  return (
    url.searchParams.get("action") === "refresh" ||
    url.pathname.endsWith("/refresh")
  )
}

export async function parseFlushRequest(
  request: PartyRequest,
  limits: CollaborationLimits
): Promise<CollaborationFlushRequest> {
  const contentLength = request.headers.get("content-length")

  if (contentLength) {
    const parsedLength = Number(contentLength)

    if (
      Number.isFinite(parsedLength) &&
      parsedLength > limits.maxFlushBodyBytes
    ) {
      throw new PartyKitCollaborationError("collaboration_payload_too_large")
    }
  }

  const rawBody = await request.text()

  if (!rawBody.trim()) {
    throw new Error("Invalid collaboration flush request")
  }

  if (getUtf8ByteLength(rawBody) > limits.maxFlushBodyBytes) {
    throw new PartyKitCollaborationError("collaboration_payload_too_large")
  }

  const parsed = JSON.parse(rawBody) as unknown

  if (!isRecord(parsed)) {
    throw new Error("Invalid collaboration flush request")
  }

  if (parsed.kind === "document-title") {
    if (typeof parsed.documentTitle !== "string") {
      throw new Error("Invalid collaboration flush request")
    }

    return {
      kind: "document-title",
      documentTitle: parsed.documentTitle,
    }
  }

  if (parsed.kind === "content") {
    return {
      kind: "content",
    }
  }

  if (parsed.kind === "teardown-content") {
    if (!isRecord(parsed.contentJson)) {
      throw new Error("Invalid collaboration flush request")
    }

    if (getJsonByteLength(parsed.contentJson) > limits.maxContentJsonBytes) {
      throw new PartyKitCollaborationError("collaboration_payload_too_large")
    }

    return {
      kind: "teardown-content",
      contentJson: parsed.contentJson as JSONContent,
    }
  }

  if (parsed.kind === "work-item-main") {
    if (
      typeof parsed.workItemExpectedUpdatedAt !== "undefined" &&
      typeof parsed.workItemExpectedUpdatedAt !== "string"
    ) {
      throw new Error("Invalid collaboration flush request")
    }

    if (
      typeof parsed.workItemTitle !== "undefined" &&
      typeof parsed.workItemTitle !== "string"
    ) {
      throw new Error("Invalid collaboration flush request")
    }

    return {
      kind: "work-item-main",
      ...(typeof parsed.workItemExpectedUpdatedAt === "string"
        ? {
            workItemExpectedUpdatedAt: parsed.workItemExpectedUpdatedAt,
          }
        : {}),
      ...(typeof parsed.workItemTitle === "string"
        ? {
            workItemTitle: parsed.workItemTitle,
          }
        : {}),
    }
  }

  throw new Error("Invalid collaboration flush request")
}

export async function parseRefreshRequest(
  request: PartyRequest
): Promise<CollaborationRoomRefreshRequest> {
  const parsed = JSON.parse(await request.text()) as unknown

  if (!isRecord(parsed)) {
    throw new Error("Invalid collaboration refresh request")
  }

  if (
    parsed.kind !== "canonical-updated" &&
    parsed.kind !== "document-deleted" &&
    parsed.kind !== "access-changed"
  ) {
    throw new Error("Invalid collaboration refresh request")
  }

  if (typeof parsed.documentId !== "string" || !parsed.documentId.trim()) {
    throw new Error("Invalid collaboration refresh request")
  }

  if (
    typeof parsed.reason !== "undefined" &&
    typeof parsed.reason !== "string"
  ) {
    throw new Error("Invalid collaboration refresh request")
  }

  return {
    kind: parsed.kind,
    documentId: parsed.documentId.trim(),
    ...(typeof parsed.reason === "string" ? { reason: parsed.reason } : {}),
  }
}

export function createCollaborationRequestCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}
