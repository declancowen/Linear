import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import { chatMessageSchema } from "@/lib/domain/types"
import { sendChatMessageServer } from "@/lib/server/convex"
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

const chatMessageBodySchema = z.object({
  content: chatMessageSchema.shape.content,
  messageId: z.string().trim().min(1).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsedBody = await parseJsonBody(
    request,
    chatMessageBodySchema,
    "Invalid message payload"
  )

  if (isRouteResponse(parsedBody)) {
    return parsedBody
  }

  const { chatId } = await params
  const parsed = chatMessageSchema.safeParse({
    conversationId: chatId,
    content: parsedBody.content,
  })

  if (!parsed.success) {
    return jsonError("Invalid message payload", 400)
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await sendChatMessageServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed.data,
      messageId: parsedBody.messageId,
    })

    return jsonOk({
      ok: true,
      messageId: result?.messageId ?? null,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to send message", error)
    return jsonError(getConvexErrorMessage(error, "Failed to send message"), 500, {
      code: "CHAT_MESSAGE_SEND_FAILED",
    })
  }
}
