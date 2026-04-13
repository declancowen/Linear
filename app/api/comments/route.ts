import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { commentSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  addCommentServer,
  markNotificationsEmailedServer,
} from "@/lib/server/convex"
import { sendMentionEmails } from "@/lib/server/email"

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = commentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid comment payload" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const result = await addCommentServer({
      currentUserId: ensuredUser.userId,
      ...parsed.data,
    })

    try {
      const emailedNotificationIds = await sendMentionEmails({
        origin: new URL(request.url).origin,
        emails: result?.mentionEmails ?? [],
      })

      if (emailedNotificationIds.length > 0) {
        await markNotificationsEmailedServer(emailedNotificationIds)
      }
    } catch (emailError) {
      console.error("Failed to send mention emails", emailError)
    }

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to post comment",
      },
      { status: 500 }
    )
  }
}
