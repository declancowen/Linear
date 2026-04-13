import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { inviteSchema } from "@/lib/domain/types"
import { createInviteServer } from "@/lib/server/convex"
import { sendTeamInviteEmails } from "@/lib/server/email"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = inviteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid invite payload" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const createdInvites = await Promise.all(
      parsed.data.teamIds.map((teamId) =>
        createInviteServer({
          currentUserId: ensuredUser.userId,
          teamId,
          email: parsed.data.email,
          role: parsed.data.role,
        })
      )
    )

    if (createdInvites.some((entry) => !entry)) {
      return NextResponse.json(
        { error: "Failed to persist invite" },
        { status: 500 }
      )
    }

    await sendTeamInviteEmails({
      invites: createdInvites.flatMap((created) =>
        created
          ? [
              {
                email: parsed.data.email,
                workspaceName: created.workspaceName,
                teamName: created.teamName,
                role: created.invite.role,
                inviteToken: created.invite.token,
                joinCode: created.invite.joinCode,
              },
            ]
          : []
      ),
    })

    return NextResponse.json({
      ok: true,
      inviteIds: createdInvites.flatMap((entry) =>
        entry ? [entry.invite.id] : []
      ),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create invite",
      },
      { status: 500 }
    )
  }
}
