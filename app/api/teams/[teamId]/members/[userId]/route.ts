import { NextRequest } from "next/server"

import { teamMembershipRoleSchema } from "@/lib/domain/types"
import {
  removeTeamMemberServer,
  updateTeamMemberRoleServer,
} from "@/lib/server/convex"
import { sendAccessChangeEmails } from "@/lib/server/email"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ teamId: string; userId: string }>
  }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    teamMembershipRoleSchema,
    "Invalid team member role payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const { teamId, userId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await updateTeamMemberRoleServer({
      currentUserId: appContext.ensuredUser.userId,
      teamId,
      userId,
      role: parsed.role,
    })

    return jsonOk({
      ok: true,
      teamId,
      userId,
      role: parsed.role,
    })
  } catch (error) {
    logProviderError("Failed to update team member role", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to update team member role"),
      500
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ teamId: string; userId: string }>
  }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { teamId, userId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await removeTeamMemberServer({
      currentUserId: appContext.ensuredUser.userId,
      teamId,
      userId,
    })

    if (result?.emailJobs?.length) {
      try {
        await sendAccessChangeEmails({
          emails: result.emailJobs,
        })
      } catch (emailError) {
        logProviderError("Failed to send team removal email", emailError)
      }
    }

    return jsonOk({
      ok: true,
      teamId: result?.teamId ?? teamId,
      userId: result?.userId ?? userId,
    })
  } catch (error) {
    logProviderError("Failed to remove team member", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to remove team member"),
      500
    )
  }
}
