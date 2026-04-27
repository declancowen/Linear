import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { inviteSchema } from "@/lib/domain/types"
import { createInviteServer } from "@/lib/server/convex"
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

    const createdInvites = await createInviteServer({
      currentUserId: appContext.ensuredUser.userId,
      teamIds: parsed.teamIds,
      email: parsed.email,
      role: parsed.role,
    })
    const workspaceId =
      createdInvites.workspaceId ??
      appContext.authContext?.currentWorkspace?.id ??
      null

    if (workspaceId) {
      await bumpWorkspaceMembershipReadModelScopesServer(workspaceId)
    }

    return jsonOk({
      ok: true,
      inviteIds: createdInvites.inviteIds,
      batchId: createdInvites.batchId,
      token: createdInvites.token,
      invites: createdInvites.invites,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to create invite", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create invite"),
      500,
      {
        code: "INVITE_CREATE_FAILED",
      }
    )
  }
}
