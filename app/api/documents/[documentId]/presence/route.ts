import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
  clearDocumentPresenceServer,
  heartbeatDocumentPresenceServer,
} from "@/lib/server/convex"
import { requireConvexUser, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { isRouteResponse, jsonOk } from "@/lib/server/route-response"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

const documentPresenceSchema = z.object({
  action: z.enum(["heartbeat", "leave"]),
  sessionId: z.string().trim().min(8).max(128),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const { documentId } = await params
  const parsed = await parseJsonBody(
    request,
    documentPresenceSchema,
    "Invalid document presence payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const authenticatedUser = toAuthenticatedAppUser(
      session.user,
      session.organizationId
    )
    const authContext = await requireConvexUser(session)

    if (isRouteResponse(authContext)) {
      return authContext
    }

    if (parsed.action === "leave") {
      await clearDocumentPresenceServer({
        currentUserId: authContext.currentUser.id,
        documentId,
        workosUserId: authenticatedUser.workosUserId,
        sessionId: parsed.sessionId,
      })

      return jsonOk({
        ok: true,
      })
    }

    const viewers = await heartbeatDocumentPresenceServer({
      currentUserId: authContext.currentUser.id,
      documentId,
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
      name: authenticatedUser.name,
      avatarUrl: authenticatedUser.avatarUrl,
      sessionId: parsed.sessionId,
    })

    return jsonOk({
      viewers,
    })
  } catch (error) {
    logProviderError("Failed to update document presence", error)
    return NextResponse.json(
      {
        error: getConvexErrorMessage(
          error,
          "Failed to update document presence"
        ),
      },
      { status: 500 }
    )
  }
}
