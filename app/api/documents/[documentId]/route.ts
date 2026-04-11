import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  renameDocumentServer,
  updateDocumentContentServer,
} from "@/lib/server/convex"

const documentUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(80).optional(),
    content: z.string().trim().min(1).optional(),
  })
  .refine((value) => value.title !== undefined || value.content !== undefined, {
    message: "At least one document field is required",
  })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { documentId } = await params
  const body = await request.json()
  const parsed = documentUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document update payload" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    if (parsed.data.title !== undefined) {
      await renameDocumentServer({
        currentUserId: ensuredUser.userId,
        documentId,
        title: parsed.data.title,
      })
    }

    if (parsed.data.content !== undefined) {
      await updateDocumentContentServer({
        currentUserId: ensuredUser.userId,
        documentId,
        content: parsed.data.content,
      })
    }

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update document",
      },
      { status: 500 }
    )
  }
}
