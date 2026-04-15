import { NextRequest } from "next/server"

import { channelSchema } from "@/lib/domain/types"
import { createChannelServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    channelSchema,
    "Invalid channel payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await createChannelServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed,
    })

    return jsonOk({
      ok: true,
      conversationId: result?.conversationId ?? null,
    })
  } catch (error) {
    logProviderError("Failed to create channel", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create channel"),
      500
    )
  }
}
