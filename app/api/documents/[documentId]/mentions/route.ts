import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import { sendDocumentMentionNotificationsServer } from "@/lib/server/convex"
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

const documentMentionNotificationsSchema = z.object({
  mentions: z.array(
    z.object({
      userId: z.string().trim().min(1),
      count: z.number().int().positive().max(1000),
    })
  ),
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
    documentMentionNotificationsSchema,
    "Invalid document mention notification payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await sendDocumentMentionNotificationsServer({
      currentUserId: appContext.ensuredUser.userId,
      documentId,
      mentions: parsed.mentions,
    })

    return jsonOk({
      ok: true,
      ...result,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to send document mention notifications", error)
    return jsonError(
      getConvexErrorMessage(
        error,
        "Failed to send document mention notifications"
      ),
      500,
      {
        code: "DOCUMENT_MENTION_NOTIFICATIONS_FAILED",
      }
    )
  }
}
