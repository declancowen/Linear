import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { updateItemDescriptionServer } from "@/lib/server/convex"

const itemDescriptionSchema = z.object({
  content: z.string().trim().min(1),
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
  const parsed = itemDescriptionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid item description payload" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    await updateItemDescriptionServer({
      currentUserId: ensuredUser.userId,
      itemId,
      content: parsed.data.content,
    })

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update description",
      },
      { status: 500 }
    )
  }
}
