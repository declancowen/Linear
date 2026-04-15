import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import {
  ensureConvexUserReadyServer,
  getErrorDiagnostics,
  getSnapshotServer,
  getSnapshotVersionServer,
} from "@/lib/server/convex"
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
    console.error("Falling back to snapshot version 0", getErrorDiagnostics(error))

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
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const authenticatedUser = toAuthenticatedAppUser(
      session.user,
      session.organizationId
    )
    await ensureConvexUserReadyServer(authenticatedUser)
    return NextResponse.json(await loadSnapshotWithVersion(authenticatedUser))
  } catch (error) {
    console.error("Failed to load snapshot", getErrorDiagnostics(error))
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load snapshot",
      },
      { status: 500 }
    )
  }
}
