import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { workItemSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  createWorkItemServer,
  markNotificationsEmailedServer,
} from "@/lib/server/convex"
import { sendAssignmentEmails } from "@/lib/server/email"

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = workItemSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid work item payload" }, { status: 400 })
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const result = await createWorkItemServer({
      currentUserId: ensuredUser.userId,
      ...parsed.data,
    })
    const emailedNotificationIds = await sendAssignmentEmails({
      origin: new URL(request.url).origin,
      emails: result?.assignmentEmails ?? [],
    })

    if (emailedNotificationIds.length > 0) {
      await markNotificationsEmailedServer(emailedNotificationIds)
    }

    return NextResponse.json({
      ok: true,
      itemId: result?.itemId ?? null,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create work item",
      },
      { status: 500 }
    )
  }
}
