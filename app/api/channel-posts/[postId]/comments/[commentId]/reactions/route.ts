import { NextRequest } from "next/server"

import {
  bumpScopedReadModelVersionsServer,
  toggleChannelPostCommentReactionServer,
} from "@/lib/server/convex"
import { getChannelPostRelatedScopeKeys } from "@/lib/scoped-sync/read-models"
import { loadScopedReadModelSnapshotForSession } from "@/lib/server/scoped-read-models"
import {
  handleAppContextJsonRoute,
  reactionPayloadSchema,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  return handleAppContextJsonRoute(request, {
    schema: reactionPayloadSchema,
    invalidMessage: "Invalid reaction payload",
    failureLogLabel: "Failed to update reaction",
    failureMessage: "Failed to update reaction",
    failureCode: "CHANNEL_POST_COMMENT_REACTION_UPDATE_FAILED",
    async handle({ session, appContext, parsed }) {
      const { postId, commentId } = await params
      const snapshot = await loadScopedReadModelSnapshotForSession(session)

      await toggleChannelPostCommentReactionServer({
        currentUserId: appContext.ensuredUser.userId,
        postId,
        commentId,
        emoji: parsed.emoji,
      })
      await bumpScopedReadModelVersionsServer({
        scopeKeys: getChannelPostRelatedScopeKeys(snapshot, postId),
      })

      return jsonOk({
        ok: true,
      })
    },
  })
}
