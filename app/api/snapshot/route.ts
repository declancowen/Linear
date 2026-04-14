import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { getSnapshotServer } from "@/lib/server/convex"

export async function GET() {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { authenticatedUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const snapshot = await getSnapshotServer({
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
    })

    return NextResponse.json(snapshot)
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
