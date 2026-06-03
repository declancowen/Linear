import { ApplicationError } from "@/lib/server/application-errors"
import {
  REALTIME_STREAM_DEFAULT_RETRY_MS,
  REALTIME_STREAM_HEARTBEAT_INTERVAL_MS,
  REALTIME_STREAM_MAX_DURATION_MS,
  REALTIME_STREAM_UNAVAILABLE_RETRY_MS,
  resolveRealtimeStreamPollIntervalMs,
} from "@/lib/realtime/cost-policy"
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
          retryMs: REALTIME_STREAM_UNAVAILABLE_RETRY_MS,
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
          retryMs: REALTIME_STREAM_DEFAULT_RETRY_MS,
        }
      )

      await runPollingEventStream(context, {
        heartbeatIntervalMs: REALTIME_STREAM_HEARTBEAT_INTERVAL_MS,
        maxDurationMs: REALTIME_STREAM_MAX_DURATION_MS,
        pollIntervalMs: resolveRealtimeStreamPollIntervalMs(),
        poll: () =>
          pollScopedReadModelVersions(
            context,
            pollState,
            scopeKeys,
            REALTIME_STREAM_UNAVAILABLE_RETRY_MS
          ),
      })
    }
  )
}
