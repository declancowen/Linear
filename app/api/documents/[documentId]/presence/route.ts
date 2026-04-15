import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  clearDocumentPresenceServer,
  ensureConvexUserReadyServer,
  heartbeatDocumentPresenceServer,
} from "@/lib/server/convex"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

const documentPresenceSchema = z.object({
  action: z.enum(["heartbeat", "leave"]),
  sessionId: z.string().trim().min(8).max(128),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { documentId } = await params
  const body = await request.json().catch(() => null)
  const parsed = documentPresenceSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document presence payload" },
      { status: 400 }
    )
  }

  try {
    const authenticatedUser = toAuthenticatedAppUser(
      session.user,
      session.organizationId
    )
    const authContext = await ensureConvexUserReadyServer(authenticatedUser)

    if (!authContext?.currentUser) {
      return NextResponse.json(
        { error: "User context not found" },
        { status: 404 }
      )
    }

    if (parsed.data.action === "leave") {
      await clearDocumentPresenceServer({
        currentUserId: authContext.currentUser.id,
        documentId,
        workosUserId: authenticatedUser.workosUserId,
        sessionId: parsed.data.sessionId,
      })

      return NextResponse.json({
        ok: true,
      })
    }

    const viewers = await heartbeatDocumentPresenceServer({
      currentUserId: authContext.currentUser.id,
      documentId,
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
      name: authenticatedUser.name,
      avatarUrl: authenticatedUser.avatarUrl,
      sessionId: parsed.data.sessionId,
    })

    return NextResponse.json({
      viewers,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update document presence",
      },
      { status: 500 }
    )
  }
}
