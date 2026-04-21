import { ApplicationError } from "@/lib/server/application-errors"
import { cancelInviteServer } from "@/lib/server/convex"
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
  _request: Request,
  context: {
    params: Promise<{
      inviteId: string
    }>
  }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { inviteId } = await context.params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const cancelled = await cancelInviteServer({
      currentUserId: appContext.ensuredUser.userId,
      inviteId,
    })

    return jsonOk({
      ok: true,
      inviteId: cancelled.inviteId,
      cancelledInviteIds: cancelled.cancelledInviteIds,
      teamName: cancelled.teamName,
      workspaceName: cancelled.workspaceName,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to cancel invite", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to cancel invite"),
      500,
      {
        code: "INVITE_CANCEL_FAILED",
      }
    )
  }
}
