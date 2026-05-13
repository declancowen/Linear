import { z } from "zod"
import { NextRequest, NextResponse } from "next/server"

import { getWorkspaceMembershipBootstrapServer } from "@/lib/server/convex"
import {
  getSelectedWorkspaceCookieOptions,
  normalizeWorkspaceSelectionNextPath,
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

type AuthenticatedSession = Exclude<
  Awaited<ReturnType<typeof requireSession>>,
  Response
>

async function resolveWorkspaceSelection(
  session: AuthenticatedSession,
  workspaceId: string
) {
  const data = await getWorkspaceMembershipBootstrapServer({
    workosUserId: session.user.id,
    email: session.user.email ?? undefined,
    workspaceId,
  })

  if (data.currentWorkspaceId !== workspaceId) {
    return null
  }

  return data
}

function setSelectedWorkspaceCookie(
  response: NextResponse,
  workspaceId: string
) {
  response.cookies.set(
    SELECTED_WORKSPACE_COOKIE,
    workspaceId,
    getSelectedWorkspaceCookieOptions()
  )
}

export async function GET(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = workspaceSelectionSchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? "",
  })

  if (!parsed.success) {
    return jsonError("Invalid workspace selection payload", 400, {
      code: "WORKSPACE_SELECTION_INVALID",
    })
  }

  try {
    const data = await resolveWorkspaceSelection(
      session,
      parsed.data.workspaceId
    )

    if (!data) {
      return jsonError("Workspace not found", 404, {
        code: "WORKSPACE_SELECTION_NOT_FOUND",
      })
    }

    const nextPath = normalizeWorkspaceSelectionNextPath(
      request.nextUrl.searchParams.get("next")
    )
    const response = NextResponse.redirect(new URL(nextPath, request.nextUrl))
    setSelectedWorkspaceCookie(response, parsed.data.workspaceId)

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
    const data = await resolveWorkspaceSelection(session, parsed.workspaceId)

    if (!data) {
      return jsonError("Workspace not found", 404, {
        code: "WORKSPACE_SELECTION_NOT_FOUND",
      })
    }

    const response = jsonOk({ data })
    setSelectedWorkspaceCookie(response, parsed.workspaceId)

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
