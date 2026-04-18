import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  clearWorkItemPresenceServer,
  heartbeatWorkItemPresenceServer,
} from "@/lib/server/convex"
import { requireConvexUser, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

const workItemPresenceSchema = z.object({
  action: z.enum(["heartbeat", "leave"]),
  sessionId: z.string().trim().min(8).max(128),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const { itemId } = await params
  const parsed = await parseJsonBody(
    request,
    workItemPresenceSchema,
    "Invalid work item presence payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const authenticatedUser = toAuthenticatedAppUser(
      session.user,
      session.organizationId
    )
    const authContext = await requireConvexUser(session)

    if (isRouteResponse(authContext)) {
      return authContext
    }

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
      currentUserId: authContext.currentUser.id,
      itemId,
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
      name: authContext.currentUser.name,
      avatarUrl: authContext.currentUser.avatarUrl,
      avatarImageUrl: authContext.currentUser.avatarImageUrl ?? null,
      sessionId: parsed.sessionId,
    })

    return jsonOk({
      viewers,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
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

      return jsonApplicationError(error)
    }

    logProviderError("Failed to update work item presence", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update work item presence"),
      500,
      {
        code: "WORK_ITEM_PRESENCE_UPDATE_FAILED",
      }
    )
  }
}
