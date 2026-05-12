import { NextRequest } from "next/server"

import { teamWorkflowSettingsSchema } from "@/lib/domain/types"
import { updateTeamWorkflowSettingsServer } from "@/lib/server/convex"
import { handleAppContextJsonRoute } from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  return handleAppContextJsonRoute(request, {
    schema: teamWorkflowSettingsSchema,
    invalidMessage: "Invalid team workflow payload",
    failureLogLabel: "Failed to update team workflow settings",
    failureMessage: "Failed to update team workflow settings",
    failureCode: "TEAM_WORKFLOW_UPDATE_FAILED",
    async handle({ appContext, parsed }) {
      const { teamId } = await params
      const workspaceId = appContext.authContext?.currentWorkspace?.id ?? null
      const result = await updateTeamWorkflowSettingsServer({
        currentUserId: appContext.ensuredUser.userId,
        teamId,
        workflow: parsed,
      })
      const invalidationWorkspaceId = result?.workspaceId ?? workspaceId

      if (invalidationWorkspaceId) {
        await bumpWorkspaceMembershipReadModelScopesServer(
          invalidationWorkspaceId
        )
      }

      return jsonOk({ ok: true })
    },
  })
}
