import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import { sendItemDescriptionMentionNotificationsServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const itemDescriptionMentionNotificationsSchema = z.object({
  mentions: z.array(
    z.object({
      userId: z.string().trim().min(1),
      count: z.number().int().positive().max(1000),
    })
  ),
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
    itemDescriptionMentionNotificationsSchema,
    "Invalid item description mention notification payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await sendItemDescriptionMentionNotificationsServer({
      currentUserId: appContext.ensuredUser.userId,
      itemId,
      mentions: parsed.mentions,
    })

    return jsonOk({
      ok: true,
      ...result,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to send item description mention notifications", error)
    return jsonError(
      getConvexErrorMessage(
        error,
        "Failed to send item description mention notifications"
      ),
      500,
      {
        code: "ITEM_DESCRIPTION_MENTION_NOTIFICATIONS_FAILED",
      }
    )
  }
}
