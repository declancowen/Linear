import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { shiftTimelineItemServer } from "@/lib/server/convex"

const timelineShiftSchema = z.object({
  nextStartDate: z.string().min(1),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { itemId } = await params
  const body = await request.json()
  const parsed = timelineShiftSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid timeline payload" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    await shiftTimelineItemServer({
      currentUserId: ensuredUser.userId,
      itemId,
      nextStartDate: parsed.data.nextStartDate,
    })

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to move timeline item",
      },
      { status: 500 }
    )
  }
}
