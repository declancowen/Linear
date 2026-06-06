import { ApplicationError } from "@/lib/server/application-errors"
import {
  isCloudflareYjsBodySource,
  normalizeCollaborationBodySource,
} from "@/lib/collaboration/body-source"
import {
  COLLABORATION_MIGRATE_BODY_ACTION,
  COLLABORATION_PARTY_NAME,
} from "@/lib/collaboration/constants"
import { COLLABORATION_PROTOCOL_VERSION } from "@/lib/collaboration/protocol"
import { createDocumentCollaborationRoomId } from "@/lib/collaboration/rooms"
import { handleDocumentCollaborationRoute } from "@/lib/server/collaboration-document-route"
import { getCollaborationServiceUrlForRequest } from "@/lib/server/collaboration-service-url"
import { createSignedCollaborationToken } from "@/lib/server/collaboration-token"
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

const MIGRATION_TTL_SECONDS = 60

function isBodyMigrationEnabled() {
  return process.env.COLLABORATION_BODY_MIGRATION_ENABLED === "true"
}

function createRoomMigrationUrl(serviceUrl: string, roomId: string) {
  const parsedServiceUrl = new URL(serviceUrl)
  const normalizedPath = parsedServiceUrl.pathname.replace(/\/$/, "")
  const migrationUrl = new URL(
    `${normalizedPath}/parties/${COLLABORATION_PARTY_NAME}/${encodeURIComponent(roomId)}`,
    parsedServiceUrl.origin
  )

  migrationUrl.searchParams.set("action", COLLABORATION_MIGRATE_BODY_ACTION)

  return migrationUrl
}

function createPartyKitResponse(response: Response, body: string) {
  return new Response(body || JSON.stringify({ ok: response.ok }), {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
    },
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  return handleDocumentCollaborationRoute(
    request,
    params,
    async ({ currentUserId, documentId, request }) => {
      try {
        if (!isBodyMigrationEnabled()) {
          throw new ApplicationError(
            "Collaboration body migration is not enabled",
            503,
            {
              code: "COLLABORATION_UNAVAILABLE",
            }
          )
        }

        const collaborationDocument = await getCollaborationDocumentServer({
          currentUserId,
          documentId,
        })

        if (collaborationDocument.kind === "private-document") {
          throw new ApplicationError(
            "Private documents do not support collaboration body migration",
            503,
            {
              code: "COLLABORATION_UNAVAILABLE",
            }
          )
        }

        if (!collaborationDocument.canEdit) {
          throw new ApplicationError(
            "You do not have permission to migrate this document",
            403,
            {
              code: "COLLABORATION_FORBIDDEN",
            }
          )
        }

        const bodySource = normalizeCollaborationBodySource(
          collaborationDocument.bodySource
        )

        if (isCloudflareYjsBodySource(bodySource)) {
          return jsonOk({
            ok: true,
            migrated: false,
            bodySource,
            bodyMigratedAt: collaborationDocument.bodyMigratedAt ?? null,
          })
        }

        const issuedAt = Math.floor(Date.now() / 1000)
        const expiresAt = issuedAt + MIGRATION_TTL_SECONDS
        const roomId = createDocumentCollaborationRoomId(documentId)
        const token = createSignedCollaborationToken({
          kind: "internal-migration",
          sub: "server",
          roomId,
          documentId,
          currentUserId,
          action: "migrate-body",
          protocolVersion: COLLABORATION_PROTOCOL_VERSION,
          iat: issuedAt,
          exp: expiresAt,
        })
        const response = await fetch(
          createRoomMigrationUrl(
            getCollaborationServiceUrlForRequest(request),
            roomId
          ),
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        )

        return createPartyKitResponse(response, await response.text())
      } catch (error) {
        if (error instanceof ApplicationError) {
          return jsonApplicationError(error)
        }

        const message = getConvexErrorMessage(
          error,
          "Failed to migrate collaboration document body"
        )
        const status = message.includes("not configured") ? 503 : 500
        logProviderError("Failed to migrate collaboration document body", error)
        return jsonError(message, status, {
          code: "COLLABORATION_BODY_MIGRATION_FAILED",
        })
      }
    }
  )
}
