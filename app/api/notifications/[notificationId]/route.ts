import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  archiveNotificationServer,
  deleteNotificationServer,
  ensureConvexUserReadyServer,
  markNotificationReadServer,
  toggleNotificationReadServer,
  unarchiveNotificationServer,
} from "@/lib/server/convex"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

const notificationMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("markRead"),
  }),
  z.object({
    action: z.literal("toggleRead"),
  }),
  z.object({
    action: z.literal("archive"),
  }),
  z.object({
    action: z.literal("unarchive"),
  }),
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = notificationMutationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid notification request" },
      { status: 400 }
    )
  }

  try {
    const { notificationId } = await params
    const authContext = await ensureConvexUserReadyServer(
      toAuthenticatedAppUser(
        session.user,
        session.organizationId
      )
    )

    if (!authContext?.currentUser) {
      return NextResponse.json({ error: "User context not found" }, { status: 404 })
    }

    const currentUserId = authContext.currentUser.id

    if (parsed.data.action === "markRead") {
      await markNotificationReadServer({
        currentUserId,
        notificationId,
      })
    } else if (parsed.data.action === "toggleRead") {
      await toggleNotificationReadServer({
        currentUserId,
        notificationId,
      })
    } else if (parsed.data.action === "archive") {
      await archiveNotificationServer({
        currentUserId,
        notificationId,
      })
    } else {
      await unarchiveNotificationServer({
        currentUserId,
        notificationId,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update notification",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { notificationId } = await params
    const authContext = await ensureConvexUserReadyServer(
      toAuthenticatedAppUser(
        session.user,
        session.organizationId
      )
    )

    if (!authContext?.currentUser) {
      return NextResponse.json({ error: "User context not found" }, { status: 404 })
    }

    await deleteNotificationServer({
      currentUserId: authContext.currentUser.id,
      notificationId,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete notification",
      },
      { status: 500 }
    )
  }
}
