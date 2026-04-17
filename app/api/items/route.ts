import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { workItemSchema } from "@/lib/domain/types"
import { createWorkItemServer, enqueueEmailJobsServer } from "@/lib/server/convex"
import { buildAssignmentEmailJobs } from "@/lib/server/email"
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

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    workItemSchema,
    "Invalid work item payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await createWorkItemServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed,
    })

    try {
      await enqueueEmailJobsServer(
        buildAssignmentEmailJobs({
          origin: new URL(request.url).origin,
          emails: result?.assignmentEmails ?? [],
        })
      )
    } catch (emailError) {
      logProviderError("Failed to enqueue assignment emails", emailError)
    }

    return jsonOk({
      ok: true,
      itemId: result?.itemId ?? null,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to create work item", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create work item"),
      500,
      {
        code: "WORK_ITEM_CREATE_FAILED",
      }
    )
  }
}
