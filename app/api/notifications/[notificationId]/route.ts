import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  archiveNotificationServer,
  markNotificationReadServer,
  toggleNotificationReadServer,
  unarchiveNotificationServer,
} from "@/lib/server/convex"

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
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    if (parsed.data.action === "markRead") {
      await markNotificationReadServer({
        currentUserId: ensuredUser.userId,
        notificationId,
      })
    } else if (parsed.data.action === "toggleRead") {
      await toggleNotificationReadServer({
        currentUserId: ensuredUser.userId,
        notificationId,
      })
    } else if (parsed.data.action === "archive") {
      await archiveNotificationServer({
        currentUserId: ensuredUser.userId,
        notificationId,
      })
    } else {
      await unarchiveNotificationServer({
        currentUserId: ensuredUser.userId,
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
