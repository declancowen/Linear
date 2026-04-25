import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { teamDetailsUpdateSchema } from "@/lib/domain/types"
import { deleteTeamServer, updateTeamDetailsServer } from "@/lib/server/convex"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    teamDetailsUpdateSchema,
    "Invalid team details payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const { teamId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const workspaceId = appContext.authContext?.currentWorkspace?.id ?? null

    const result = await updateTeamDetailsServer({
      currentUserId: appContext.ensuredUser.userId,
      teamId,
      ...parsed,
    })
    const invalidationWorkspaceId = result?.workspaceId ?? workspaceId

    if (invalidationWorkspaceId) {
      await bumpWorkspaceMembershipReadModelScopesServer(
        invalidationWorkspaceId
      )
    }

    return jsonOk({
      ok: true,
      teamId,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update team details", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update team details"),
      500,
      {
        code: "TEAM_UPDATE_FAILED",
      }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { teamId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const workspaceId = appContext.authContext?.currentWorkspace?.id ?? null

    const result = await deleteTeamServer({
      currentUserId: appContext.ensuredUser.userId,
      teamId,
    })
    const invalidationWorkspaceId = result?.workspaceId ?? workspaceId

    if (invalidationWorkspaceId) {
      await bumpWorkspaceMembershipReadModelScopesServer(
        invalidationWorkspaceId
      )
    }

    return jsonOk({
      ok: true,
      teamId: result?.teamId ?? teamId,
      workspaceId: result?.workspaceId ?? null,
      deletedUserIds: result?.deletedUserIds ?? [],
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete team", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete team"),
      500,
      {
        code: "TEAM_DELETE_FAILED",
      }
    )
  }
}
