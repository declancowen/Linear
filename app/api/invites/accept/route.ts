import { NextRequest } from "next/server"

import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  acceptInviteServer,
  getInviteByTokenServer,
} from "@/lib/server/convex"
import {
  handleAuthenticatedJsonRoute,
  inviteTokenPayloadSchema,
} from "@/lib/server/route-handlers"
import { requireAppContext } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"

export async function POST(request: NextRequest) {
  return handleAuthenticatedJsonRoute(request, {
    schema: inviteTokenPayloadSchema,
    invalidMessage: "Invalid invite token",
    failureLogLabel: "Failed to accept invite",
    failureMessage: "Failed to accept invite",
    failureCode: "INVITE_ACCEPT_FAILED",
    async handle({ session, parsed }) {
      const invite = await getInviteByTokenServer(parsed.token)

      if (!invite) {
        return jsonError("Invite not found", 404)
      }

      if (
        invite.invite.email.toLowerCase() !== session.user.email.toLowerCase()
      ) {
        return jsonError("This invite belongs to a different email address", 403)
      }

      if (new Date(invite.invite.expiresAt).getTime() < Date.now()) {
        return jsonError("Invite has expired", 410)
      }

      const appContext = await requireAppContext(session)

      if (isRouteResponse(appContext)) {
        return appContext
      }

      const accepted = await acceptInviteServer({
        currentUserId: appContext.ensuredUser.userId,
        token: parsed.token,
      })
      await reconcileAuthenticatedAppContext(
        session.user,
        session.organizationId
      )
      if (invite.workspace?.id) {
        await bumpWorkspaceMembershipReadModelScopesServer(invite.workspace.id)
      }

      return jsonOk({
        ok: true,
        teamSlug: accepted.teamSlug,
      })
    },
  })
}
