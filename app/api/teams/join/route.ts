import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { joinCodeSchema } from "@/lib/domain/types"
import { joinTeamByCodeServer } from "@/lib/server/convex"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = joinCodeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 400 })
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const joined = await joinTeamByCodeServer({
      currentUserId: ensuredUser.userId,
      code: parsed.data.code,
    })

    if (!joined) {
      return NextResponse.json({ error: "Unable to join team" }, { status: 500 })
    }

    await ensureAuthenticatedAppContext(session.user, session.organizationId)

    return NextResponse.json({
      ok: true,
      teamSlug: joined.teamSlug,
      workspaceId: joined.workspaceId,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to join team",
      },
      { status: 500 }
    )
  }
}
