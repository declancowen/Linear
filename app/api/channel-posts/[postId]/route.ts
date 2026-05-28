import { NextRequest } from "next/server"

import { isApplicationError } from "@/lib/server/application-errors"
import {
  bumpScopedReadModelVersionsServer,
  deleteChannelPostServer,
} from "@/lib/server/convex"
import { getChannelPostRelatedScopeKeys } from "@/lib/scoped-sync/read-models"
import { loadScopedReadModelSnapshotForSession } from "@/lib/server/scoped-read-models"
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
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { postId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

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
  } catch (error) {
    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete post", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete post"),
      500
    )
  }
}
