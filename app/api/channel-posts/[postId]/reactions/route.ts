import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { toggleChannelPostReactionServer } from "@/lib/server/convex"

const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = reactionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reaction payload" },
      { status: 400 }
    )
  }

  try {
    const { postId } = await params
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    await toggleChannelPostReactionServer({
      currentUserId: ensuredUser.userId,
      postId,
      emoji: parsed.data.emoji,
    })

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update reaction",
      },
      { status: 500 }
    )
  }
}
