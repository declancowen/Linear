import { NextRequest } from "next/server"

import { channelSchema } from "@/lib/domain/types"
import { createChannelServer } from "@/lib/server/convex"
import { handleConversationCreationRoute } from "@/lib/server/conversation-route-handlers"

export async function POST(request: NextRequest) {
  return handleConversationCreationRoute(request, {
    schema: channelSchema,
    invalidMessage: "Invalid channel payload",
    failureLogLabel: "Failed to create channel",
    failureMessage: "Failed to create channel",
    failureCode: "CHANNEL_CREATE_FAILED",
    create: createChannelServer,
  })
}
