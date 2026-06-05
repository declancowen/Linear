import type { NextRequest } from "next/server"

import { customPropertyValueSchema } from "@/lib/domain/types"
import { isApplicationError } from "@/lib/server/application-errors"
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
} from "@/lib/server/route-response"

type AuthenticatedRouteSession = Exclude<
  Awaited<ReturnType<typeof requireSession>>,
  Response
>

type CustomPropertyValueRouteParams = {
  propertyId: string
}

async function parseCustomPropertyValueRequest(request: NextRequest) {
  return parseJsonBody(
    request,
    customPropertyValueSchema,
    "Invalid custom property value payload"
  )
}

export type CustomPropertyValueRouteContext<
  TParams extends CustomPropertyValueRouteParams,
> = {
  currentUserId: string
  parsed: Exclude<
    Awaited<ReturnType<typeof parseCustomPropertyValueRequest>>,
    Response
  >
  propertyId: string
  routeParams: TParams
  scopeKeys: string[]
}

export async function requireCustomPropertyValueRouteContext<
  TParams extends CustomPropertyValueRouteParams,
>({
  params,
  request,
  resolveScopeKeys,
}: {
  params: Promise<TParams>
  request: NextRequest
  resolveScopeKeys: (
    session: AuthenticatedRouteSession,
    routeParams: TParams
  ) => Promise<string[]>
}): Promise<CustomPropertyValueRouteContext<TParams> | Response> {
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

  const routeParams = await params
  const scopeKeys = await resolveScopeKeys(session, routeParams)

  return {
    currentUserId: appContext.ensuredUser.userId,
    parsed,
    propertyId: routeParams.propertyId,
    routeParams,
    scopeKeys,
  }
}

export function handleCustomPropertyRouteError(
  error: unknown,
  logMessage: string,
  code: string
) {
  if (isApplicationError(error)) {
    return jsonApplicationError(error)
  }

  logProviderError(logMessage, error)
  return jsonError(getConvexErrorMessage(error, logMessage), 500, { code })
}
