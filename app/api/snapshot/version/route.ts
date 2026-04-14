import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import {
  ensureConvexUserFromAuth,
  getSnapshotVersionServer,
} from "@/lib/server/convex"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

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
    const snapshotVersion = await getSnapshotVersionServer({
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
    })

    return NextResponse.json(snapshotVersion)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Authenticated user not found"
    ) {
      try {
        const authenticatedUser = toAuthenticatedAppUser(
          session.user,
          session.organizationId
        )

        await ensureConvexUserFromAuth(authenticatedUser)

        const snapshotVersion = await getSnapshotVersionServer({
          workosUserId: authenticatedUser.workosUserId,
          email: authenticatedUser.email,
        })

        return NextResponse.json(snapshotVersion)
      } catch (retryError) {
        console.error(retryError)
        return NextResponse.json(
          {
            error:
              retryError instanceof Error
                ? retryError.message
                : "Failed to load snapshot version",
          },
          { status: 500 }
        )
      }
    }

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
