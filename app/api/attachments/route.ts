import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { attachmentSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { createAttachmentServer } from "@/lib/server/convex"

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = attachmentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid attachment payload" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    const result = await createAttachmentServer({
      currentUserId: ensuredUser.userId,
      ...parsed.data,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create attachment",
      },
      { status: 500 }
    )
  }
}
