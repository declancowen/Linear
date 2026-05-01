import { randomUUID } from "node:crypto"

import { ApplicationError } from "@/lib/server/application-errors"
import { createChatCollaborationRoomId } from "@/lib/collaboration/rooms"
import { getCollaborationServiceUrlForRequest } from "@/lib/server/collaboration-service-url"
import { createSignedCollaborationToken } from "@/lib/server/collaboration-token"
import { getCallJoinContextServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const SESSION_TTL_SECONDS = 60 * 5

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const appContext = await requireAppContext(session)

  if (isRouteResponse(appContext)) {
    return appContext
  }

  const { chatId } = await params

  try {
    const joinContext = await getCallJoinContextServer({
      currentUserId: appContext.ensuredUser.userId,
      conversationId: chatId,
    })
    const issuedAt = Math.floor(Date.now() / 1000)
    const expiresAt = issuedAt + SESSION_TTL_SECONDS
    const sessionId = randomUUID()
    const roomId = createChatCollaborationRoomId(joinContext.conversationId)
    const token = createSignedCollaborationToken({
      kind: "chat",
      sub: appContext.ensuredUser.userId,
      roomId,
      conversationId: joinContext.conversationId,
      sessionId,
      iat: issuedAt,
      exp: expiresAt,
    })

    return jsonOk({
      roomId,
      conversationId: joinContext.conversationId,
      token,
      serviceUrl: getCollaborationServiceUrlForRequest(request),
      sessionId,
      expiresAt,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    const message = getConvexErrorMessage(
      error,
      "Failed to create chat presence session"
    )
    const status = message.includes("not configured") ? 503 : 500
    logProviderError("Failed to create chat presence session", error)
    return jsonError(message, status, {
      code: "CHAT_PRESENCE_SESSION_CREATE_FAILED",
    })
  }
}
