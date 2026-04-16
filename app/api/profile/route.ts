import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { profileSchema } from "@/lib/domain/types"
import { updateCurrentUserProfileServer } from "@/lib/server/convex"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"
import { syncUserProfileToWorkOS } from "@/lib/server/workos"

export async function PATCH(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    profileSchema,
    "Invalid profile payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await updateCurrentUserProfileServer({
      currentUserId: appContext.ensuredUser.userId,
      userId: appContext.ensuredUser.userId,
      ...parsed,
    })
    await syncUserProfileToWorkOS({
      workosUserId: appContext.authenticatedUser.workosUserId,
      name: parsed.name,
    })

    return jsonOk({
      ok: true,
      userId: appContext.ensuredUser.userId,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update profile", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update profile"),
      500,
      {
        code: "PROFILE_UPDATE_FAILED",
      }
    )
  }
}
