import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  acceptInviteServer,
  getInviteByTokenServer,
} from "@/lib/server/convex"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

const acceptInviteSchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = acceptInviteSchema.safeParse(body)

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

    if (new Date(invite.invite.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 })
    }

    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const accepted = await acceptInviteServer({
      currentUserId: ensuredUser.userId,
      token: parsed.data.token,
    })
    await ensureAuthenticatedAppContext(session.user, session.organizationId)

    return NextResponse.json({
      ok: true,
      teamSlug: accepted.teamSlug,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to accept invite",
      },
      { status: 500 }
    )
  }
}
