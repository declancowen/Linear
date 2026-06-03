import type { ScopedReadModelServerInstruction } from "@/lib/server/convex"
import {
  ApplicationError,
  coerceApplicationError,
  isApplicationError,
} from "@/lib/server/application-errors"
import type { AuthenticatedSession } from "@/lib/server/route-auth"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"
import { getScopedReadModelServer } from "@/lib/server/convex"
import { getSelectedWorkspaceIdFromCookies } from "@/lib/server/workspace-selection"

type CollectionReadModelScopeType = "personal" | "team" | "workspace"
type CollectionReadModelKind = Extract<
  ScopedReadModelServerInstruction,
  { scopeType: CollectionReadModelScopeType }
>["kind"]

const EXPECTED_PARAMETERIZED_READ_MODEL_ERROR_MESSAGES = new Set([
  "Channel not found",
  "Conversation not found",
  "Document not found",
  "Project not found",
  "Team not found",
  "Work item not found",
  "Workspace not found",
])

const EXPECTED_PARAMETERIZED_READ_MODEL_ACCESS_ERROR_PATTERN =
  /^You do not have access to this (?:conversation|document|team|workspace)$/i

function isExpectedParameterizedReadModelErrorMessage(message: string) {
  return (
    EXPECTED_PARAMETERIZED_READ_MODEL_ERROR_MESSAGES.has(message) ||
    EXPECTED_PARAMETERIZED_READ_MODEL_ACCESS_ERROR_PATTERN.test(message)
  )
}

function toParameterizedReadModelNotFoundError(options: {
  notFoundMessage: string
  notFoundCode: string
}) {
  return new ApplicationError(options.notFoundMessage, 404, {
    code: options.notFoundCode,
  })
}

function coerceParameterizedScopedReadModelError(
  error: unknown,
  options: {
    notFoundMessage: string
    notFoundCode: string
  }
) {
  if (
    isApplicationError(error) &&
    isExpectedParameterizedReadModelErrorMessage(error.message)
  ) {
    return toParameterizedReadModelNotFoundError(options)
  }

  if (isApplicationError(error)) {
    return error
  }

  return coerceApplicationError(error, [
    {
      match: isExpectedParameterizedReadModelErrorMessage,
      status: 404,
      code: options.notFoundCode,
      message: options.notFoundMessage,
    },
  ])
}

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
>(
  request: Request,
  options: {
    kind: CollectionReadModelKind
    allowedScopeTypes: ReadonlySet<TScopeType>
    invalidScopeMessage: string
    invalidScopeCode: string
    failureLogLabel: string
    failureMessage: string
    failureCode: string
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
    const data = await loadScopedReadModelForSession(session, {
      kind: options.kind,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
    } as ScopedReadModelServerInstruction)

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

export async function handleScopedReadModelGet<TData>(options: {
  instruction: ScopedReadModelServerInstruction
  failureLogLabel: string
  failureMessage: string
  failureCode: string
}) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const data = await loadScopedReadModelForSession(
      session,
      options.instruction
    )

    return jsonOk({
      data: data as TData,
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

export async function handleParameterizedScopedReadModelGet<
  TParams extends Record<string, string>,
>(
  params: Promise<TParams>,
  options: {
    buildInstruction: (params: TParams) => ScopedReadModelServerInstruction
    failureLogLabel: string
    failureMessage: string
    failureCode: string
    notFoundMessage: string
    notFoundCode: string
  }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const resolvedParams = await params
    const data = await loadScopedReadModelForSession(
      session,
      options.buildInstruction(resolvedParams)
    )

    if (!data) {
      return jsonError(options.notFoundMessage, 404, {
        code: options.notFoundCode,
      })
    }

    return jsonOk({
      data,
    })
  } catch (error) {
    const applicationError = coerceParameterizedScopedReadModelError(error, {
      notFoundMessage: options.notFoundMessage,
      notFoundCode: options.notFoundCode,
    })

    if (applicationError) {
      return jsonApplicationError(applicationError)
    }

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

export async function loadScopedReadModelForSession(
  session: AuthenticatedSession,
  instruction: ScopedReadModelServerInstruction
) {
  const selectedWorkspaceId = await getSelectedWorkspaceIdFromCookies()

  return getScopedReadModelServer({
    workosUserId: session.user.id,
    email: session.user.email ?? undefined,
    selectedWorkspaceId,
    instruction,
  })
}
