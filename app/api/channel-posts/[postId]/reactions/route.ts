import { NextRequest } from "next/server"
import { z } from "zod"

import { isApplicationError } from "@/lib/server/application-errors"
import { toggleChannelPostReactionServer } from "@/lib/server/convex"
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

const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    reactionSchema,
    "Invalid reaction payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const { postId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await toggleChannelPostReactionServer({
      currentUserId: appContext.ensuredUser.userId,
      postId,
      emoji: parsed.emoji,
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update reaction", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update reaction"),
      500
    )
  }
}
