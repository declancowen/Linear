import { NextRequest } from "next/server"
import { z } from "zod"

import { updateItemDescriptionServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

const itemDescriptionSchema = z.object({
  content: z.string().trim().min(1),
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
    itemDescriptionSchema,
    "Invalid item description payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await updateItemDescriptionServer({
      currentUserId: appContext.ensuredUser.userId,
      itemId,
      content: parsed.content,
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    logProviderError("Failed to update description", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update description"),
      500
    )
  }
}
