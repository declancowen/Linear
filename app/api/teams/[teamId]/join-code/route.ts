import { NextRequest } from "next/server"

import { getSnapshotServer, updateTeamDetailsServer } from "@/lib/server/convex"
import { withGeneratedJoinCode } from "@/lib/server/join-codes"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

export async function POST(
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

    const snapshot = await getSnapshotServer({
      workosUserId: session.user.id,
      email: session.user.email,
    })

    if (!snapshot) {
      return jsonError("Snapshot not available", 404)
    }

    const team = snapshot?.teams.find((entry) => entry.id === teamId)

    if (!team) {
      return jsonError("Team not found", 404)
    }

    const result = await withGeneratedJoinCode((joinCode) =>
      updateTeamDetailsServer({
        currentUserId: appContext.ensuredUser.userId,
        teamId,
        joinCode,
        name: team.name,
        icon: team.icon,
        summary: team.settings.summary,
        experience: team.settings.experience,
        features: team.settings.features,
      })
    )

    return jsonOk({
      ok: true,
      joinCode: result.joinCode,
    })
  } catch (error) {
    logProviderError("Failed to regenerate join code", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to regenerate join code"),
      500
    )
  }
}
