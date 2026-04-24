import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import { channelPostCommentSchema } from "@/lib/domain/types"
import {
  addChannelPostCommentServer,
  bumpScopedReadModelVersionsServer,
} from "@/lib/server/convex"
import { resolveChannelPostReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const channelPostCommentBodySchema = z.object({
  content: channelPostCommentSchema.shape.content,
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsedBody = await parseJsonBody(
    request,
    channelPostCommentBodySchema,
    "Invalid comment payload"
  )

  if (isRouteResponse(parsedBody)) {
    return parsedBody
  }

  const { postId } = await params
  const parsed = channelPostCommentSchema.safeParse({
    postId,
    content: parsedBody.content,
  })

  if (!parsed.success) {
    return jsonError("Invalid comment payload", 400)
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
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
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to create comment", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create comment"),
      500,
      {
        code: "CHANNEL_POST_COMMENT_CREATE_FAILED",
      }
    )
  }
}
