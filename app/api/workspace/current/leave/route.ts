import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { leaveWorkspaceServer } from "@/lib/server/convex"
import { sendAccessChangeEmails } from "@/lib/server/email"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

export async function DELETE() {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const workspaceId = appContext.authContext?.currentWorkspace?.id

    if (!workspaceId) {
      return jsonError("Workspace not found", 404)
    }

    const result = await leaveWorkspaceServer({
      currentUserId: appContext.ensuredUser.userId,
      workspaceId,
    })

    if (result?.emailJobs?.length) {
      try {
        await sendAccessChangeEmails({
          emails: result.emailJobs,
        })
      } catch (emailError) {
        logProviderError("Failed to send workspace leave email", emailError)
      }
    }

    await reconcileAuthenticatedAppContext(session.user, session.organizationId)

    return jsonOk({
      ok: true,
      workspaceId: result?.workspaceId ?? workspaceId,
      removedTeamIds: result?.removedTeamIds ?? [],
    })
  } catch (error) {
    logProviderError("Failed to leave workspace", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to leave workspace"),
      500
    )
  }
}
