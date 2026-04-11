import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

import { inviteSchema } from "@/lib/domain/types"
import { createInviteServer } from "@/lib/server/convex"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = inviteSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite payload" }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const resendFromEmail = process.env.RESEND_FROM_EMAIL

  if (!resendApiKey || !resendFromEmail) {
    return NextResponse.json(
      { error: "Resend is not configured" },
      { status: 500 }
    )
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const resend = new Resend(resendApiKey)
    const origin = new URL(request.url).origin
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

    await Promise.all(
      createdInvites.map(async (created) => {
        if (!created) {
          return
        }

        const acceptUrl = new URL(`/join/${created.invite.token}`, origin).toString()

        await resend.emails.send({
          from: resendFromEmail,
          to: parsed.data.email,
          subject: `You're invited to ${created.workspaceName}`,
          text: [
            `You've been invited to join ${created.teamName} in ${created.workspaceName}.`,
            `Role: ${created.invite.role}`,
            `Accept the invite: ${acceptUrl}`,
            `Or join via team code: ${created.invite.joinCode}`,
          ].join("\n"),
          html: [
            `<p>You've been invited to join <strong>${created.teamName}</strong> in <strong>${created.workspaceName}</strong>.</p>`,
            `<p>Role: <strong>${created.invite.role}</strong></p>`,
            `<p><a href="${acceptUrl}">Accept your invite</a></p>`,
            `<p>If you prefer, you can also join with team code <strong>${created.invite.joinCode}</strong>.</p>`,
          ].join(""),
        })
      })
    )

    return NextResponse.json({
      ok: true,
      inviteIds: createdInvites.flatMap((entry) => (entry ? [entry.invite.id] : [])),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create invite",
      },
      { status: 500 }
    )
  }
}
