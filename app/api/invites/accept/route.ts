import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  acceptInviteServer,
  getInviteByTokenServer,
} from "@/lib/server/convex"
import { bumpWorkspaceMembershipReadModelScopesServer } from "@/lib/server/scoped-read-models"
import {
  reconcileAuthenticatedAppContext,
} from "@/lib/server/authenticated-app"
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

const acceptInviteSchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    acceptInviteSchema,
    "Invalid invite token"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const invite = await getInviteByTokenServer(parsed.token)

    if (!invite) {
      return jsonError("Invite not found", 404)
    }

    if (invite.invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
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
    await reconcileAuthenticatedAppContext(session.user, session.organizationId)
    if (invite.workspace?.id) {
      await bumpWorkspaceMembershipReadModelScopesServer(invite.workspace.id)
    }

    return jsonOk({
      ok: true,
      teamSlug: accepted.teamSlug,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to accept invite", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to accept invite"),
      500,
      {
        code: "INVITE_ACCEPT_FAILED",
      }
    )
  }
}
