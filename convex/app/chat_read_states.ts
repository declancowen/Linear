import type { MutationCtx } from "../_generated/server"
import type { Conversation } from "../../lib/domain/types"

import {
  createChatReadStateId,
  getReadableChatMessageReceiptIds,
  getUnreadChatMessageReceiptIds,
  mergeChatMessageFirstReadTimestamps,
  supportsChatMessageReadReceipts,
} from "../../lib/domain/chat-read-state"
import {
  getChatReadStateDoc,
  getConversationDoc,
  listChatMessagesByConversation,
  listNotificationsByEntity,
} from "./data"
import { assertServerToken, getNow } from "./core"
import { requireConversationAccess } from "./conversations"

type ServerAccessArgs = {
  serverToken: string
}

export type UpdateChatReadStateArgs = ServerAccessArgs & {
  currentUserId: string
  conversationId: string
  action: "read" | "unread"
  messageIds?: string[]
}

type ChatReadStatePatch = {
  readAt?: string | null
  unreadAt?: string | null
  messageReadAtById?: Record<string, string>
  updatedAt: string
}

async function upsertChatReadState(
  ctx: MutationCtx,
  input: {
    userId: string
    conversationId: string
    patch: ChatReadStatePatch
    existing?: Awaited<ReturnType<typeof getChatReadStateDoc>> | null
  }
) {
  const existing =
    input.existing ??
    (await getChatReadStateDoc(ctx, input.userId, input.conversationId))

  if (existing) {
    await ctx.db.patch(existing._id, input.patch)
    return {
      ...existing,
      ...input.patch,
    }
  }

  const createdAt = input.patch.updatedAt
  const readState = {
    id: createChatReadStateId(input.userId, input.conversationId),
    userId: input.userId,
    conversationId: input.conversationId,
    readAt: input.patch.readAt ?? null,
    unreadAt: input.patch.unreadAt ?? null,
    messageReadAtById: input.patch.messageReadAtById ?? {},
    createdAt,
    updatedAt: input.patch.updatedAt,
  }

  await ctx.db.insert("chatReadStates", readState)
  return readState
}

async function markLegacyChatMessageNotificationsRead(
  ctx: MutationCtx,
  input: {
    userId: string
    conversationId: string
    readAt: string
  }
) {
  const notifications = await listNotificationsByEntity(
    ctx,
    "chat",
    input.conversationId
  )

  for (const notification of notifications) {
    if (
      notification.userId !== input.userId ||
      notification.type !== "message" ||
      notification.readAt
    ) {
      continue
    }

    await ctx.db.patch(notification._id, {
      readAt: input.readAt,
    })
  }
}

export async function markChatConversationRead(
  ctx: MutationCtx,
  input: {
    userId: string
    conversationId: string
    conversation?: Pick<Conversation, "kind" | "scopeType" | "variant"> | null
    now: string
    messageIds?: string[]
  }
) {
  const readableMessageIds = await selectReadableMessageIdsForReceipt(ctx, {
    conversation: input.conversation,
    conversationId: input.conversationId,
    currentUserId: input.userId,
    messageIds: input.messageIds,
  })
  const existing = await getChatReadStateDoc(
    ctx,
    input.userId,
    input.conversationId
  )
  const unreadMessageIds = getUnreadChatMessageReceiptIds(
    existing?.messageReadAtById,
    readableMessageIds
  )
  const messageReadAtById = unreadMessageIds.length
    ? mergeChatMessageFirstReadTimestamps(
        existing?.messageReadAtById,
        unreadMessageIds,
        input.now
      )
    : undefined

  if (
    existing &&
    existing.readAt &&
    existing.unreadAt === null &&
    unreadMessageIds.length === 0
  ) {
    await markLegacyChatMessageNotificationsRead(ctx, {
      userId: input.userId,
      conversationId: input.conversationId,
      readAt: input.now,
    })
    return existing
  }

  const readState = await upsertChatReadState(ctx, {
    userId: input.userId,
    conversationId: input.conversationId,
    existing,
    patch: {
      readAt: input.now,
      unreadAt: null,
      ...(messageReadAtById ? { messageReadAtById } : {}),
      updatedAt: input.now,
    },
  })

  await markLegacyChatMessageNotificationsRead(ctx, {
    userId: input.userId,
    conversationId: input.conversationId,
    readAt: input.now,
  })

  return readState
}

export async function markChatConversationUnread(
  ctx: MutationCtx,
  input: {
    userId: string
    conversationId: string
    now: string
  }
) {
  const existing = await getChatReadStateDoc(
    ctx,
    input.userId,
    input.conversationId
  )

  if (existing?.unreadAt != null) {
    return existing
  }

  return upsertChatReadState(ctx, {
    userId: input.userId,
    conversationId: input.conversationId,
    patch: {
      readAt: existing?.readAt ?? null,
      unreadAt: input.now,
      updatedAt: input.now,
    },
  })
}

export async function markChatUnreadForUsers(
  ctx: MutationCtx,
  input: {
    conversationId: string
    userIds: Iterable<string>
    now: string
  }
) {
  for (const userId of new Set(input.userIds)) {
    await markChatConversationUnread(ctx, {
      userId,
      conversationId: input.conversationId,
      now: input.now,
    })
  }
}

async function selectReadableMessageIdsForReceipt(
  ctx: MutationCtx,
  input: {
    conversation?: Pick<Conversation, "kind" | "scopeType" | "variant"> | null
    conversationId: string
    currentUserId: string
    messageIds?: string[]
  }
) {
  if (!input.messageIds?.length) {
    return undefined
  }

  const conversation =
    input.conversation ?? (await getConversationDoc(ctx, input.conversationId))

  if (!supportsChatMessageReadReceipts(conversation)) {
    return undefined
  }

  const readableMessages = await listChatMessagesByConversation(
    ctx,
    input.conversationId
  )
  const readableIds = new Set(
    getReadableChatMessageReceiptIds({
      conversationId: input.conversationId,
      currentUserId: input.currentUserId,
      messages: readableMessages,
      messageIds: input.messageIds,
    })
  )

  return input.messageIds.filter((messageId) => readableIds.has(messageId))
}

export async function updateChatReadStateHandler(
  ctx: MutationCtx,
  args: UpdateChatReadStateArgs
) {
  assertServerToken(args.serverToken)
  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, args.conversationId),
    args.currentUserId
  )

  if (conversation.kind !== "chat") {
    throw new Error("Read state can only be updated for chats")
  }

  const now = getNow()
  return args.action === "read"
    ? markChatConversationRead(ctx, {
        userId: args.currentUserId,
        conversationId: conversation.id,
        conversation,
        now,
        messageIds: args.messageIds,
      })
    : markChatConversationUnread(ctx, {
        userId: args.currentUserId,
        conversationId: conversation.id,
        now,
      })
}
