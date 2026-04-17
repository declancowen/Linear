import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { commentSchema } from "@/lib/domain/types"
import { addCommentServer } from "@/lib/server/convex"
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

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    commentSchema,
    "Invalid comment payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await addCommentServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed,
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to post comment", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to post comment"),
      500,
      {
        code: "COMMENT_CREATE_FAILED",
      }
    )
  }
}
