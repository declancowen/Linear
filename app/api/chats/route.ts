import { NextRequest } from "next/server"

import { workspaceChatSchema } from "@/lib/domain/types"
import { createWorkspaceChatServer } from "@/lib/server/convex"
import { handleConversationCreationRoute } from "@/lib/server/conversation-route-handlers"

export async function POST(request: NextRequest) {
  return handleConversationCreationRoute(request, {
    schema: workspaceChatSchema,
    invalidMessage: "Invalid chat payload",
    failureLogLabel: "Failed to create chat",
    failureMessage: "Failed to create chat",
    failureCode: "CHAT_CREATE_FAILED",
    create: createWorkspaceChatServer,
  })
}
