import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { ApplicationError } from "@/lib/server/application-errors"
import { leaveWorkspaceServer } from "@/lib/server/convex"
import { reconcileProviderMembershipCleanup } from "@/lib/server/lifecycle"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppRouteContext } from "@/lib/server/route-auth"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

export async function DELETE() {
  try {
    const context = await requireAppRouteContext()

    if (isRouteResponse(context)) {
      return context
    }

    const { appContext, session } = context
    const workspaceId = appContext.authContext?.currentWorkspace?.id

    if (!workspaceId) {
      return jsonError("Workspace not found", 404)
    }

    const result = await leaveWorkspaceServer({
      currentUserId: appContext.ensuredUser.userId,
      workspaceId,
    })

    await reconcileProviderMembershipCleanup({
      label: "Failed to deactivate WorkOS membership after workspace leave",
      memberships: result?.providerMemberships ?? [],
    })

    await reconcileAuthenticatedAppContext(session.user, session.organizationId)
    await bumpWorkspaceMembershipReadModelScopesServer(workspaceId)

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
