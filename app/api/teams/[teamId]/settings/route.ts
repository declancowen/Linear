import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { teamWorkflowSettingsSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { updateTeamWorkflowSettingsServer } from "@/lib/server/convex"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = teamWorkflowSettingsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid team workflow payload" },
      { status: 400 }
    )
  }

  try {
    const { teamId } = await params
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    await updateTeamWorkflowSettingsServer({
      currentUserId: ensuredUser.userId,
      teamId,
      workflow: parsed.data,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update team workflow settings",
      },
      { status: 500 }
    )
  }
}
