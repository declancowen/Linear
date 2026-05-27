import { NextRequest } from "next/server"

import { isApplicationError } from "@/lib/server/application-errors"
import {
  bumpScopedReadModelVersionsServer,
  deleteChannelPostCommentServer,
} from "@/lib/server/convex"
import { resolveChannelPostReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { postId, commentId } = await params
    const scopeKeys = await resolveChannelPostReadModelScopeKeysServer(
      session,
      postId
    )
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

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
  } catch (error) {
    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete comment", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete comment"),
      500
    )
  }
}
