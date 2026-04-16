import { NextRequest } from "next/server"

import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { leaveTeamServer } from "@/lib/server/convex"
import { sendAccessChangeEmails } from "@/lib/server/email"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

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

    if (result?.emailJobs?.length) {
      try {
        await sendAccessChangeEmails({
          emails: result.emailJobs,
        })
      } catch (emailError) {
        logProviderError("Failed to send leave-team access email", emailError)
      }
    }

    await reconcileAuthenticatedAppContext(session.user, session.organizationId)

    return jsonOk({
      ok: true,
      teamId: result?.teamId ?? teamId,
      workspaceId: result?.workspaceId ?? null,
    })
  } catch (error) {
    logProviderError("Failed to leave team", error)
    return jsonError(getConvexErrorMessage(error, "Failed to leave team"), 500)
  }
}
