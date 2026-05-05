import { getSnapshotVersionServer } from "@/lib/server/convex"
import {
  createEventStreamResponse,
  runPollingEventStream,
} from "@/lib/server/event-stream"
import { logProviderError } from "@/lib/server/provider-errors"
import { requireConvexRouteContext } from "@/lib/server/route-auth"
import { isRouteResponse } from "@/lib/server/route-response"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

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
  const routeContext = await requireConvexRouteContext()

  if (isRouteResponse(routeContext)) {
    return routeContext
  }

  const { authContext, authenticatedUser } = routeContext
  const authenticatedSnapshotVersion = await getSnapshotVersionForUser(
    authenticatedUser,
    authContext.currentUser.id
  )

  return createEventStreamResponse(
    request,
    "Snapshot event stream failed",
    async (context) => {
      let currentSnapshotVersion = authenticatedSnapshotVersion.snapshotVersion

      context.sendEvent("ready", currentSnapshotVersion)

      await runPollingEventStream(context, {
        heartbeatIntervalMs: STREAM_HEARTBEAT_INTERVAL_MS,
        maxDurationMs: STREAM_MAX_DURATION_MS,
        pollIntervalMs: STREAM_POLL_INTERVAL_MS,
        poll: async () => {
          const nextSnapshotVersion = await getSnapshotVersionForUser(
            authenticatedUser,
            authContext.currentUser.id
          )

          if (
            nextSnapshotVersion.snapshotVersion.version !==
            currentSnapshotVersion?.version
          ) {
            currentSnapshotVersion = nextSnapshotVersion.snapshotVersion
            context.sendEvent("snapshot", currentSnapshotVersion)
            return "changed"
          }
        },
      })
    }
  )
}
