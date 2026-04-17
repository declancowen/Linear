import { NextRequest } from "next/server"

import {
  ApplicationError,
  coerceApplicationError,
} from "@/lib/server/application-errors"
import { teamDetailsSchema } from "@/lib/domain/types"
import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { createTeamServer } from "@/lib/server/convex"
import { withGeneratedJoinCode } from "@/lib/server/join-codes"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const CREATE_TEAM_ROUTE_ERROR_MAPPINGS = [
  {
    match: "Unable to generate a unique join code",
    status: 503,
    code: "TEAM_JOIN_CODE_GENERATION_FAILED",
    retryable: true,
  },
] as const

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    teamDetailsSchema,
    "Invalid team payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const targetWorkspace =
      appContext.authContext?.currentWorkspace ??
      appContext.authContext?.pendingWorkspace ??
      null

    if (!targetWorkspace) {
      return jsonError("No active workspace", 400)
    }

    const result = await withGeneratedJoinCode((joinCode) =>
      createTeamServer({
        currentUserId: appContext.ensuredUser.userId,
        workspaceId: targetWorkspace.id,
        joinCode,
        ...parsed,
      })
    )

    try {
      await reconcileAuthenticatedAppContext(session.user, session.organizationId)
    } catch (error) {
      logProviderError("Failed to reconcile app context after team creation", error)
    }

    return jsonOk({
      ok: true,
      teamId: result?.teamId ?? null,
      teamSlug: result?.teamSlug ?? null,
      joinCode: result?.joinCode ?? null,
      features: result?.features ?? parsed.features,
    })
  } catch (error) {
    const applicationError =
      error instanceof ApplicationError
        ? error
        : coerceApplicationError(error, [...CREATE_TEAM_ROUTE_ERROR_MAPPINGS])

    if (applicationError) {
      return jsonApplicationError(applicationError)
    }

    logProviderError("Failed to create team", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create team"),
      500,
      {
        code: "TEAM_CREATE_FAILED",
      }
    )
  }
}
