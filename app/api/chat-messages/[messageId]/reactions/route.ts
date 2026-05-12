import { NextRequest } from "next/server"

import {
  bumpScopedReadModelVersionsServer,
  toggleChatMessageReactionServer,
} from "@/lib/server/convex"
import {
  handleAppContextJsonRoute,
  reactionPayloadSchema,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"
import { resolveChatMessageReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params

  return handleAppContextJsonRoute(request, {
    schema: reactionPayloadSchema,
    invalidMessage: "Invalid reaction payload",
    failureLogLabel: "Failed to update reaction",
    failureMessage: "Failed to update reaction",
    failureCode: "CHAT_MESSAGE_REACTION_UPDATE_FAILED",
    async handle({ session, appContext, parsed }) {
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
    },
  })
}
