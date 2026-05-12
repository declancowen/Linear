import { NextRequest } from "next/server"

import { teamMembershipRoleSchema } from "@/lib/domain/types"
import {
  removeTeamMemberServer,
  updateTeamMemberRoleServer,
} from "@/lib/server/convex"
import { reconcileProviderMembershipCleanup } from "@/lib/server/lifecycle"
import {
  handleAppContextJsonRoute,
  handleAppContextRoute,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ teamId: string; userId: string }>
  }
) {
  return handleAppContextJsonRoute(request, {
    schema: teamMembershipRoleSchema,
    invalidMessage: "Invalid team member role payload",
    failureLogLabel: "Failed to update team member role",
    failureMessage: "Failed to update team member role",
    failureCode: "TEAM_MEMBER_ROLE_UPDATE_FAILED",
    async handle({ appContext, parsed }) {
      const { teamId, userId } = await params
      const workspaceId = appContext.authContext?.currentWorkspace?.id ?? null
      const result = await updateTeamMemberRoleServer({
        currentUserId: appContext.ensuredUser.userId,
        teamId,
        userId,
        role: parsed.role,
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
        userId,
        role: parsed.role,
      })
    },
  })
}

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ teamId: string; userId: string }>
  }
) {
  return handleAppContextRoute({
    failureLogLabel: "Failed to remove team member",
    failureMessage: "Failed to remove team member",
    failureCode: "TEAM_MEMBER_REMOVE_FAILED",
    async handle({ appContext }) {
      const { teamId, userId } = await params
      const workspaceId = appContext.authContext?.currentWorkspace?.id ?? null
      const result = await removeTeamMemberServer({
        currentUserId: appContext.ensuredUser.userId,
        teamId,
        userId,
      })

      await reconcileProviderMembershipCleanup({
        label: "Failed to deactivate WorkOS membership after team removal",
        memberships: result?.providerMemberships ?? [],
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
        userId: result?.userId ?? userId,
      })
    },
  })
}
