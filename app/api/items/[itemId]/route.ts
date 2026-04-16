import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  deleteWorkItemServer,
  markNotificationsEmailedServer,
  updateWorkItemServer,
} from "@/lib/server/convex"
import { sendAssignmentEmails } from "@/lib/server/email"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

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
    labelIds: z.array(z.string().min(1)).optional(),
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
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const { itemId } = await params
  const parsed = await parseJsonBody(
    request,
    workItemPatchSchema,
    "Invalid work item update payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await updateWorkItemServer({
      currentUserId: appContext.ensuredUser.userId,
      itemId,
      patch: parsed,
    })
    const emailedNotificationIds = await sendAssignmentEmails({
      origin: new URL(request.url).origin,
      emails: result?.assignmentEmails ?? [],
    })

    if (emailedNotificationIds.length > 0) {
      await markNotificationsEmailedServer(emailedNotificationIds)
    }

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update work item", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update work item"),
      500,
      {
        code: "WORK_ITEM_UPDATE_FAILED",
      }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { itemId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await deleteWorkItemServer({
      currentUserId: appContext.ensuredUser.userId,
      itemId,
    })

    return jsonOk({
      ok: true,
      deletedItemIds: result?.deletedItemIds ?? [],
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete work item", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete work item"),
      500,
      {
        code: "WORK_ITEM_DELETE_FAILED",
      }
    )
  }
}
