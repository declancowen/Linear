import { NextRequest } from "next/server"
import { z } from "zod"

import { isApplicationError } from "@/lib/server/application-errors"
import {
  bumpScopedReadModelVersionsServer,
  toggleChatMessageReactionServer,
} from "@/lib/server/convex"
import { resolveChatMessageReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
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

const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    reactionSchema,
    "Invalid reaction payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const { messageId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await toggleChatMessageReactionServer({
      currentUserId: appContext.ensuredUser.userId,
      messageId,
      emoji: parsed.emoji,
    })
    await bumpScopedReadModelVersionsServer({
      scopeKeys: await resolveChatMessageReadModelScopeKeysServer(
        session,
        messageId
      ),
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update reaction", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update reaction"),
      500,
      {
        code: "CHAT_MESSAGE_REACTION_UPDATE_FAILED",
      }
    )
  }
}
