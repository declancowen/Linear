import { NextRequest } from "next/server"
import { z } from "zod"

import { channelPostSchema } from "@/lib/domain/types"
import {
  bumpScopedReadModelVersionsServer,
  deleteChannelPostServer,
  updateChannelPostServer,
} from "@/lib/server/convex"
import { getChannelPostRelatedScopeKeys } from "@/lib/scoped-sync/read-models"
import {
  loadScopedReadModelSnapshotForSession,
  resolveConversationReadModelScopeKeysServer,
} from "@/lib/server/scoped-read-models"
import {
  handleAppContextJsonRoute,
  handleAppContextRoute,
} from "@/lib/server/route-handlers"
import { jsonError, jsonOk } from "@/lib/server/route-response"

const channelPostUpdateBodySchema = z.object({
  title: channelPostSchema.shape.title,
  content: channelPostSchema.shape.content,
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  return handleAppContextJsonRoute(request, {
    schema: channelPostUpdateBodySchema,
    invalidMessage: "Invalid post payload",
    failureLogLabel: "Failed to update post",
    failureMessage: "Failed to update post",
    failureCode: "CHANNEL_POST_UPDATE_FAILED",
    async handle({ session, appContext, parsed }) {
      const { postId } = await params
      const result = await updateChannelPostServer({
        currentUserId: appContext.ensuredUser.userId,
        postId,
        title: parsed.title,
        content: parsed.content,
      })

      await bumpScopedReadModelVersionsServer({
        scopeKeys: await resolveConversationReadModelScopeKeysServer(
          session,
          result.conversationId
        ),
      })

      return jsonOk({
        ok: true,
      })
    },
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  return handleAppContextRoute({
    failureLogLabel: "Failed to delete post",
    failureMessage: "Failed to delete post",
    failureCode: "CHANNEL_POST_DELETE_FAILED",
    async handle({ session, appContext }) {
      const { postId } = await params
      const snapshot = await loadScopedReadModelSnapshotForSession(session)
      const post =
        snapshot.channelPosts.find((entry) => entry.id === postId) ?? null

      if (!post) {
        return jsonOk({
          ok: true,
        })
      }

      if (post.createdBy !== appContext.ensuredUser.userId) {
        return jsonError("You can only delete your own posts", 403, {
          code: "CHANNEL_POST_DELETE_FORBIDDEN",
        })
      }

      const scopeKeys = getChannelPostRelatedScopeKeys(snapshot, postId)

      await deleteChannelPostServer({
        currentUserId: appContext.ensuredUser.userId,
        postId,
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
