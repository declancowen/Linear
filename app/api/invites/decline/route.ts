import { NextRequest } from "next/server"

import { declineInviteServer } from "@/lib/server/convex"
import { requireSessionInviteByToken } from "@/lib/server/invite-routes"
import {
  handleAuthenticatedJsonRoute,
  inviteTokenPayloadSchema,
} from "@/lib/server/route-handlers"
import { requireAppContext } from "@/lib/server/route-auth"
import { isRouteResponse, jsonOk } from "@/lib/server/route-response"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"

export async function POST(request: NextRequest) {
  return handleAuthenticatedJsonRoute(request, {
    schema: inviteTokenPayloadSchema,
    invalidMessage: "Invalid invite token",
    failureLogLabel: "Failed to decline invite",
    failureMessage: "Failed to decline invite",
    failureCode: "INVITE_DECLINE_FAILED",
    async handle({ session, parsed }) {
      const invite = await requireSessionInviteByToken({
        session,
        token: parsed.token,
      })

      if (isRouteResponse(invite)) {
        return invite
      }

      const appContext = await requireAppContext(session)

      if (isRouteResponse(appContext)) {
        return appContext
      }

      await declineInviteServer({
        currentUserId: appContext.ensuredUser.userId,
        token: parsed.token,
      })
      if (invite.workspace?.id) {
        await bumpWorkspaceMembershipReadModelScopesServer(invite.workspace.id)
      }

      return jsonOk({
        ok: true,
      })
    },
  })
}
