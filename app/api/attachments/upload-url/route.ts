import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { attachmentUploadUrlSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { generateAttachmentUploadUrlServer } from "@/lib/server/convex"

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = attachmentUploadUrlSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid attachment upload request" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const result = await generateAttachmentUploadUrlServer({
      currentUserId: ensuredUser.userId,
      ...parsed.data,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare attachment upload",
      },
      { status: 500 }
    )
  }
}
