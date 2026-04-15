import { NextRequest } from "next/server"
import { z } from "zod"

import { updateProjectServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

const projectPatchSchema = z
  .object({
    status: z.enum(["planning", "active", "paused", "completed"]).optional(),
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
    logProviderError("Failed to update project", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update project"),
      500
    )
  }
}
