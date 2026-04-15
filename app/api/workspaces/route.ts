import { NextRequest } from "next/server"

import { workspaceSetupSchema } from "@/lib/domain/types"
import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { createWorkspaceServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

function getWorkspaceLogo(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "RR"
  )
}

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
      logoUrl: getWorkspaceLogo(name),
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
    logProviderError("Failed to create workspace", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create workspace"),
      500
    )
  }
}
