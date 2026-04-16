import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  archiveNotificationServer,
  ensureConvexUserReadyServer,
  unarchiveNotificationServer,
} from "@/lib/server/convex"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

const notificationsMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("archive"),
    notificationIds: z.array(z.string()),
  }),
  z.object({
    action: z.literal("unarchive"),
    notificationIds: z.array(z.string()),
  }),
])

export async function PATCH(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = notificationsMutationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid notification request" },
      { status: 400 }
    )
  }

  try {
    const authContext = await ensureConvexUserReadyServer(
      toAuthenticatedAppUser(session.user, session.organizationId)
    )

    if (!authContext?.currentUser) {
      return NextResponse.json({ error: "User context not found" }, { status: 404 })
    }

    const currentUserId = authContext.currentUser.id

    for (const notificationId of parsed.data.notificationIds) {
      if (parsed.data.action === "archive") {
        await archiveNotificationServer({
          currentUserId,
          notificationId,
        })
        continue
      }

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
            : "Failed to update notifications",
      },
      { status: 500 }
    )
  }
}
