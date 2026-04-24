import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { workspaceBrandingSchema } from "@/lib/domain/types"
import { reconcileProviderMembershipCleanup } from "@/lib/server/lifecycle"
import {
  deleteWorkspaceServer,
  setWorkspaceWorkosOrganizationServer,
  updateWorkspaceBrandingServer,
} from "@/lib/server/convex"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"
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

    if (!authContext.isWorkspaceOwner) {
      return jsonError(
        "Only the workspace owner can update workspace details",
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
    await bumpWorkspaceMembershipReadModelScopesServer(
      authContext.currentWorkspace.id
    )

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
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update workspace", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update workspace"),
      500,
      {
        code: "WORKSPACE_UPDATE_FAILED",
      }
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

    if (!authContext.isWorkspaceOwner) {
      return jsonError("Only the workspace owner can delete the workspace", 403)
    }

    const result = await deleteWorkspaceServer({
      currentUserId: authContext.currentUser.id,
      workspaceId: authContext.currentWorkspace.id,
    })

    await reconcileProviderMembershipCleanup({
      label: "Failed to deactivate WorkOS membership after workspace deletion",
      memberships: result?.providerMemberships ?? [],
    })
    await bumpWorkspaceMembershipReadModelScopesServer(
      authContext.currentWorkspace.id
    )

    return jsonOk({
      ok: true,
      workspaceId: result?.workspaceId ?? authContext.currentWorkspace.id,
      deletedTeamIds: result?.deletedTeamIds ?? [],
      deletedUserIds: result?.deletedUserIds ?? [],
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete workspace", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete workspace"),
      500,
      {
        code: "WORKSPACE_DELETE_FAILED",
      }
    )
  }
}
