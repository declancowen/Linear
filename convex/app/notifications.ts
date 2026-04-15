import type { MutationCtx } from "../_generated/server"

import { getNow } from "./core"
import {
  getConversationDoc,
  getNotificationDoc,
  getTeamDoc,
  type AppCtx,
} from "./data"

export async function getOwnedNotificationOrNull(
  ctx: AppCtx,
  notificationId: string,
  userId: string
) {
  const notification = await getNotificationDoc(ctx, notificationId)

  if (!notification) {
    return null
  }

  if (notification.userId !== userId) {
    throw new Error("You do not have access to this notification")
  }

  return notification
}

export async function archiveInviteNotifications(
  ctx: MutationCtx,
  input: {
    userId: string
    inviteIds: string[]
  }
) {
  if (input.inviteIds.length === 0) {
    return
  }

  const now = getNow()
  const inviteIds = new Set(input.inviteIds)
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", input.userId))
    .collect()

  for (const notification of notifications) {
    if (
      notification.entityType !== "invite" ||
      !inviteIds.has(notification.entityId)
    ) {
      continue
    }

    await ctx.db.patch(notification._id, {
      readAt: notification.readAt ?? now,
      archivedAt: now,
    })
  }
}

export async function getChannelConversationPath(
  ctx: AppCtx,
  conversation: Awaited<ReturnType<typeof getConversationDoc>>,
  postId: string
) {
  if (!conversation || conversation.kind !== "channel") {
    return `/inbox#${postId}`
  }

  if (conversation.scopeType === "workspace") {
    return `/workspace/channel#${postId}`
  }

  const team = await getTeamDoc(ctx, conversation.scopeId)

  if (!team) {
    return `/inbox#${postId}`
  }

  return `/team/${team.slug}/channel#${postId}`
}

export async function getChatConversationPath(
  ctx: AppCtx,
  conversation: Awaited<ReturnType<typeof getConversationDoc>>
) {
  if (!conversation || conversation.kind !== "chat") {
    return "/chats"
  }

  if (conversation.scopeType === "workspace") {
    return `/chats?chatId=${conversation.id}`
  }

  const team = await getTeamDoc(ctx, conversation.scopeId)

  if (!team) {
    return "/chats"
  }

  return `/team/${team.slug}/chat`
}
