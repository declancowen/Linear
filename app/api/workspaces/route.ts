import { NextRequest } from "next/server"

import { getDisplayInitials } from "@/lib/display-initials"
import { workspaceSetupSchema } from "@/lib/domain/types"
import { isApplicationError } from "@/lib/server/application-errors"
import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { createWorkspaceServer } from "@/lib/server/convex"
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
    workspaceSetupSchema,
    "Invalid workspace payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    if (
      appContext.authContext?.currentWorkspace ||
      appContext.authContext?.pendingWorkspace
    ) {
      return jsonError("You already have an active workspace", 400)
    }

    const name = parsed.name.trim()
    const result = await createWorkspaceServer({
      currentUserId: appContext.ensuredUser.userId,
      name,
      logoUrl: getDisplayInitials(name, "RR"),
      accent: "emerald",
      description: parsed.description?.trim() || `${name} workspace`,
    })

    try {
      await reconcileAuthenticatedAppContext(session.user, session.organizationId)
    } catch (error) {
      logProviderError(
        "Failed to reconcile app context after workspace creation",
        error
      )
    }

    return jsonOk({
      ok: true,
      workspaceId: result.workspaceId,
      workspaceSlug: result.workspaceSlug,
    })
  } catch (error) {
    if (isApplicationError(error)) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to create workspace", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create workspace"),
      500
    )
  }
}
