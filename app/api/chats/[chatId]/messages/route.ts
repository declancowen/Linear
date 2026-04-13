import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { chatMessageSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  markNotificationsEmailedServer,
  sendChatMessageServer,
} from "@/lib/server/convex"
import { sendMentionEmails } from "@/lib/server/email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { chatId } = await params
  const parsed = chatMessageSchema.safeParse({
    conversationId: chatId,
    content: body.content,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message payload" }, { status: 400 })
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    const result = await sendChatMessageServer({
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
      messageId: result?.messageId ?? null,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    )
  }
}
