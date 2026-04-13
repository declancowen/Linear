import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { regenerateTeamJoinCodeServer } from "@/lib/server/convex"
import { withGeneratedJoinCode } from "@/lib/server/join-codes"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { teamId } = await params
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const result = await withGeneratedJoinCode((joinCode) =>
      regenerateTeamJoinCodeServer({
        currentUserId: ensuredUser.userId,
        teamId,
        joinCode,
      })
    )

    return NextResponse.json({
      ok: true,
      joinCode: result.joinCode,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to regenerate join code",
      },
      { status: 500 }
    )
  }
}
