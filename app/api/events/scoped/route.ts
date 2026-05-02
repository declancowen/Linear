import { ApplicationError } from "@/lib/server/application-errors"
import { getScopedReadModelVersionsServer } from "@/lib/server/convex"
import {
  createEventStreamResponse,
  createServerSentEventResponse,
  sleep,
} from "@/lib/server/event-stream"
import { requireConvexUser, requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError } from "@/lib/server/route-response"
import { authorizeScopedReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"

const STREAM_POLL_INTERVAL_MS = 1000
const STREAM_HEARTBEAT_INTERVAL_MS = 15000
const STREAM_MAX_DURATION_MS = 55000
const STREAM_DEFAULT_RETRY_MS = 3000
const STREAM_UNAVAILABLE_RETRY_MS = 10000

export const dynamic = "force-dynamic"

function normalizeScopeKeys(request: Request) {
  return [...new Set(new URL(request.url).searchParams.getAll("scopeKey").map((value) => value.trim()).filter(Boolean))]
}

export async function GET(request: Request) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const authContext = await requireConvexUser(session)

  if (isRouteResponse(authContext)) {
    return authContext
  }

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
    const isInvalidScopeKey = message.startsWith("Invalid scoped read model key:")

    return jsonError(
      message,
      isInvalidScopeKey ? 400 : 403,
      {
        code: isInvalidScopeKey
          ? "ROUTE_INVALID_QUERY"
          : "ROUTE_FORBIDDEN_SCOPE_KEY",
      }
    )
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
    async ({ isClosed, sendEvent }) => {
      let currentVersions = new Map(
        initial.versions.map((entry) => [entry.scopeKey, entry.version])
      )
      let lastHeartbeatAt = Date.now()
      const startedAt = Date.now()

      sendEvent(
        "ready",
        {
          versions: initial.versions,
        },
        {
          retryMs: STREAM_DEFAULT_RETRY_MS,
        }
      )

      while (!isClosed()) {
        if (Date.now() - startedAt >= STREAM_MAX_DURATION_MS) {
          break
        }

        await sleep(STREAM_POLL_INTERVAL_MS)

        if (isClosed()) {
          break
        }

        let next

        try {
          next = await getScopedReadModelVersionsServer({
            scopeKeys,
          })
        } catch (error) {
          if (
            error instanceof ApplicationError &&
            error.code === "SCOPED_READ_MODELS_UNAVAILABLE"
          ) {
            sendEvent(
              "unavailable",
              {
                code: error.code,
                message: error.message,
              },
              {
                retryMs: STREAM_UNAVAILABLE_RETRY_MS,
              }
            )
            break
          }

          throw error
        }

        const changed = next.versions.filter(
          (entry) => currentVersions.get(entry.scopeKey) !== entry.version
        )

        if (changed.length > 0) {
          currentVersions = new Map(
            next.versions.map((entry) => [entry.scopeKey, entry.version])
          )
          sendEvent("scope", {
            versions: changed,
          })
          lastHeartbeatAt = Date.now()
          continue
        }

        if (Date.now() - lastHeartbeatAt >= STREAM_HEARTBEAT_INTERVAL_MS) {
          sendEvent("ping", {
            timestamp: new Date().toISOString(),
          })
          lastHeartbeatAt = Date.now()
        }
      }
    }
  )
}
