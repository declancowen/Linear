import { ApplicationError } from "@/lib/server/application-errors"
import { getScopedReadModelVersionsServer } from "@/lib/server/convex"
import {
  createEventStreamResponse,
  createServerSentEventResponse,
  runPollingEventStream,
} from "@/lib/server/event-stream"
import { requireConvexRouteContext } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError } from "@/lib/server/route-response"
import { authorizeScopedReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
import { pollScopedReadModelVersions } from "./polling"

const STREAM_POLL_INTERVAL_MS = 1000
const STREAM_HEARTBEAT_INTERVAL_MS = 15000
const STREAM_MAX_DURATION_MS = 55000
const STREAM_DEFAULT_RETRY_MS = 3000
const STREAM_UNAVAILABLE_RETRY_MS = 10000

export const dynamic = "force-dynamic"

function normalizeScopeKeys(request: Request) {
  return [
    ...new Set(
      new URL(request.url).searchParams
        .getAll("scopeKey")
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ]
}

export async function GET(request: Request) {
  const routeContext = await requireConvexRouteContext()

  if (isRouteResponse(routeContext)) {
    return routeContext
  }

  const { session } = routeContext
  const scopeKeys = normalizeScopeKeys(request)

  if (scopeKeys.length === 0) {
    return jsonError("At least one scopeKey is required", 400, {
      code: "ROUTE_INVALID_QUERY",
    })
  }

  try {
    await authorizeScopedReadModelScopeKeysServer(session, scopeKeys)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "You do not have access to one or more scope keys"
    const isInvalidScopeKey = message.startsWith(
      "Invalid scoped read model key:"
    )

    return jsonError(message, isInvalidScopeKey ? 400 : 403, {
      code: isInvalidScopeKey
        ? "ROUTE_INVALID_QUERY"
        : "ROUTE_FORBIDDEN_SCOPE_KEY",
    })
  }

  let initial

  try {
    initial = await getScopedReadModelVersionsServer({
      scopeKeys,
    })
  } catch (error) {
    if (
      error instanceof ApplicationError &&
      error.code === "SCOPED_READ_MODELS_UNAVAILABLE"
    ) {
      return createServerSentEventResponse(
        "unavailable",
        {
          code: error.code,
          message: error.message,
        },
        {
          retryMs: STREAM_UNAVAILABLE_RETRY_MS,
        }
      )
    }

    throw error
  }
  return createEventStreamResponse(
    request,
    "Scoped invalidation event stream failed",
    async (context) => {
      const pollState = {
        currentVersions: new Map(
          initial.versions.map((entry) => [entry.scopeKey, entry.version])
        ),
      }

      context.sendEvent(
        "ready",
        {
          versions: initial.versions,
        },
        {
          retryMs: STREAM_DEFAULT_RETRY_MS,
        }
      )

      await runPollingEventStream(context, {
        heartbeatIntervalMs: STREAM_HEARTBEAT_INTERVAL_MS,
        maxDurationMs: STREAM_MAX_DURATION_MS,
        pollIntervalMs: STREAM_POLL_INTERVAL_MS,
        poll: () =>
          pollScopedReadModelVersions(
            context,
            pollState,
            scopeKeys,
            STREAM_UNAVAILABLE_RETRY_MS
          ),
      })
    }
  )
}
