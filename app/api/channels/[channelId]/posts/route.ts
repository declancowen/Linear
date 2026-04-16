import { NextRequest } from "next/server"
import { z } from "zod"

import { channelPostSchema } from "@/lib/domain/types"
import {
  createChannelPostServer,
  markNotificationsEmailedServer,
} from "@/lib/server/convex"
import { sendMentionEmails } from "@/lib/server/email"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

const channelPostBodySchema = z.object({
  title: channelPostSchema.shape.title,
  content: channelPostSchema.shape.content,
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsedBody = await parseJsonBody(
    request,
    channelPostBodySchema,
    "Invalid post payload"
  )

  if (isRouteResponse(parsedBody)) {
    return parsedBody
  }

  const { channelId } = await params
  const parsed = channelPostSchema.safeParse({
    conversationId: channelId,
    title: parsedBody.title,
    content: parsedBody.content,
  })

  if (!parsed.success) {
    return jsonError("Invalid post payload", 400)
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await createChannelPostServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed.data,
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
      postId: result?.postId ?? null,
    })
  } catch (error) {
    logProviderError("Failed to create post", error)
    return jsonError(getConvexErrorMessage(error, "Failed to create post"), 500)
  }
}
