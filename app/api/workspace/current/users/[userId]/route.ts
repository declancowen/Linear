import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  enqueueEmailJobsServer,
  removeWorkspaceUserServer,
} from "@/lib/server/convex"
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { userId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const workspaceId = appContext.authContext?.currentWorkspace?.id

    if (!workspaceId) {
      return jsonError("Workspace not found", 404)
    }

    if (!appContext.authContext?.isWorkspaceOwner) {
      return jsonError(
        "Only the workspace owner can remove workspace users",
        403
      )
    }

    const result = await removeWorkspaceUserServer({
      currentUserId: appContext.ensuredUser.userId,
      workspaceId,
      userId,
    })

    if (result?.emailJobs?.length) {
      try {
        await enqueueEmailJobsServer(
          buildAccessChangeEmailJobs({
            emails: result.emailJobs,
          })
        )
      } catch (emailError) {
        logProviderError("Failed to send workspace removal email", emailError)
      }
    }

    await reconcileProviderMembershipCleanup({
      label: "Failed to deactivate WorkOS membership after workspace removal",
      memberships: result?.providerMemberships ?? [],
    })

    return jsonOk({
      ok: true,
      workspaceId: result?.workspaceId ?? workspaceId,
      userId: result?.userId ?? userId,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to remove workspace user", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to remove workspace user"),
      500,
      {
        code: "WORKSPACE_USER_REMOVE_FAILED",
      }
    )
  }
}
