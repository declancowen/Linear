import { NextRequest } from "next/server"
import { z } from "zod"

import { channelPostCommentSchema } from "@/lib/domain/types"
import {
  bumpScopedReadModelVersionsServer,
  deleteChannelPostCommentServer,
  updateChannelPostCommentServer,
} from "@/lib/server/convex"
import { getChannelPostRelatedScopeKeys } from "@/lib/scoped-sync/read-models"
import { loadScopedReadModelSnapshotForSession } from "@/lib/server/scoped-read-models"
import {
  handleAppContextJsonRoute,
  handleAppContextRoute,
} from "@/lib/server/route-handlers"
import { jsonError, jsonOk } from "@/lib/server/route-response"

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
      const snapshot = await loadScopedReadModelSnapshotForSession(session)
      const scopeKeys = getChannelPostRelatedScopeKeys(snapshot, postId)

      await updateChannelPostCommentServer({
        currentUserId: appContext.ensuredUser.userId,
        postId,
        commentId,
        content: parsed.content,
      })
      await bumpScopedReadModelVersionsServer({
        scopeKeys,
      })

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
      const snapshot = await loadScopedReadModelSnapshotForSession(session)
      const comment =
        snapshot.channelPostComments.find((entry) => entry.id === commentId) ??
        null

      if (!comment) {
        return jsonOk({
          ok: true,
        })
      }

      if (comment.postId !== postId) {
        return jsonError("Comment not found", 404, {
          code: "CHANNEL_POST_COMMENT_NOT_FOUND",
        })
      }

      if (comment.createdBy !== appContext.ensuredUser.userId) {
        return jsonError("You can only delete your own comments", 403, {
          code: "CHANNEL_POST_COMMENT_DELETE_FORBIDDEN",
        })
      }

      const scopeKeys = getChannelPostRelatedScopeKeys(snapshot, postId)

      await deleteChannelPostCommentServer({
        currentUserId: appContext.ensuredUser.userId,
        postId,
        commentId,
      })
      await bumpScopedReadModelVersionsServer({
        scopeKeys,
      })

      return jsonOk({
        ok: true,
      })
    },
  })
}
