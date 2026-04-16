import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { teamWorkflowSettingsSchema } from "@/lib/domain/types"
import { updateTeamWorkflowSettingsServer } from "@/lib/server/convex"
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    teamWorkflowSettingsSchema,
    "Invalid team workflow payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const { teamId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await updateTeamWorkflowSettingsServer({
      currentUserId: appContext.ensuredUser.userId,
      teamId,
      workflow: parsed,
    })

    return jsonOk({ ok: true })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update team workflow settings", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update team workflow settings"),
      500,
      {
        code: "TEAM_WORKFLOW_UPDATE_FAILED",
      }
    )
  }
}
