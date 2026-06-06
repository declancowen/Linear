import { randomUUID } from "node:crypto"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  isCloudflareYjsBodySource,
  normalizeCollaborationBodySource,
} from "@/lib/collaboration/body-source"
import { createCanonicalContentJson } from "@/lib/collaboration/canonical-content"
import { resolveCollaborationLimits } from "@/lib/collaboration/limits"
import { recordCollaborationEvent } from "@/lib/collaboration/observability"
import {
  COLLABORATION_PROTOCOL_VERSION,
  RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
} from "@/lib/collaboration/protocol"
import { createDocumentCollaborationRoomId } from "@/lib/collaboration/rooms"
import { getCollaborationServiceUrlForRequest } from "@/lib/server/collaboration-service-url"
import { createSignedCollaborationToken } from "@/lib/server/collaboration-token"
import { handleDocumentCollaborationRoute } from "@/lib/server/collaboration-document-route"
import { getCollaborationDocumentServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import {
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const SESSION_TTL_SECONDS = 60 * 5

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  return handleDocumentCollaborationRoute(
    request,
    params,
    async ({ appContext, documentId, request }) => {
      try {
        const collaborationDocument = await getCollaborationDocumentServer({
          currentUserId: appContext.ensuredUser.userId,
          documentId,
        })

        if (collaborationDocument.kind === "private-document") {
          throw new ApplicationError(
            "Private documents do not support collaboration sessions",
            503,
            {
              code: "COLLABORATION_UNAVAILABLE",
            }
          )
        }

        const issuedAt = Math.floor(Date.now() / 1000)
        const expiresAt = issuedAt + SESSION_TTL_SECONDS
        const sessionId = randomUUID()
        const roomId = createDocumentCollaborationRoomId(documentId)
        const role = collaborationDocument.canEdit ? "editor" : "viewer"
        const limits = resolveCollaborationLimits(process.env)
        const bodySource = normalizeCollaborationBodySource(
          collaborationDocument.bodySource
        )
        const includeConvexBootstrapContent =
          !isCloudflareYjsBodySource(bodySource)
        const token = createSignedCollaborationToken({
          kind: "doc",
          sub: appContext.ensuredUser.userId,
          roomId,
          documentId,
          role,
          sessionId,
          workspaceId: collaborationDocument.workspaceId ?? null,
          protocolVersion: COLLABORATION_PROTOCOL_VERSION,
          schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
          iat: issuedAt,
          exp: expiresAt,
        })
        recordCollaborationEvent({
          event: "session_issued",
          roomId,
          documentId,
          sessionId,
          userId: appContext.ensuredUser.userId,
        })

        return jsonOk({
          roomId,
          documentId,
          token,
          serviceUrl: getCollaborationServiceUrlForRequest(request),
          role,
          sessionId,
          protocolVersion: COLLABORATION_PROTOCOL_VERSION,
          schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
          limits,
          expiresAt,
          bodySource,
          bodyMigratedAt: collaborationDocument.bodyMigratedAt ?? null,
          ...(includeConvexBootstrapContent
            ? {
                contentJson: createCanonicalContentJson(
                  collaborationDocument.content
                ),
                contentHtml: collaborationDocument.content,
              }
            : {}),
        })
      } catch (error) {
        if (error instanceof ApplicationError) {
          return jsonApplicationError(error)
        }

        const message = getConvexErrorMessage(
          error,
          "Failed to create collaboration session"
        )
        const status = message.includes("not configured") ? 503 : 500
        logProviderError("Failed to create collaboration session", error)
        return jsonError(message, status, {
          code: "COLLABORATION_SESSION_CREATE_FAILED",
        })
      }
    }
  )
}
