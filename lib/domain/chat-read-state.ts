import type { AppData, ChatReadState } from "@/lib/domain/types"

export function createChatReadStateId(userId: string, conversationId: string) {
  return `chat_read_state_${userId}_${conversationId}`
}

export function getChatReadState(
  data: Pick<AppData, "chatReadStates">,
  userId: string,
  conversationId: string
) {
  return (
    data.chatReadStates.find(
      (state) =>
        state.userId === userId && state.conversationId === conversationId
    ) ?? null
  )
}

export function mergeChatMessageFirstReadTimestamps(
  existing: Record<string, string> | null | undefined,
  messageIds: readonly string[] | null | undefined,
  readAt: string
) {
  const next = { ...(existing ?? {}) }

  for (const messageId of messageIds ?? []) {
    if (!messageId || next[messageId]) {
      continue
    }

    next[messageId] = readAt
  }

  return next
}

export function hasUnreadLegacyChatMessageNotification(
  data: Pick<AppData, "notifications">,
  userId: string,
  conversationId: string
) {
  return data.notifications.some(
    (notification) =>
      notification.userId === userId &&
      notification.entityType === "chat" &&
      notification.entityId === conversationId &&
      notification.type === "message" &&
      notification.readAt == null &&
      notification.archivedAt == null
  )
}

export function isChatReadStateUnread(
  state: Pick<ChatReadState, "unreadAt"> | null | undefined
) {
  return state?.unreadAt != null
}

export function isChatConversationUnread(
  data: Pick<AppData, "chatReadStates" | "notifications">,
  userId: string,
  conversationId: string
) {
  return (
    isChatReadStateUnread(getChatReadState(data, userId, conversationId)) ||
    hasUnreadLegacyChatMessageNotification(data, userId, conversationId)
  )
}

export function getUnreadWorkspaceChatCount(
  data: Pick<
    AppData,
    "chatReadStates" | "conversations" | "currentUserId" | "notifications"
  >,
  workspaceId: string
) {
  return data.conversations.filter(
    (conversation) =>
      conversation.kind === "chat" &&
      conversation.scopeType === "workspace" &&
      conversation.scopeId === workspaceId &&
      conversation.participantIds.includes(data.currentUserId) &&
      isChatConversationUnread(data, data.currentUserId, conversation.id)
  ).length
}

export function isTeamChatUnread(
  data: Pick<
    AppData,
    "chatReadStates" | "conversations" | "currentUserId" | "notifications"
  >,
  teamId: string
) {
  const conversation = data.conversations.find(
    (entry) =>
      entry.kind === "chat" &&
      entry.scopeType === "team" &&
      entry.scopeId === teamId &&
      entry.variant === "team"
  )

  return conversation
    ? isChatConversationUnread(data, data.currentUserId, conversation.id)
    : false
}
