import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  deleteProjectServer,
  updateProjectServer,
} from "@/lib/server/convex"
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
    name: z.string().trim().min(1).optional(),
    status: z
      .enum(["backlog", "planned", "in-progress", "completed", "cancelled"])
      .or(z.literal("planning"))
      .optional(),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
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

    await updateProjectServer({
      currentUserId: appContext.ensuredUser.userId,
      projectId,
      patch: parsed,
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

    await deleteProjectServer({
      currentUserId: appContext.ensuredUser.userId,
      projectId,
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
