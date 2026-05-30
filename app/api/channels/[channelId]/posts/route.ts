import { NextRequest } from "next/server"
import { z } from "zod"

import { channelPostSchema } from "@/lib/domain/types"
import {
  bumpScopedReadModelVersionsServer,
  createChannelPostServer,
} from "@/lib/server/convex"
import { resolveConversationReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
import { handleAppContextJsonRoute } from "@/lib/server/route-handlers"
import { jsonError, jsonOk } from "@/lib/server/route-response"

const channelPostBodySchema = z.object({
  postId: z.string().trim().min(1).optional(),
  title: channelPostSchema.shape.title,
  content: channelPostSchema.shape.content,
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  return handleAppContextJsonRoute(request, {
    schema: channelPostBodySchema,
    invalidMessage: "Invalid post payload",
    failureLogLabel: "Failed to create post",
    failureMessage: "Failed to create post",
    failureCode: "CHANNEL_POST_CREATE_FAILED",
    async handle({ session, appContext, parsed: parsedBody }) {
      const { channelId } = await params
      const parsed = channelPostSchema.safeParse({
        conversationId: channelId,
        title: parsedBody.title,
        content: parsedBody.content,
      })

      if (!parsed.success) {
        return jsonError("Invalid post payload", 400)
      }

      const result = await createChannelPostServer({
        currentUserId: appContext.ensuredUser.userId,
        postId: parsedBody.postId,
        ...parsed.data,
      })
      await bumpScopedReadModelVersionsServer({
        scopeKeys: await resolveConversationReadModelScopeKeysServer(
          session,
          channelId
        ),
      })

      return jsonOk({
        ok: true,
        postId: result?.postId ?? null,
      })
    },
  })
}
