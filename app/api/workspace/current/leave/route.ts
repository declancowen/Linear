import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { ApplicationError } from "@/lib/server/application-errors"
import { enqueueEmailJobsServer, leaveWorkspaceServer } from "@/lib/server/convex"
import { buildAccessChangeEmailJobs } from "@/lib/server/email"
import { reconcileProviderMembershipCleanup } from "@/lib/server/lifecycle"
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
        await enqueueEmailJobsServer(
          buildAccessChangeEmailJobs({
            emails: result.emailJobs,
          })
        )
      } catch (emailError) {
        logProviderError("Failed to send workspace leave email", emailError)
      }
    }

    await reconcileProviderMembershipCleanup({
      label: "Failed to deactivate WorkOS membership after workspace leave",
      memberships: result?.providerMemberships ?? [],
    })

    await reconcileAuthenticatedAppContext(session.user, session.organizationId)

    return jsonOk({
      ok: true,
      workspaceId: result?.workspaceId ?? workspaceId,
      removedTeamIds: result?.removedTeamIds ?? [],
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to leave workspace", error)
    return jsonError(getConvexErrorMessage(error, "Failed to leave workspace"), 500, {
      code: "WORKSPACE_LEAVE_FAILED",
    })
  }
}
