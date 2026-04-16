import { NextRequest, NextResponse } from "next/server"

import { commentSchema } from "@/lib/domain/types"
import {
  addCommentServer,
  markNotificationsEmailedServer,
} from "@/lib/server/convex"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { isRouteResponse, jsonOk } from "@/lib/server/route-response"
import { sendMentionEmails } from "@/lib/server/email"

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    commentSchema,
    "Invalid comment payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await addCommentServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed,
    })

    try {
      const emailedNotificationIds = await sendMentionEmails({
        origin: new URL(request.url).origin,
        emails: result?.mentionEmails ?? [],
      })

      if (emailedNotificationIds.length > 0) {
        await markNotificationsEmailedServer(emailedNotificationIds)
      }
    } catch (emailError) {
      logProviderError("Failed to send mention emails", emailError)
    }

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    logProviderError("Failed to post comment", error)
    return NextResponse.json(
      {
        error: getConvexErrorMessage(error, "Failed to post comment"),
      },
      { status: 500 }
    )
  }
}
