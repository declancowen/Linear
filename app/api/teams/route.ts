import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { teamDetailsSchema } from "@/lib/domain/types"
import {
  ensureAuthenticatedAppContext,
  reconcileAuthenticatedAppContext,
} from "@/lib/server/authenticated-app"
import { createTeamServer } from "@/lib/server/convex"
import { withGeneratedJoinCode } from "@/lib/server/join-codes"

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

    const targetWorkspace =
      authContext?.currentWorkspace ?? authContext?.pendingWorkspace ?? null

    if (!targetWorkspace) {
      return NextResponse.json(
        { error: "No active workspace" },
        { status: 400 }
      )
    }

    const result = await withGeneratedJoinCode((joinCode) =>
      createTeamServer({
        currentUserId: ensuredUser.userId,
        workspaceId: targetWorkspace.id,
        joinCode,
        ...parsed.data,
      })
    )

    try {
      await reconcileAuthenticatedAppContext(session.user, session.organizationId)
    } catch (error) {
      console.error("Failed to reconcile app context after team creation", error)
    }

    return NextResponse.json({
      ok: true,
      teamId: result?.teamId ?? null,
      teamSlug: result?.teamSlug ?? null,
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
