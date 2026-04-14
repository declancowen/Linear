import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import {
  ensureConvexUserReadyServer,
  getSnapshotServer,
  getSnapshotVersionServer,
} from "@/lib/server/convex"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

const MAX_STABLE_SNAPSHOT_ATTEMPTS = 3

async function loadStableSnapshot(authenticatedUser: AuthenticatedAppUser) {
  let expectedVersion = await getSnapshotVersionServer({
    workosUserId: authenticatedUser.workosUserId,
    email: authenticatedUser.email,
  })

  for (
    let attempt = 0;
    attempt < MAX_STABLE_SNAPSHOT_ATTEMPTS;
    attempt += 1
  ) {
    const snapshot = await getSnapshotServer({
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
    })
    const nextVersion = await getSnapshotVersionServer({
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
    })

    if (nextVersion.version === expectedVersion.version) {
      return {
        snapshot,
        version: nextVersion.version,
      }
    }

    expectedVersion = nextVersion
  }

  throw new Error("Failed to load a stable snapshot")
}

async function loadSnapshotWithVersionFallback(
  authenticatedUser: AuthenticatedAppUser
) {
  try {
    return await loadStableSnapshot(authenticatedUser)
  } catch (error) {
    console.error("Falling back to snapshot without version sync", error)

    return {
      snapshot: await getSnapshotServer({
        workosUserId: authenticatedUser.workosUserId,
        email: authenticatedUser.email,
      }),
      version: 0,
    }
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
    return NextResponse.json(
      await loadSnapshotWithVersionFallback(authenticatedUser)
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load snapshot",
      },
      { status: 500 }
    )
  }
}
