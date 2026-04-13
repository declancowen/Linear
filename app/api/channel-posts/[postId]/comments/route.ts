import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { channelPostCommentSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  addChannelPostCommentServer,
  markNotificationsEmailedServer,
} from "@/lib/server/convex"
import { sendMentionEmails } from "@/lib/server/email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { postId } = await params
  const parsed = channelPostCommentSchema.safeParse({
    postId,
    content: body.content,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment payload" }, { status: 400 })
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    const result = await addChannelPostCommentServer({
      currentUserId: ensuredUser.userId,
      ...parsed.data,
    })
    const emailedNotificationIds = await sendMentionEmails({
      origin: new URL(request.url).origin,
      emails: result?.mentionEmails ?? [],
    })

    if (emailedNotificationIds.length > 0) {
      await markNotificationsEmailedServer(emailedNotificationIds)
    }

    return NextResponse.json({
      ok: true,
      commentId: result?.commentId ?? null,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create comment",
      },
      { status: 500 }
    )
  }
}
