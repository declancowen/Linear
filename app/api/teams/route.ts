import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { teamDetailsSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { createTeamServer } from "@/lib/server/convex"

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = teamDetailsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid team payload" }, { status: 400 })
  }

  try {
    const { ensuredUser, authContext } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    if (!authContext?.currentWorkspace) {
      return NextResponse.json(
        { error: "No active workspace" },
        { status: 400 }
      )
    }

    const result = await createTeamServer({
      currentUserId: ensuredUser.userId,
      workspaceId: authContext.currentWorkspace.id,
      ...parsed.data,
    })

    return NextResponse.json({
      ok: true,
      teamId: result?.teamId ?? null,
      teamSlug: result?.teamSlug ?? null,
      joinCode: result?.joinCode ?? parsed.data.joinCode.toUpperCase(),
      features: result?.features ?? parsed.data.features,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create team" },
      { status: 500 }
    )
  }
}
