import { NextRequest } from "next/server"
import { z } from "zod"

import { commentSchema } from "@/lib/domain/types"
import { deleteCommentServer, updateCommentServer } from "@/lib/server/convex"
import {
  handleAppContextJsonRoute,
  handleAppContextRoute,
} from "@/lib/server/route-handlers"
import type { AuthenticatedSession } from "@/lib/server/route-auth"
import { jsonOk } from "@/lib/server/route-response"
import { bumpCommentTargetReadModelScopesServer } from "@/lib/server/scoped-read-models"

const commentUpdateBodySchema = z.object({
  content: commentSchema.shape.content,
})

type CommentMutationResult = {
  targetId?: string | null
  targetType?: "workItem" | "document" | null
}

async function bumpCommentResultScopes(
  session: AuthenticatedSession,
  result: CommentMutationResult | null | undefined
) {
  if (!result?.targetType || !result.targetId) {
    return
  }

  await bumpCommentTargetReadModelScopesServer(session, {
    targetType: result.targetType,
    targetId: result.targetId,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  return handleAppContextJsonRoute(request, {
    schema: commentUpdateBodySchema,
    invalidMessage: "Invalid comment payload",
    failureLogLabel: "Failed to update comment",
    failureMessage: "Failed to update comment",
    failureCode: "COMMENT_UPDATE_FAILED",
    async handle({ session, appContext, parsed }) {
      const { commentId } = await params
      const result = await updateCommentServer({
        currentUserId: appContext.ensuredUser.userId,
        commentId,
        content: parsed.content,
      })
      await bumpCommentResultScopes(session, result)

      return jsonOk({
        ok: true,
      })
    },
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  return handleAppContextRoute({
    failureLogLabel: "Failed to delete comment",
    failureMessage: "Failed to delete comment",
    failureCode: "COMMENT_DELETE_FAILED",
    async handle({ session, appContext }) {
      const { commentId } = await params
      const result = await deleteCommentServer({
        currentUserId: appContext.ensuredUser.userId,
        commentId,
      })
      await bumpCommentResultScopes(session, result)

      return jsonOk({
        ok: true,
      })
    },
  })
}
