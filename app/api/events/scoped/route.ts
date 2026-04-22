import { NextResponse } from "next/server"

import { getScopedReadModelVersionsServer } from "@/lib/server/convex"
import { logProviderError } from "@/lib/server/provider-errors"
import { requireConvexUser, requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError } from "@/lib/server/route-response"

const STREAM_POLL_INTERVAL_MS = 1000
const STREAM_HEARTBEAT_INTERVAL_MS = 15000
const STREAM_MAX_DURATION_MS = 55000

export const dynamic = "force-dynamic"

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

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

  const encoder = new TextEncoder()
  const initial = await getScopedReadModelVersionsServer({
    scopeKeys,
  })

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false

      const close = () => {
        if (closed) {
          return
        }

        closed = true

        try {
          controller.close()
        } catch {}
      }

      const sendEvent = (event: string, payload: unknown) => {
        if (closed) {
          return
        }

        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
        )
      }

      request.signal.addEventListener("abort", close)

      void (async () => {
        try {
          let currentVersions = new Map(
            initial.versions.map((entry) => [entry.scopeKey, entry.version])
          )
          let lastHeartbeatAt = Date.now()
          const startedAt = Date.now()

          sendEvent("ready", {
            versions: initial.versions,
          })

          while (!closed && !request.signal.aborted) {
            if (Date.now() - startedAt >= STREAM_MAX_DURATION_MS) {
              break
            }

            await sleep(STREAM_POLL_INTERVAL_MS)

            if (closed || request.signal.aborted) {
              break
            }

            const next = await getScopedReadModelVersionsServer({
              scopeKeys,
            })
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
        } catch (error) {
          logProviderError("Scoped invalidation event stream failed", error)
        } finally {
          close()
        }
      })()
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  })
}
