import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { leaveTeamServer } from "@/lib/server/convex"
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
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { teamId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await leaveTeamServer({
      currentUserId: appContext.ensuredUser.userId,
      teamId,
    })

    await reconcileProviderMembershipCleanup({
      label: "Failed to deactivate WorkOS membership after team leave",
      memberships: result?.providerMemberships ?? [],
    })

    await reconcileAuthenticatedAppContext(session.user, session.organizationId)

    return jsonOk({
      ok: true,
      teamId: result?.teamId ?? teamId,
      workspaceId: result?.workspaceId ?? null,
      workspaceAccessRemoved: result?.workspaceAccessRemoved === true,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to leave team", error)
    return jsonError(getConvexErrorMessage(error, "Failed to leave team"), 500, {
      code: "TEAM_LEAVE_FAILED",
    })
  }
}
