import { z } from "zod"

import {
  bumpScopedReadModelVersionsServer,
  setWorkItemSubscriptionServer,
} from "@/lib/server/convex"
import { ApplicationError } from "@/lib/server/application-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { resolveWorkItemReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const workItemSubscriptionSchema = z.object({
  subscribed: z.boolean(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    workItemSubscriptionSchema,
    "Invalid work item subscription payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  const appContext = await requireAppContext(session)

  if (isRouteResponse(appContext)) {
    return appContext
  }

  try {
    const { itemId } = await params
    const scopeKeys = await resolveWorkItemReadModelScopeKeysServer(
      session,
      itemId
    )
    const result = await setWorkItemSubscriptionServer({
      currentUserId: appContext.ensuredUser.userId,
      itemId,
      subscribed: parsed.subscribed,
    })

    await bumpScopedReadModelVersionsServer({
      scopeKeys,
    })

    return jsonOk({
      ok: true,
      subscribed: result?.subscribed ?? false,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update work item subscription", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update subscription"),
      500,
      {
        code: "WORK_ITEM_SUBSCRIPTION_UPDATE_FAILED",
      }
    )
  }
}
