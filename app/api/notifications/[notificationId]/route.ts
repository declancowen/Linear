import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  archiveNotificationServer,
  deleteNotificationServer,
  markNotificationReadServer,
  toggleNotificationReadServer,
  unarchiveNotificationServer,
} from "@/lib/server/convex"
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

const notificationMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("markRead"),
  }),
  z.object({
    action: z.literal("toggleRead"),
  }),
  z.object({
    action: z.literal("archive"),
  }),
  z.object({
    action: z.literal("unarchive"),
  }),
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    notificationMutationSchema,
    "Invalid notification request"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const { notificationId } = await params
    const authContext = await requireConvexUser(session)

    if (isRouteResponse(authContext)) {
      return authContext
    }

    const currentUserId = authContext.currentUser.id

    if (parsed.action === "markRead") {
      await markNotificationReadServer({
        currentUserId,
        notificationId,
      })
    } else if (parsed.action === "toggleRead") {
      await toggleNotificationReadServer({
        currentUserId,
        notificationId,
      })
    } else if (parsed.action === "archive") {
      await archiveNotificationServer({
        currentUserId,
        notificationId,
      })
    } else {
      await unarchiveNotificationServer({
        currentUserId,
        notificationId,
      })
    }

    return jsonOk({ ok: true })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update notification", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update notification"),
      500,
      {
        code: "NOTIFICATION_UPDATE_FAILED",
      }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { notificationId } = await params
    const authContext = await requireConvexUser(session)

    if (isRouteResponse(authContext)) {
      return authContext
    }

    await deleteNotificationServer({
      currentUserId: authContext.currentUser.id,
      notificationId,
    })

    return jsonOk({ ok: true })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete notification", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete notification"),
      500,
      {
        code: "NOTIFICATION_DELETE_FAILED",
      }
    )
  }
}
