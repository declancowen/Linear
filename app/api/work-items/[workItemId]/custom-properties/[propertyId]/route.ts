import { NextRequest } from "next/server"

import {
  bumpScopedReadModelVersionsServer,
  setCustomPropertyValueServer,
} from "@/lib/server/convex"
import { resolveWorkItemReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
import {
  handleCustomPropertyRouteError,
  requireCustomPropertyValueRouteContext,
  type CustomPropertyValueRouteContext,
} from "@/lib/server/custom-property-route-utils"
import {
  isRouteResponse,
  jsonOk,
} from "@/lib/server/route-response"

type WorkItemCustomPropertyValueParams = {
  propertyId: string
  workItemId: string
}

async function requireCustomPropertyValueContext(
  request: NextRequest,
  params: Promise<WorkItemCustomPropertyValueParams>
) {
  return requireCustomPropertyValueRouteContext({
    request,
    params,
    resolveScopeKeys: (session, routeParams) =>
      resolveWorkItemReadModelScopeKeysServer(session, routeParams.workItemId),
  })
}

async function updateCustomPropertyValue(
  context: CustomPropertyValueRouteContext<WorkItemCustomPropertyValueParams>
) {
  try {
    await setCustomPropertyValueServer({
      currentUserId: context.currentUserId,
      targetType: "workItem",
      targetId: context.routeParams.workItemId,
      workItemId: context.routeParams.workItemId,
      propertyId: context.propertyId,
      value: context.parsed.value,
    })
    await bumpScopedReadModelVersionsServer({ scopeKeys: context.scopeKeys })

    return jsonOk({ ok: true })
  } catch (error) {
    return handleCustomPropertyRouteError(
      error,
      "Failed to update custom property value",
      "CUSTOM_PROPERTY_VALUE_UPDATE_FAILED"
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<WorkItemCustomPropertyValueParams> }
) {
  const context = await requireCustomPropertyValueContext(request, params)

  if (isRouteResponse(context)) {
    return context
  }

  return updateCustomPropertyValue(context)
}
