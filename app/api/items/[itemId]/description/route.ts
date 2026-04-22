import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import { updateItemDescriptionServer } from "@/lib/server/convex"
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

const itemDescriptionSchema = z.object({
  content: z.string().trim().min(1),
  expectedUpdatedAt: z.string().datetime().optional(),
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

    const result = await updateItemDescriptionServer({
      currentUserId: appContext.ensuredUser.userId,
      itemId,
      content: parsed.content,
      expectedUpdatedAt: parsed.expectedUpdatedAt,
    })

    if (!result || typeof result.updatedAt !== "string") {
      throw new Error("Item description update did not return an updated timestamp")
    }

    return jsonOk({
      ok: true,
      updatedAt: result.updatedAt,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update description", error)
    return jsonError(getConvexErrorMessage(error, "Failed to update description"), 500, {
      code: "ITEM_DESCRIPTION_UPDATE_FAILED",
    })
  }
}
