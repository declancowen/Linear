import { NextRequest } from "next/server"

import { joinCodeSchema } from "@/lib/domain/types"
import { isApplicationError } from "@/lib/server/application-errors"
import { lookupTeamByJoinCodeServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import {
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? ""
  const parsed = joinCodeSchema.safeParse({ code })

  if (!parsed.success) {
    return jsonError("Invalid join code", 400)
  }

  try {
    const result = await lookupTeamByJoinCodeServer(parsed.data.code)

    if (!result) {
      return jsonError(`No team matched ${parsed.data.code}.`, 404)
    }

    return jsonOk({
      team: {
        id: result.team.id,
        joinCode: result.team.joinCode,
        name: result.team.name,
        summary: result.team.summary,
      },
      workspace: {
        logoUrl: result.workspace.logoUrl,
        name: result.workspace.name,
      },
    })
  } catch (error) {
    logProviderError("Failed to look up team", error)

    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    return jsonError(
      getConvexErrorMessage(error, "Failed to look up team"),
      500
    )
  }
}
