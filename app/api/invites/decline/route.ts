import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import { declineInviteServer, getInviteByTokenServer } from "@/lib/server/convex"
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

const declineInviteSchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    declineInviteSchema,
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

    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await declineInviteServer({
      currentUserId: appContext.ensuredUser.userId,
      token: parsed.token,
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to decline invite", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to decline invite"),
      500,
      {
        code: "INVITE_DECLINE_FAILED",
      }
    )
  }
}
