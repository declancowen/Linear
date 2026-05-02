import { NextRequest } from "next/server"

import { sendItemDescriptionMentionNotificationsServer } from "@/lib/server/convex"
import {
  handleAppContextJsonRoute,
  mentionNotificationsPayloadSchema,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params

  return handleAppContextJsonRoute(request, {
    schema: mentionNotificationsPayloadSchema,
    invalidMessage: "Invalid item description mention notification payload",
    failureLogLabel: "Failed to send item description mention notifications",
    failureMessage: "Failed to send item description mention notifications",
    failureCode: "ITEM_DESCRIPTION_MENTION_NOTIFICATIONS_FAILED",
    async handle({ appContext, parsed }) {
      const result = await sendItemDescriptionMentionNotificationsServer({
        currentUserId: appContext.ensuredUser.userId,
        itemId,
        mentions: parsed.mentions,
      })

      return jsonOk({
        ok: true,
        ...result,
      })
    },
  })
}
