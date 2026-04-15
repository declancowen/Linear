import { NextRequest } from "next/server"
import { z } from "zod"

import { shiftTimelineItemServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

const timelineShiftSchema = z.object({
  nextStartDate: z.string().min(1),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const { itemId } = await params
  const parsed = await parseJsonBody(
    request,
    timelineShiftSchema,
    "Invalid timeline payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await shiftTimelineItemServer({
      currentUserId: appContext.ensuredUser.userId,
      itemId,
      nextStartDate: parsed.nextStartDate,
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    logProviderError("Failed to move timeline item", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to move timeline item"),
      500
    )
  }
}
