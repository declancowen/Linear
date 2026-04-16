import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { labelCreateSchema } from "@/lib/domain/types"
import { createLabelServer } from "@/lib/server/convex"
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
    labelCreateSchema,
    "Invalid label payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const workspaceId = appContext.authContext?.currentWorkspace?.id

    if (!workspaceId) {
      return jsonError("No active workspace", 400, {
        code: "LABEL_WORKSPACE_REQUIRED",
      })
    }

    const label = await createLabelServer({
      currentUserId: appContext.ensuredUser.userId,
      workspaceId,
      ...parsed,
    })

    return jsonOk({
      ok: true,
      label,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to create label", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create label"),
      500,
      {
        code: "LABEL_CREATE_FAILED",
      }
    )
  }
}
