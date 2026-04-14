import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import {
  ensureConvexUserReadyServer,
  getSnapshotVersionServer,
} from "@/lib/server/convex"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

async function loadSnapshotVersionWithFallback(input: {
  workosUserId: string
  email: string
  currentUserId: string
}) {
  try {
    return await getSnapshotVersionServer({
      workosUserId: input.workosUserId,
      email: input.email,
    })
  } catch (error) {
    console.error("Falling back to snapshot version 0", error)

    return {
      version: 0,
      currentUserId: input.currentUserId,
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
    const authContext = await ensureConvexUserReadyServer(authenticatedUser)

    if (!authContext?.currentUser) {
      return NextResponse.json(
        { error: "User context not found" },
        { status: 404 }
      )
    }

    const snapshotVersion = await loadSnapshotVersionWithFallback({
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
      currentUserId: authContext.currentUser.id,
    })

    return NextResponse.json(snapshotVersion)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load snapshot version",
      },
      { status: 500 }
    )
  }
}
