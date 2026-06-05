import { NextRequest } from "next/server"

import {
  bumpScopedReadModelVersionsServer,
  setCustomPropertyValueServer,
} from "@/lib/server/convex"
import {
  handleCustomPropertyRouteError,
  requireCustomPropertyValueRouteContext,
  type CustomPropertyValueRouteContext,
} from "@/lib/server/custom-property-route-utils"
import {
  isRouteResponse,
  jsonOk,
} from "@/lib/server/route-response"
import { resolveDocumentReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"

type DocumentCustomPropertyValueParams = {
  documentId: string
  propertyId: string
}

async function requireCustomPropertyValueContext(
  request: NextRequest,
  params: Promise<DocumentCustomPropertyValueParams>
) {
  return requireCustomPropertyValueRouteContext({
    request,
    params,
    resolveScopeKeys: (session, routeParams) =>
      resolveDocumentReadModelScopeKeysServer(session, routeParams.documentId),
  })
}

async function updateCustomPropertyValue(
  context: CustomPropertyValueRouteContext<DocumentCustomPropertyValueParams>
) {
  try {
    await setCustomPropertyValueServer({
      currentUserId: context.currentUserId,
      targetType: "document",
      targetId: context.routeParams.documentId,
      propertyId: context.propertyId,
      value: context.parsed.value,
    })
    await bumpScopedReadModelVersionsServer({ scopeKeys: context.scopeKeys })

    return jsonOk({ ok: true })
  } catch (error) {
    return handleCustomPropertyRouteError(
      error,
      "Failed to update document custom property value",
      "DOCUMENT_CUSTOM_PROPERTY_VALUE_UPDATE_FAILED"
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<DocumentCustomPropertyValueParams> }
) {
  const context = await requireCustomPropertyValueContext(request, params)

  if (isRouteResponse(context)) {
    return context
  }

  return updateCustomPropertyValue(context)
}
