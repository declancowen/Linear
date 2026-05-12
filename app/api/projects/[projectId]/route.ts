import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import { bumpScopedReadModelVersionsServer } from "@/lib/server/convex"
import { resolveProjectReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
import {
  nullableCalendarDateSchema,
  projectNameMaxLength,
  projectNameMinLength,
} from "@/lib/domain/types"
import { projectSummaryConstraints } from "@/lib/domain/input-constraints"
import { deleteProjectServer, updateProjectServer } from "@/lib/server/convex"
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

const projectPatchSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(projectNameMinLength)
      .max(projectNameMaxLength)
      .optional(),
    icon: z.string().trim().min(1).max(80).optional(),
    summary: z.string().trim().max(projectSummaryConstraints.max).optional(),
    status: z
      .enum(["backlog", "planned", "in-progress", "completed", "cancelled"])
      .optional(),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
    leadId: z.string().nullable().optional(),
    memberIds: z.array(z.string()).optional(),
    startDate: nullableCalendarDateSchema.optional(),
    targetDate: nullableCalendarDateSchema.optional(),
    labelIds: z.array(z.string()).optional(),
  })
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    {
      message: "At least one project field is required",
    }
  )

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const { projectId } = await params
  const parsed = await parseJsonBody(
    request,
    projectPatchSchema,
    "Invalid project update payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const scopeKeys = await resolveProjectReadModelScopeKeysServer(
      session,
      projectId
    )

    await updateProjectServer({
      currentUserId: appContext.ensuredUser.userId,
      projectId,
      patch: parsed,
    })
    await bumpScopedReadModelVersionsServer({
      scopeKeys,
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update project", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update project"),
      500,
      {
        code: "PROJECT_UPDATE_FAILED",
      }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { projectId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const scopeKeys = await resolveProjectReadModelScopeKeysServer(
      session,
      projectId
    )

    await deleteProjectServer({
      currentUserId: appContext.ensuredUser.userId,
      projectId,
    })
    await bumpScopedReadModelVersionsServer({
      scopeKeys,
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete project", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete project"),
      500,
      {
        code: "PROJECT_DELETE_FAILED",
      }
    )
  }
}
