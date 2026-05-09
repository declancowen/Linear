import { z } from "zod"

import { getWorkspaceMembershipBootstrapServer } from "@/lib/server/convex"
import {
  getSelectedWorkspaceCookieOptions,
  SELECTED_WORKSPACE_COOKIE,
} from "@/lib/server/workspace-selection"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

const workspaceSelectionSchema = z.object({
  workspaceId: z.string().trim().min(1),
})

export async function POST(request: Request) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    workspaceSelectionSchema,
    "Invalid workspace selection payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const data = await getWorkspaceMembershipBootstrapServer({
      workosUserId: session.user.id,
      email: session.user.email ?? undefined,
      workspaceId: parsed.workspaceId,
    })

    if (data.currentWorkspaceId !== parsed.workspaceId) {
      return jsonError("Workspace not found", 404, {
        code: "WORKSPACE_SELECTION_NOT_FOUND",
      })
    }

    const response = jsonOk({ data })
    response.cookies.set(
      SELECTED_WORKSPACE_COOKIE,
      parsed.workspaceId,
      getSelectedWorkspaceCookieOptions()
    )

    return response
  } catch (error) {
    logProviderError("Failed to select workspace", error)

    return jsonError(
      getConvexErrorMessage(error, "Failed to select workspace"),
      500,
      {
        code: "WORKSPACE_SELECTION_FAILED",
      }
    )
  }
}
