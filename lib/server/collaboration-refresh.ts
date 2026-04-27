import { COLLABORATION_PARTY_NAME } from "@/lib/collaboration/constants"
import {
  resolveCollaborationRefreshTimeoutMs,
  resolveCollaborationServiceUrl,
} from "@/lib/collaboration/config"
import { createDocumentCollaborationRoomId } from "@/lib/collaboration/rooms"
import { COLLABORATION_PROTOCOL_VERSION } from "@/lib/collaboration/protocol"
import { createSignedCollaborationToken } from "@/lib/server/collaboration-token"

type CollaborationRefreshKind =
  | "canonical-updated"
  | "document-deleted"
  | "access-changed"

function createRoomRefreshUrl(serviceUrl: string, roomId: string) {
  const parsedServiceUrl = new URL(serviceUrl)
  const normalizedPath = parsedServiceUrl.pathname.replace(/\/$/, "")
  const refreshUrl = new URL(
    `${normalizedPath}/parties/${COLLABORATION_PARTY_NAME}/${encodeURIComponent(roomId)}`,
    parsedServiceUrl.origin
  )

  refreshUrl.searchParams.set("action", "refresh")

  return refreshUrl
}

export async function notifyCollaborationDocumentChangedServer(input: {
  documentId: string
  kind: CollaborationRefreshKind
  reason?: string
}) {
  const serviceUrl = resolveCollaborationServiceUrl(process.env)
  const timeoutMs = resolveCollaborationRefreshTimeoutMs(process.env)

  if (!serviceUrl) {
    return {
      ok: false,
      reason: "Collaboration service URL is not configured",
    }
  }

  try {
    const issuedAt = Math.floor(Date.now() / 1000)
    const roomId = createDocumentCollaborationRoomId(input.documentId)
    const token = createSignedCollaborationToken({
      kind: "internal-refresh",
      sub: "server",
      roomId,
      documentId: input.documentId,
      action: "refresh",
      protocolVersion: COLLABORATION_PROTOCOL_VERSION,
      iat: issuedAt,
      exp: issuedAt + 60,
    })
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, timeoutMs)

    try {
      const response = await fetch(createRoomRefreshUrl(serviceUrl, roomId), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: abortController.signal,
      })

      if (!response.ok) {
        return {
          ok: false,
          reason: await response.text(),
        }
      }

      return {
        ok: true,
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        return {
          ok: false,
          reason: `Collaboration refresh notification timed out after ${timeoutMs}ms`,
        }
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "Failed to notify collaboration room",
    }
  }
}
