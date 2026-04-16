import { isApplicationError } from "@/lib/server/application-errors"
import {
  getSnapshotServer,
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
import type { AuthenticatedAppUser } from "@/lib/workos/auth"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

async function loadSnapshotVersion(authenticatedUser: AuthenticatedAppUser) {
  try {
    const snapshotVersion = await getSnapshotVersionServer({
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
    })

    return snapshotVersion.version
  } catch (error) {
    logProviderError("Falling back to snapshot version 0", error)

    return 0
  }
}

async function loadSnapshotWithVersion(
  authenticatedUser: AuthenticatedAppUser
) {
  const version = await loadSnapshotVersion(authenticatedUser)
  const snapshot = await getSnapshotServer({
    workosUserId: authenticatedUser.workosUserId,
    email: authenticatedUser.email,
  })

  return {
    snapshot,
    version,
  }
}

export async function GET() {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const authContext = await requireConvexUser(session)

    if (isRouteResponse(authContext)) {
      return authContext
    }

    const authenticatedUser = toAuthenticatedAppUser(session.user, session.organizationId)
    const payload = await loadSnapshotWithVersion(authenticatedUser)

    if (!authContext.currentUser) {
      return jsonError("User context not found", 404)
    }

    return jsonOk(payload)
  } catch (error) {
    logProviderError("Failed to load snapshot", error)

    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    return jsonError(
      getConvexErrorMessage(error, "Failed to load snapshot"),
      500
    )
  }
}
