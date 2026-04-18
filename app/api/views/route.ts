import { NextRequest } from "next/server"

import { viewSchema } from "@/lib/domain/types"
import { ApplicationError } from "@/lib/server/application-errors"
import { createViewServer } from "@/lib/server/convex"
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

  const parsed = await parseJsonBody(request, viewSchema, "Invalid view payload")

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await createViewServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed,
    })

    return jsonOk({
      ok: true,
      viewId: result?.id ?? null,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to create view", error)
    return jsonError(getConvexErrorMessage(error, "Failed to create view"), 500, {
      code: "VIEW_CREATE_FAILED",
    })
  }
}
