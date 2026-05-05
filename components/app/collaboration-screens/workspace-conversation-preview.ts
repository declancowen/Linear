import type { AppData, Conversation } from "@/lib/domain/types"
import { getPlainTextContent } from "@/lib/utils"
import { parseCallInviteMessage } from "@/components/app/collaboration-screens/utils"

type ChatMessage = AppData["chatMessages"][number]

export function getLatestMessagesByConversationId(
  chats: Conversation[],
  chatMessages: ChatMessage[]
) {
  const conversationIds = new Set(chats.map((chat) => chat.id))
  const latestByConversationId = new Map<string, ChatMessage>()

  for (const message of chatMessages) {
    if (!conversationIds.has(message.conversationId)) {
      continue
    }

    const previous = latestByConversationId.get(message.conversationId)

    if (!previous || previous.createdAt < message.createdAt) {
      latestByConversationId.set(message.conversationId, message)
    }
  }

  return latestByConversationId
}

export function getConversationPreview(
  latest: ChatMessage | undefined
) {
  if (!latest) {
    return "Open the conversation"
  }

  if (latest.kind === "call" || latest.callId) {
    return "Started a call"
  }

  const callInvite = parseCallInviteMessage(latest.content)
  return callInvite?.title ?? getPlainTextContent(latest.content)
}
