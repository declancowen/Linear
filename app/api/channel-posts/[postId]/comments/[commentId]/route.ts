import { NextRequest } from "next/server"
import { z } from "zod"

import { channelPostCommentSchema } from "@/lib/domain/types"
import {
  deleteChannelPostCommentServer,
  updateChannelPostCommentServer,
} from "@/lib/server/convex"
import {
  bumpScopedReadModelScopeKeysServer,
  resolveChannelPostReadModelScopeKeysServer,
} from "@/lib/server/scoped-read-models"
import {
  handleAppContextJsonRoute,
  handleAppContextRoute,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"

const channelPostCommentUpdateBodySchema = z.object({
  content: channelPostCommentSchema.shape.content,
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  return handleAppContextJsonRoute(request, {
    schema: channelPostCommentUpdateBodySchema,
    invalidMessage: "Invalid comment payload",
    failureLogLabel: "Failed to update comment",
    failureMessage: "Failed to update comment",
    failureCode: "CHANNEL_POST_COMMENT_UPDATE_FAILED",
    async handle({ session, appContext, parsed }) {
      const { postId, commentId } = await params
      const scopeKeys = await resolveChannelPostReadModelScopeKeysServer(
        session,
        postId
      )

      await updateChannelPostCommentServer({
        currentUserId: appContext.ensuredUser.userId,
        postId,
        commentId,
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
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  return handleAppContextRoute({
    failureLogLabel: "Failed to delete comment",
    failureMessage: "Failed to delete comment",
    failureCode: "CHANNEL_POST_COMMENT_DELETE_FAILED",
    async handle({ session, appContext }) {
      const { postId, commentId } = await params
      const result = await deleteChannelPostCommentServer({
        currentUserId: appContext.ensuredUser.userId,
        postId,
        commentId,
      })

      if (result?.deleted !== false) {
        const scopeKeys = await resolveChannelPostReadModelScopeKeysServer(
          session,
          postId
        )

        if (scopeKeys.length > 0) {
          await bumpScopedReadModelScopeKeysServer(scopeKeys)
        }
      }

      return jsonOk({
        ok: true,
      })
    },
  })
}
