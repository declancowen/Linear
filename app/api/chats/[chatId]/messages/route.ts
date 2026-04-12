import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { chatMessageSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { sendChatMessageServer } from "@/lib/server/convex"

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
