import { isApplicationError } from "@/lib/server/application-errors"
import {
  getSnapshotVersionServer,
} from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireConvexUser, requireSession } from "@/lib/server/route-auth"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

async function loadSnapshotVersionWithFallback(input: {
  authenticatedUser: ReturnType<typeof toAuthenticatedAppUser>
  currentUserId: string
}) {
  try {
    return await getSnapshotVersionServer({
      workosUserId: input.authenticatedUser.workosUserId,
      email: input.authenticatedUser.email,
    })
  } catch (error) {
    logProviderError("Falling back to snapshot version 0", error)

    return {
      version: 0,
      currentUserId: input.currentUserId,
    }
  }
}

export async function GET() {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const authenticatedUser = toAuthenticatedAppUser(session.user, session.organizationId)
    const authContext = await requireConvexUser(session)

    if (isRouteResponse(authContext)) {
      return authContext
    }

    const snapshotVersion = await loadSnapshotVersionWithFallback({
      authenticatedUser,
      currentUserId: authContext.currentUser.id,
    })

    return jsonOk(snapshotVersion)
  } catch (error) {
    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to load snapshot version", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to load snapshot version"),
      500
    )
  }
}
