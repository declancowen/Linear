import { NextRequest } from "next/server"
import { z } from "zod"

import { chatMessageSchema } from "@/lib/domain/types"
import {
  deleteChatMessageServer,
  updateChatMessageServer,
} from "@/lib/server/convex"
import {
  handleAppContextJsonRoute,
  handleAppContextRoute,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"
import {
  bumpScopedReadModelScopeKeysServer,
  resolveChatMessageReadModelScopeKeysServer,
} from "@/lib/server/scoped-read-models"

const chatMessageUpdateBodySchema = z.object({
  content: chatMessageSchema.shape.content,
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  return handleAppContextJsonRoute(request, {
    schema: chatMessageUpdateBodySchema,
    invalidMessage: "Invalid message payload",
    failureLogLabel: "Failed to update message",
    failureMessage: "Failed to update message",
    failureCode: "CHAT_MESSAGE_UPDATE_FAILED",
    async handle({ session, appContext, parsed }) {
      const { messageId } = await params
      const scopeKeys = await resolveChatMessageReadModelScopeKeysServer(
        session,
        messageId
      )

      await updateChatMessageServer({
        currentUserId: appContext.ensuredUser.userId,
        messageId,
        content: parsed.content,
      })
      await bumpScopedReadModelScopeKeysServer(scopeKeys)

      return jsonOk({
        ok: true,
      })
    },
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  return handleAppContextRoute({
    failureLogLabel: "Failed to delete message",
    failureMessage: "Failed to delete message",
    failureCode: "CHAT_MESSAGE_DELETE_FAILED",
    async handle({ session, appContext }) {
      const { messageId } = await params
      const scopeKeys = await resolveChatMessageReadModelScopeKeysServer(
        session,
        messageId
      )

      await deleteChatMessageServer({
        currentUserId: appContext.ensuredUser.userId,
        messageId,
      })
      await bumpScopedReadModelScopeKeysServer(scopeKeys)

      return jsonOk({
        ok: true,
      })
    },
  })
}
