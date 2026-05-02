import { NextRequest } from "next/server"

import {
  clearDocumentPresenceServer,
  heartbeatDocumentPresenceServer,
} from "@/lib/server/convex"
import {
  createPresenceHeartbeatInput,
  handleConvexUserJsonRoute,
  presencePayloadSchema,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return handleConvexUserJsonRoute(request, {
    schema: presencePayloadSchema,
    invalidMessage: "Invalid document presence payload",
    failureLogLabel: "Failed to update document presence",
    failureMessage: "Failed to update document presence",
    failureCode: "DOCUMENT_PRESENCE_UPDATE_FAILED",
    async handle({ authContext, authenticatedUser, parsed }) {
      if (parsed.action === "leave") {
        await clearDocumentPresenceServer({
          currentUserId: authContext.currentUser.id,
          documentId,
          workosUserId: authenticatedUser.workosUserId,
          sessionId: parsed.sessionId,
        })

        return jsonOk({
          ok: true,
        })
      }

      const viewers = await heartbeatDocumentPresenceServer({
        documentId,
        ...createPresenceHeartbeatInput({
          authContext,
          authenticatedUser,
          parsed,
        }),
      })

      return jsonOk({
        viewers,
      })
    },
  })
}
