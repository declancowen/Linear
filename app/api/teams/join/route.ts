import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { joinCodeSchema } from "@/lib/domain/types"
import { joinTeamByCodeServer } from "@/lib/server/convex"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"
import {
  reconcileAuthenticatedAppContext,
} from "@/lib/server/authenticated-app"
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

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    joinCodeSchema,
    "Invalid join code"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const joined = await joinTeamByCodeServer({
      currentUserId: appContext.ensuredUser.userId,
      code: parsed.code,
    })

    if (!joined) {
      return jsonError("Unable to join team", 500)
    }

    await reconcileAuthenticatedAppContext(session.user, session.organizationId)
    await bumpWorkspaceMembershipReadModelScopesServer(joined.workspaceId)

    return jsonOk({
      ok: true,
      role: joined.role,
      teamSlug: joined.teamSlug,
      workspaceId: joined.workspaceId,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to join team", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to join team"),
      500,
      {
        code: "TEAM_JOIN_FAILED",
      }
    )
  }
}
