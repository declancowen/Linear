import { NextRequest } from "next/server"

import { sendDocumentMentionNotificationsServer } from "@/lib/server/convex"
import {
  handleAppContextJsonRoute,
  mentionNotificationsPayloadSchema,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return handleAppContextJsonRoute(request, {
    schema: mentionNotificationsPayloadSchema,
    invalidMessage: "Invalid document mention notification payload",
    failureLogLabel: "Failed to send document mention notifications",
    failureMessage: "Failed to send document mention notifications",
    failureCode: "DOCUMENT_MENTION_NOTIFICATIONS_FAILED",
    async handle({ appContext, parsed }) {
      const result = await sendDocumentMentionNotificationsServer({
        currentUserId: appContext.ensuredUser.userId,
        documentId,
        mentions: parsed.mentions,
      })

      return jsonOk({
        ok: true,
        ...result,
      })
    },
  })
}
