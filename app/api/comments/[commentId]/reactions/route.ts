import { NextRequest } from "next/server"
import { z } from "zod"

import { toggleCommentReactionServer } from "@/lib/server/convex"
import { handleAppContextJsonRoute } from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"
import { bumpCommentTargetReadModelScopesServer } from "@/lib/server/scoped-read-models"

const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(8),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params

  return handleAppContextJsonRoute(request, {
    schema: reactionSchema,
    invalidMessage: "Invalid reaction payload",
    failureLogLabel: "Failed to update reaction",
    failureMessage: "Failed to update reaction",
    failureCode: "COMMENT_REACTION_UPDATE_FAILED",
    async handle({ session, appContext, parsed }) {
      const result = await toggleCommentReactionServer({
        currentUserId: appContext.ensuredUser.userId,
        commentId,
        emoji: parsed.emoji,
      })
      if (result?.targetType && result.targetId) {
        await bumpCommentTargetReadModelScopesServer(session, {
          targetType: result.targetType,
          targetId: result.targetId,
        })
      }

      return jsonOk({ ok: true })
    },
  })
}
