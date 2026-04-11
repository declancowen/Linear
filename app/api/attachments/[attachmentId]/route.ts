import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { deleteAttachmentServer } from "@/lib/server/convex"

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      attachmentId: string
    }>
  }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { attachmentId } = await context.params
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    await deleteAttachmentServer({
      currentUserId: ensuredUser.userId,
      attachmentId,
    })

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete attachment",
      },
      { status: 500 }
    )
  }
}
