import { NextRequest } from "next/server"

import { teamDetailsUpdateSchema } from "@/lib/domain/types"
import { deleteTeamServer, updateTeamDetailsServer } from "@/lib/server/convex"
import {
  handleAppContextJsonRoute,
  handleAppContextRoute,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  return handleAppContextJsonRoute(request, {
    schema: teamDetailsUpdateSchema,
    invalidMessage: "Invalid team details payload",
    failureLogLabel: "Failed to update team details",
    failureMessage: "Failed to update team details",
    failureCode: "TEAM_UPDATE_FAILED",
    async handle({ appContext, parsed }) {
      const { teamId } = await params
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
    },
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  return handleAppContextRoute({
    failureLogLabel: "Failed to delete team",
    failureMessage: "Failed to delete team",
    failureCode: "TEAM_DELETE_FAILED",
    async handle({ appContext }) {
      const { teamId } = await params
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
    },
  })
}
