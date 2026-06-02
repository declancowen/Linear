import { NextRequest } from "next/server"
import { z } from "zod"

import {
  bumpScopedReadModelVersionsServer,
  updateChatReadStateServer,
} from "@/lib/server/convex"
import {
  getConversationListScopeKeys,
  getConversationThreadScopeKeys,
} from "@/lib/scoped-sync/read-models"
import { handleAppContextJsonRoute } from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"

const chatReadStateBodySchema = z.object({
  action: z.enum(["read", "unread"]),
  messageIds: z.array(z.string()).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  return handleAppContextJsonRoute(request, {
    schema: chatReadStateBodySchema,
    invalidMessage: "Invalid chat read-state payload",
    failureLogLabel: "Failed to update chat read state",
    failureMessage: "Failed to update chat read state",
    failureCode: "CHAT_READ_STATE_UPDATE_FAILED",
    async handle({ appContext, parsed }) {
      const { chatId } = await params

      await updateChatReadStateServer({
        currentUserId: appContext.ensuredUser.userId,
        conversationId: chatId,
        action: parsed.action,
        messageIds: parsed.action === "read" ? parsed.messageIds : undefined,
      })
      await bumpScopedReadModelVersionsServer({
        scopeKeys: [
          ...getConversationListScopeKeys(appContext.ensuredUser.userId),
          ...getConversationThreadScopeKeys(chatId),
        ],
      })

      return jsonOk({
        ok: true,
      })
    },
  })
}
