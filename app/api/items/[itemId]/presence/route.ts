import { NextRequest } from "next/server"

import {
  clearWorkItemPresenceServer,
  heartbeatWorkItemPresenceServer,
} from "@/lib/server/convex"
import {
  createPresenceHeartbeatInput,
  handleConvexUserJsonRoute,
  presencePayloadSchema,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params

  return handleConvexUserJsonRoute(request, {
    schema: presencePayloadSchema,
    invalidMessage: "Invalid work item presence payload",
    failureLogLabel: "Failed to update work item presence",
    failureMessage: "Failed to update work item presence",
    failureCode: "WORK_ITEM_PRESENCE_UPDATE_FAILED",
    async handle({ authContext, authenticatedUser, parsed }) {
      if (parsed.action === "leave") {
        await clearWorkItemPresenceServer({
          currentUserId: authContext.currentUser.id,
          itemId,
          workosUserId: authenticatedUser.workosUserId,
          sessionId: parsed.sessionId,
        })

        return jsonOk({
          ok: true,
        })
      }

      const viewers = await heartbeatWorkItemPresenceServer({
        itemId,
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
    handleApplicationError(error, { parsed }) {
      if (
        error.code === "WORK_ITEM_NOT_FOUND" ||
        error.code === "WORK_ITEM_PRESENCE_UNAVAILABLE"
      ) {
        if (parsed.action === "leave") {
          return jsonOk({
            ok: true,
          })
        }

        return jsonOk({
          viewers: [],
        })
      }

      return undefined
    },
  })
}
