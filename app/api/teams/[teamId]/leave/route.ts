import { NextRequest } from "next/server"

import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { leaveTeamServer } from "@/lib/server/convex"
import { reconcileProviderMembershipCleanup } from "@/lib/server/lifecycle"
import { handleAppContextRoute } from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  return handleAppContextRoute({
    failureLogLabel: "Failed to leave team",
    failureMessage: "Failed to leave team",
    failureCode: "TEAM_LEAVE_FAILED",
    async handle({ session, appContext }) {
      const { teamId } = await params
      const fallbackWorkspaceId =
        appContext.authContext?.currentWorkspace?.id ?? null
      const result = await leaveTeamServer({
        currentUserId: appContext.ensuredUser.userId,
        teamId,
      })

      await reconcileProviderMembershipCleanup({
        label: "Failed to deactivate WorkOS membership after team leave",
        memberships: result?.providerMemberships ?? [],
      })

      await reconcileAuthenticatedAppContext(
        session.user,
        session.organizationId
      )
      const workspaceId = result?.workspaceId ?? fallbackWorkspaceId
      if (workspaceId) {
        await bumpWorkspaceMembershipReadModelScopesServer(workspaceId)
      }

      return jsonOk({
        ok: true,
        teamId: result?.teamId ?? teamId,
        workspaceId: result?.workspaceId ?? null,
        workspaceAccessRemoved: result?.workspaceAccessRemoved === true,
      })
    },
  })
}
