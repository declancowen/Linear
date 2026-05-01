import type { AppSnapshot } from "@/lib/domain/types"
import type { AuthenticatedSession } from "@/lib/server/route-auth"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { loadScopedReadModelSnapshotForSession } from "@/lib/server/scoped-read-models"

type CollectionReadModelScopeType = "personal" | "team" | "workspace"

function parseCollectionReadModelScopeSearchParams<
  TScopeType extends CollectionReadModelScopeType,
>(searchParams: URLSearchParams, allowedScopeTypes: ReadonlySet<TScopeType>) {
  const scopeType = searchParams.get("scopeType")
  const scopeId = searchParams.get("scopeId")?.trim()

  if (
    (scopeType !== "personal" &&
      scopeType !== "team" &&
      scopeType !== "workspace") ||
    !scopeId ||
    !allowedScopeTypes.has(scopeType as TScopeType)
  ) {
    return null
  }

  return {
    scopeType: scopeType as TScopeType,
    scopeId,
  }
}

export async function handleCollectionReadModelGet<
  TScopeType extends CollectionReadModelScopeType,
  TData,
>(
  request: Request,
  options: {
    allowedScopeTypes: ReadonlySet<TScopeType>
    invalidScopeMessage: string
    invalidScopeCode: string
    failureLogLabel: string
    failureMessage: string
    failureCode: string
    select: (
      snapshot: AppSnapshot,
      scopeType: TScopeType,
      scopeId: string
    ) => TData
  }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const scope = parseCollectionReadModelScopeSearchParams(
    new URL(request.url).searchParams,
    options.allowedScopeTypes
  )

  if (!scope) {
    return jsonError(options.invalidScopeMessage, 400, {
      code: options.invalidScopeCode,
    })
  }

  try {
    const snapshot = await loadScopedReadModelSnapshotForSession(session)

    return jsonOk({
      data: options.select(snapshot, scope.scopeType, scope.scopeId),
    })
  } catch (error) {
    logProviderError(options.failureLogLabel, error)

    return jsonError(
      getConvexErrorMessage(error, options.failureMessage),
      500,
      {
        code: options.failureCode,
      }
    )
  }
}

export async function handleSnapshotReadModelGet<TData>(options: {
  failureLogLabel: string
  failureMessage: string
  failureCode: string
  select: (snapshot: AppSnapshot) => TData
}) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const snapshot = await loadScopedReadModelSnapshotForSession(session)

    return jsonOk({
      data: options.select(snapshot),
    })
  } catch (error) {
    logProviderError(options.failureLogLabel, error)

    return jsonError(
      getConvexErrorMessage(error, options.failureMessage),
      500,
      {
        code: options.failureCode,
      }
    )
  }
}

export async function handleParameterizedSnapshotReadModelGet<
  TParams extends Record<string, string>,
  TData,
>(
  params: Promise<TParams>,
  options: {
    failureLogLabel: string
    failureMessage: string
    failureCode: string
    notFoundMessage: string
    notFoundCode: string
    select: (snapshot: AppSnapshot, params: TParams) => TData | null
  }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const resolvedParams = await params
    const snapshot = await loadScopedReadModelSnapshotForSession(session)
    const data = options.select(snapshot, resolvedParams)

    if (!data) {
      return jsonError(options.notFoundMessage, 404, {
        code: options.notFoundCode,
      })
    }

    return jsonOk({
      data,
    })
  } catch (error) {
    logProviderError(options.failureLogLabel, error)

    return jsonError(
      getConvexErrorMessage(error, options.failureMessage),
      500,
      {
        code: options.failureCode,
      }
    )
  }
}

export async function handleWorkspaceReadModelGet<TData>(
  params: Promise<{ workspaceId: string }>,
  options: {
    failureLogLabel: string
    failureMessage: string
    failureCode: string
    load: (
      session: AuthenticatedSession,
      workspaceId: string
    ) => Promise<TData> | TData
  }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { workspaceId } = await params
    const data = await options.load(session, workspaceId)

    return jsonOk({
      data,
    })
  } catch (error) {
    logProviderError(options.failureLogLabel, error)

    return jsonError(
      getConvexErrorMessage(error, options.failureMessage),
      500,
      {
        code: options.failureCode,
      }
    )
  }
}
