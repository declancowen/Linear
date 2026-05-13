import { NextRequest } from "next/server"

import { customPropertyValueSchema } from "@/lib/domain/types"
import {
  bumpScopedReadModelVersionsServer,
  setCustomPropertyValueServer,
} from "@/lib/server/convex"
import { resolveWorkItemReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
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
import { isApplicationError } from "@/lib/server/application-errors"

type CustomPropertyValueContext = {
  currentUserId: string
  parsed: Exclude<
    Awaited<ReturnType<typeof parseCustomPropertyValueRequest>>,
    Response
  >
  propertyId: string
  scopeKeys: string[]
  workItemId: string
}

function handleCustomPropertyValueRouteError(error: unknown) {
  if (isApplicationError(error)) {
    return jsonApplicationError(error)
  }

  logProviderError("Failed to update custom property value", error)
  return jsonError(
    getConvexErrorMessage(error, "Failed to update custom property value"),
    500,
    { code: "CUSTOM_PROPERTY_VALUE_UPDATE_FAILED" }
  )
}

async function requireCustomPropertyValueContext(
  request: NextRequest,
  params: Promise<{ workItemId: string; propertyId: string }>
): Promise<CustomPropertyValueContext | Response> {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseCustomPropertyValueRequest(request)

  if (isRouteResponse(parsed)) {
    return parsed
  }

  const appContext = await requireAppContext(session)

  if (isRouteResponse(appContext)) {
    return appContext
  }

  const { workItemId, propertyId } = await params
  const scopeKeys = await resolveWorkItemReadModelScopeKeysServer(
    session,
    workItemId
  )

  return {
    currentUserId: appContext.ensuredUser.userId,
    parsed,
    propertyId,
    scopeKeys,
    workItemId,
  }
}

async function updateCustomPropertyValue(context: CustomPropertyValueContext) {
  try {
    await setCustomPropertyValueServer({
      currentUserId: context.currentUserId,
      workItemId: context.workItemId,
      propertyId: context.propertyId,
      value: context.parsed.value,
    })
    await bumpScopedReadModelVersionsServer({ scopeKeys: context.scopeKeys })

    return jsonOk({ ok: true })
  } catch (error) {
    return handleCustomPropertyValueRouteError(error)
  }
}

async function parseCustomPropertyValueRequest(request: NextRequest) {
  return parseJsonBody(
    request,
    customPropertyValueSchema,
    "Invalid custom property value payload"
  )
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ workItemId: string; propertyId: string }> }
) {
  const context = await requireCustomPropertyValueContext(request, params)

  if (isRouteResponse(context)) {
    return context
  }

  return updateCustomPropertyValue(context)
}
