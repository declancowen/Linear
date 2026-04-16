import { NextRequest, NextResponse } from "next/server"

import { workspaceBrandingSchema } from "@/lib/domain/types"
import {
  deleteWorkspaceServer,
  setWorkspaceWorkosOrganizationServer,
  updateWorkspaceBrandingServer,
} from "@/lib/server/convex"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { ensureWorkspaceOrganization } from "@/lib/server/workos"

export async function PATCH(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    workspaceBrandingSchema,
    "Invalid workspace details payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const { authContext } = appContext

    if (!authContext?.currentWorkspace) {
      return jsonError("Workspace not found", 404)
    }

    if (!authContext.isWorkspaceAdmin) {
      return jsonError(
        "Only workspace admins can update workspace details",
        403
      )
    }

    await updateWorkspaceBrandingServer({
      currentUserId: authContext.currentUser.id,
      workspaceId: authContext.currentWorkspace.id,
      ...parsed,
    })

    const organization = await ensureWorkspaceOrganization({
      workspaceId: authContext.currentWorkspace.id,
      slug: authContext.currentWorkspace.slug,
      name: parsed.name,
      existingOrganizationId: authContext.currentWorkspace.workosOrganizationId,
    })

    await setWorkspaceWorkosOrganizationServer({
      workspaceId: authContext.currentWorkspace.id,
      workosOrganizationId: organization.id,
    })

    return jsonOk({
      ok: true,
      workspace: {
        ...authContext.currentWorkspace,
        name: parsed.name,
        logoUrl: parsed.logoUrl,
        settings: {
          accent: parsed.accent,
          description: parsed.description,
        },
        workosOrganizationId: organization.id,
      },
    })
  } catch (error) {
    logProviderError("Failed to update workspace", error)
    return NextResponse.json(
      {
        error: getConvexErrorMessage(error, "Failed to update workspace"),
      },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const { authContext } = appContext

    if (!authContext?.currentWorkspace || !authContext.currentUser) {
      return jsonError("Workspace not found", 404)
    }

    const result = await deleteWorkspaceServer({
      currentUserId: authContext.currentUser.id,
      workspaceId: authContext.currentWorkspace.id,
    })

    return jsonOk({
      ok: true,
      workspaceId: result?.workspaceId ?? authContext.currentWorkspace.id,
      deletedTeamIds: result?.deletedTeamIds ?? [],
      deletedUserIds: result?.deletedUserIds ?? [],
    })
  } catch (error) {
    logProviderError("Failed to delete workspace", error)
    return NextResponse.json(
      {
        error: getConvexErrorMessage(error, "Failed to delete workspace"),
      },
      { status: 500 }
    )
  }
}
