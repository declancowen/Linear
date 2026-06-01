import type { MutationCtx } from "../_generated/server"

import { createChatReadStateId } from "../../lib/domain/chat-read-state"
import {
  getChatReadStateDoc,
  getConversationDoc,
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
}

type ChatReadStatePatch = {
  readAt?: string | null
  unreadAt?: string | null
  updatedAt: string
}

async function upsertChatReadState(
  ctx: MutationCtx,
  input: {
    userId: string
    conversationId: string
    patch: ChatReadStatePatch
  }
) {
  const existing = await getChatReadStateDoc(
    ctx,
    input.userId,
    input.conversationId
  )

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
    now: string
  }
) {
  const readState = await upsertChatReadState(ctx, {
    userId: input.userId,
    conversationId: input.conversationId,
    patch: {
      readAt: input.now,
      unreadAt: null,
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
        now,
      })
    : markChatConversationUnread(ctx, {
        userId: args.currentUserId,
        conversationId: conversation.id,
        now,
      })
}
