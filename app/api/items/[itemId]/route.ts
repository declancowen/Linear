import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  deleteWorkItemServer,
  markNotificationsEmailedServer,
  updateWorkItemServer,
} from "@/lib/server/convex"
import { sendAssignmentEmails } from "@/lib/server/email"

const workItemPatchSchema = z
  .object({
    status: z
      .enum([
        "backlog",
        "todo",
        "in-progress",
        "done",
        "cancelled",
        "duplicate",
      ])
      .optional(),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
    assigneeId: z.string().nullable().optional(),
    parentId: z.string().nullable().optional(),
    primaryProjectId: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    targetDate: z.string().nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    {
      message: "At least one work item field is required",
    }
  )

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
  const parsed = workItemPatchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid work item update payload" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const result = await updateWorkItemServer({
      currentUserId: ensuredUser.userId,
      itemId,
      patch: parsed.data,
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
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update work item",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { itemId } = await params
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )
    const result = await deleteWorkItemServer({
      currentUserId: ensuredUser.userId,
      itemId,
    })

    return NextResponse.json({
      ok: true,
      deletedItemIds: result?.deletedItemIds ?? [],
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete work item",
      },
      { status: 500 }
    )
  }
}
