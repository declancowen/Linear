import { NextRequest } from "next/server"

import {
  ApplicationError,
  coerceApplicationError,
} from "@/lib/server/application-errors"
import { regenerateTeamJoinCodeServer } from "@/lib/server/convex"
import { withGeneratedJoinCode } from "@/lib/server/join-codes"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"
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

const REGENERATE_TEAM_JOIN_CODE_ROUTE_ERROR_MAPPINGS = [
  {
    match: "Unable to generate a unique join code",
    status: 503,
    code: "TEAM_JOIN_CODE_GENERATION_FAILED",
    retryable: true,
  },
] as const

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

    const result = await withGeneratedJoinCode((joinCode) =>
      regenerateTeamJoinCodeServer({
        currentUserId: appContext.ensuredUser.userId,
        teamId,
        joinCode,
      })
    )
    const workspaceId =
      result.workspaceId ?? appContext.authContext?.currentWorkspace?.id ?? null

    if (workspaceId) {
      await bumpWorkspaceMembershipReadModelScopesServer(workspaceId)
    }

    return jsonOk({
      ok: true,
      joinCode: result.joinCode,
    })
  } catch (error) {
    const applicationError =
      error instanceof ApplicationError
        ? error
        : coerceApplicationError(error, [
            ...REGENERATE_TEAM_JOIN_CODE_ROUTE_ERROR_MAPPINGS,
          ])

    if (applicationError) {
      return jsonApplicationError(applicationError)
    }

    logProviderError("Failed to regenerate join code", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to regenerate join code"),
      500,
      {
        code: "TEAM_JOIN_CODE_REGENERATE_FAILED",
      }
    )
  }
}
