import { NextRequest } from "next/server"

import { teamChatSchema } from "@/lib/domain/types"
import { ensureTeamChatServer } from "@/lib/server/convex"
import { handleConversationCreationRoute } from "@/lib/server/conversation-route-handlers"

export async function POST(request: NextRequest) {
  return handleConversationCreationRoute(request, {
    schema: teamChatSchema,
    invalidMessage: "Invalid team chat payload",
    failureLogLabel: "Failed to create team chat",
    failureMessage: "Failed to create team chat",
    failureCode: "TEAM_CHAT_CREATE_FAILED",
    create: ensureTeamChatServer,
  })
}
