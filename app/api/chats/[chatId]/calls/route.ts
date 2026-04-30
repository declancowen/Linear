import { NextRequest } from "next/server"

import { isApplicationError } from "@/lib/server/application-errors"
import {
  bumpScopedReadModelVersionsServer,
  startChatCallServer,
} from "@/lib/server/convex"
import { resolveConversationReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
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

function createCallJoinHref(callId: string) {
  const query = new URLSearchParams({
    callId,
  })

  return `/api/calls/join?${query.toString()}`
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { chatId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await startChatCallServer({
      currentUserId: appContext.ensuredUser.userId,
      conversationId: chatId,
      roomKey: `chat-${chatId}`,
      roomDescription: `Persistent video room for chat ${chatId}`,
    })
    await bumpScopedReadModelVersionsServer({
      scopeKeys: await resolveConversationReadModelScopeKeysServer(
        session,
        chatId
      ),
    })
    const joinHref = createCallJoinHref(result.call.id)

    return jsonOk({
      call: result.call,
      message: result.message,
      joinHref,
    })
  } catch (error) {
    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to start chat call", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to start call"),
      500,
      {
        code: "CHAT_CALL_START_FAILED",
      }
    )
  }
}
