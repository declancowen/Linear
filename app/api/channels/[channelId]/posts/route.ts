import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { channelPostSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  createChannelPostServer,
  markNotificationsEmailedServer,
} from "@/lib/server/convex"
import { sendMentionEmails } from "@/lib/server/email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { channelId } = await params
  const parsed = channelPostSchema.safeParse({
    conversationId: channelId,
    title: body.title,
    content: body.content,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid post payload" }, { status: 400 })
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    const result = await createChannelPostServer({
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
      postId: result?.postId ?? null,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create post" },
      { status: 500 }
    )
  }
}
