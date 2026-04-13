import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { teamDetailsSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { updateTeamDetailsServer } from "@/lib/server/convex"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = teamDetailsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid team details payload" }, { status: 400 })
  }

  try {
    const { teamId } = await params
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    await updateTeamDetailsServer({
      currentUserId: ensuredUser.userId,
      teamId,
      ...parsed.data,
    })

    return NextResponse.json({
      ok: true,
      teamId,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update team details",
      },
      { status: 500 }
    )
  }
}
