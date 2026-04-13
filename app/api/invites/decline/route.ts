import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { declineInviteServer, getInviteByTokenServer } from "@/lib/server/convex"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

const declineInviteSchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = declineInviteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite token" }, { status: 400 })
  }

  try {
    const invite = await getInviteByTokenServer(parsed.data.token)

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    if (invite.invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invite belongs to a different email address" },
        { status: 403 }
      )
    }

    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    await declineInviteServer({
      currentUserId: ensuredUser.userId,
      token: parsed.data.token,
    })

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to decline invite",
      },
      { status: 500 }
    )
  }
}
