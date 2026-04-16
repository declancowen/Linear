import { NextResponse } from "next/server"

import {
  getSnapshotVersionServer,
} from "@/lib/server/convex"
import {
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireConvexUser, requireSession } from "@/lib/server/route-auth"
import { isRouteResponse } from "@/lib/server/route-response"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

const STREAM_POLL_INTERVAL_MS = 1000
const STREAM_HEARTBEAT_INTERVAL_MS = 15000
const STREAM_MAX_DURATION_MS = 55000

export const dynamic = "force-dynamic"

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

async function getSnapshotVersionForUser(
  authenticatedUser: AuthenticatedAppUser,
  currentUserId: string
) {
  try {
    const snapshotVersion = await getSnapshotVersionServer({
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
    })

    return {
      snapshotVersion,
    }
  } catch (error) {
    logProviderError("Falling back to snapshot stream version 0", error)

    return {
      snapshotVersion: {
        version: 0,
        currentUserId,
      },
    }
  }
}

export async function GET(request: Request) {
  const encoder = new TextEncoder()
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const authContext = await requireConvexUser(session)

  if (isRouteResponse(authContext)) {
    return authContext
  }

  const authenticatedUser = toAuthenticatedAppUser(session.user, session.organizationId)
  const authenticatedSnapshotVersion = await getSnapshotVersionForUser(
    authenticatedUser,
    authContext.currentUser.id
  )

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
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
          )
        )
      }

      request.signal.addEventListener("abort", close)

      void (async () => {
        try {
          let currentSnapshotVersion =
            authenticatedSnapshotVersion.snapshotVersion
          let lastHeartbeatAt = Date.now()
          const startedAt = Date.now()

          sendEvent("ready", currentSnapshotVersion)

          while (!closed && !request.signal.aborted) {
            if (Date.now() - startedAt >= STREAM_MAX_DURATION_MS) {
              break
            }

            await sleep(STREAM_POLL_INTERVAL_MS)

            if (closed || request.signal.aborted) {
              break
            }

            const nextSnapshotVersion =
              await getSnapshotVersionForUser(
                authenticatedUser,
                authContext.currentUser.id
              )

            if (
              nextSnapshotVersion.snapshotVersion.version !==
              currentSnapshotVersion?.version
            ) {
              currentSnapshotVersion = nextSnapshotVersion.snapshotVersion
              sendEvent("snapshot", currentSnapshotVersion)
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
          logProviderError("Snapshot event stream failed", error)
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
