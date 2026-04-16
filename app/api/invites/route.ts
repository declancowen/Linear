import { NextRequest } from "next/server"

import { inviteSchema } from "@/lib/domain/types"
import { createInviteServer } from "@/lib/server/convex"
import { sendTeamInviteEmails } from "@/lib/server/email"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    inviteSchema,
    "Invalid invite payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const createdInvites = await Promise.all(
      parsed.teamIds.map((teamId) =>
        createInviteServer({
          currentUserId: appContext.ensuredUser.userId,
          teamId,
          email: parsed.email,
          role: parsed.role,
        })
      )
    )

    if (createdInvites.some((entry) => !entry)) {
      return jsonError("Failed to persist invite", 500)
    }

    await sendTeamInviteEmails({
      invites: createdInvites.flatMap((created) =>
        created
          ? [
              {
                email: parsed.email,
                workspaceName: created.workspaceName,
                teamName: created.teamName,
                role: created.invite.role,
                inviteToken: created.invite.token,
                joinCode: created.invite.joinCode,
              },
            ]
          : []
      ),
    })

    return jsonOk({
      ok: true,
      inviteIds: createdInvites.flatMap((entry) =>
        entry ? [entry.invite.id] : []
      ),
    })
  } catch (error) {
    logProviderError("Failed to create invite", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create invite"),
      500
    )
  }
}
