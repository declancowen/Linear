import { NextRequest } from "next/server"

import { isApplicationError } from "@/lib/server/application-errors"
import { deleteChannelPostServer } from "@/lib/server/convex"
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

    await deleteChannelPostServer({
      currentUserId: appContext.ensuredUser.userId,
      postId,
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
