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

export function getUnreadChatMessageReceiptIds(
  existing: Record<string, string> | null | undefined,
  messageIds: readonly string[] | null | undefined
) {
  return [...new Set(messageIds ?? [])].filter(
    (messageId) => messageId && !existing?.[messageId]
  )
}

type ChatReadReceiptMessage = Pick<
  AppData["chatMessages"][number],
  "createdBy" | "deletedAt" | "id" | "conversationId"
>
type ChatReadReceiptConversation = Pick<
  AppData["conversations"][number],
  "kind" | "scopeType" | "variant"
>

export function supportsChatMessageReadReceipts(
  conversation: ChatReadReceiptConversation | null | undefined
) {
  return (
    conversation?.kind === "chat" &&
    conversation.scopeType === "workspace" &&
    (conversation.variant === "direct" || conversation.variant === "group")
  )
}

export function getReadableChatMessageReceiptIds(input: {
  conversationId: string
  currentUserId: string
  messages: ChatReadReceiptMessage[]
  messageIds: readonly string[] | null | undefined
}) {
  const requestedIds = new Set(input.messageIds ?? [])

  if (requestedIds.size === 0) {
    return []
  }

  return input.messages
    .filter(
      (message) =>
        requestedIds.has(message.id) &&
        message.conversationId === input.conversationId &&
        message.createdBy !== input.currentUserId &&
        !message.deletedAt
    )
    .map((message) => message.id)
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

function isChatReadStateUnread(
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

export function getSeenChatMessageIds(input: {
  conversationId: string
  currentUserId: string
  messages: Array<
    Pick<
      AppData["chatMessages"][number],
      "createdBy" | "deletedAt" | "id" | "conversationId"
    >
  >
  participantIds: readonly string[]
  readStates: Array<
    Pick<ChatReadState, "conversationId" | "messageReadAtById" | "userId">
  >
}) {
  const otherParticipantIds = new Set(
    input.participantIds.filter((userId) => userId !== input.currentUserId)
  )
  const currentUserMessageIds = new Set(
    input.messages
      .filter(
        (message) =>
          message.conversationId === input.conversationId &&
          message.createdBy === input.currentUserId &&
          !message.deletedAt
      )
      .map((message) => message.id)
  )
  const seenMessageIds = new Set<string>()

  for (const readState of input.readStates) {
    if (readState.conversationId !== input.conversationId) {
      continue
    }

    const isCurrentUserReadState = readState.userId === input.currentUserId
    const isOtherParticipantReadState = otherParticipantIds.has(
      readState.userId
    )

    if (!isCurrentUserReadState && !isOtherParticipantReadState) {
      continue
    }

    for (const messageId of Object.keys(readState.messageReadAtById ?? {})) {
      if (isOtherParticipantReadState && currentUserMessageIds.has(messageId)) {
        seenMessageIds.add(messageId)
      }
    }
  }

  return seenMessageIds
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
