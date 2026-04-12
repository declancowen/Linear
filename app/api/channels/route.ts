import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { channelSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { createChannelServer } from "@/lib/server/convex"

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = channelSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid channel payload" }, { status: 400 })
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    const result = await createChannelServer({
      currentUserId: ensuredUser.userId,
      ...parsed.data,
    })

    return NextResponse.json({
      ok: true,
      conversationId: result?.conversationId ?? null,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create channel" },
      { status: 500 }
    )
  }
}
