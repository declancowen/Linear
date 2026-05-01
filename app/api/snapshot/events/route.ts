import { getSnapshotVersionServer } from "@/lib/server/convex"
import {
  createEventStreamResponse,
  sleep,
} from "@/lib/server/event-stream"
import { logProviderError } from "@/lib/server/provider-errors"
import { requireConvexUser, requireSession } from "@/lib/server/route-auth"
import { isRouteResponse } from "@/lib/server/route-response"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

const STREAM_POLL_INTERVAL_MS = 1000
const STREAM_HEARTBEAT_INTERVAL_MS = 15000
const STREAM_MAX_DURATION_MS = 55000

export const dynamic = "force-dynamic"

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

  return createEventStreamResponse(
    request,
    "Snapshot event stream failed",
    async ({ isClosed, sendEvent }) => {
      let currentSnapshotVersion = authenticatedSnapshotVersion.snapshotVersion
      let lastHeartbeatAt = Date.now()
      const startedAt = Date.now()

      sendEvent("ready", currentSnapshotVersion)

      while (!isClosed()) {
        if (Date.now() - startedAt >= STREAM_MAX_DURATION_MS) {
          break
        }

        await sleep(STREAM_POLL_INTERVAL_MS)

        if (isClosed()) {
          break
        }

        const nextSnapshotVersion = await getSnapshotVersionForUser(
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
    }
  )
}
