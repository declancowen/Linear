import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  archiveNotificationServer,
  unarchiveNotificationServer,
} from "@/lib/server/convex"
import { bumpNotificationInboxReadModelScopesServer } from "@/lib/server/scoped-read-models"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireConvexUser, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const notificationsMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("archive"),
    notificationIds: z.array(z.string()),
  }),
  z.object({
    action: z.literal("unarchive"),
    notificationIds: z.array(z.string()),
  }),
])

export async function PATCH(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    notificationsMutationSchema,
    "Invalid notification request"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const authContext = await requireConvexUser(session)

    if (isRouteResponse(authContext)) {
      return authContext
    }

    const currentUserId = authContext.currentUser.id

    for (const notificationId of parsed.notificationIds) {
      if (parsed.action === "archive") {
        await archiveNotificationServer({
          currentUserId,
          notificationId,
        })
        continue
      }

      await unarchiveNotificationServer({
        currentUserId,
        notificationId,
      })
    }
    await bumpNotificationInboxReadModelScopesServer([currentUserId])

    return jsonOk({ ok: true })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update notifications", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update notifications"),
      500,
      {
        code: "NOTIFICATIONS_UPDATE_FAILED",
      }
    )
  }
}
