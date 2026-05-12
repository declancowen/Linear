import { NextRequest } from "next/server"
import { z } from "zod"

import { channelPostCommentSchema } from "@/lib/domain/types"
import {
  addChannelPostCommentServer,
  bumpScopedReadModelVersionsServer,
} from "@/lib/server/convex"
import { handleAppContextJsonRoute } from "@/lib/server/route-handlers"
import { jsonError, jsonOk } from "@/lib/server/route-response"
import { resolveChannelPostReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"

const channelPostCommentBodySchema = z.object({
  content: channelPostCommentSchema.shape.content,
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params

  return handleAppContextJsonRoute(request, {
    schema: channelPostCommentBodySchema,
    invalidMessage: "Invalid comment payload",
    failureLogLabel: "Failed to create comment",
    failureMessage: "Failed to create comment",
    failureCode: "CHANNEL_POST_COMMENT_CREATE_FAILED",
    async handle({ session, appContext, parsed: parsedBody }) {
      const parsed = channelPostCommentSchema.safeParse({
        postId,
        content: parsedBody.content,
      })

      if (!parsed.success) {
        return jsonError("Invalid comment payload", 400)
      }

      const result = await addChannelPostCommentServer({
        currentUserId: appContext.ensuredUser.userId,
        ...parsed.data,
      })
      await bumpScopedReadModelVersionsServer({
        scopeKeys: await resolveChannelPostReadModelScopeKeysServer(
          session,
          postId
        ),
      })

      return jsonOk({
        ok: true,
        commentId: result?.commentId ?? null,
      })
    },
  })
}
