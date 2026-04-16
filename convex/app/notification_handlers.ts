import type { MutationCtx, QueryCtx } from "../_generated/server"

import { assertServerToken, getNow } from "./core"
import { getNotificationDoc } from "./data"
import { getOwnedNotificationOrNull } from "./notifications"
import { normalizeUser } from "./normalization"

type ServerAccessArgs = {
  serverToken: string
}

type NotificationMutationArgs = ServerAccessArgs & {
  currentUserId: string
  notificationId: string
}

type MarkNotificationsEmailedArgs = ServerAccessArgs & {
  notificationIds: string[]
}

export async function listPendingNotificationDigestsHandler(
  ctx: QueryCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)
  const users = (await ctx.db.query("users").collect()).map(normalizeUser)
  const notifications = await ctx.db.query("notifications").collect()

  return users
    .filter((user) => user.preferences.emailDigest)
    .map((user) => {
      const pendingNotifications = notifications
        .filter(
          (notification) =>
            notification.userId === user.id &&
            !notification.readAt &&
            !notification.archivedAt &&
            !notification.emailedAt
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

      if (pendingNotifications.length === 0) {
        return null
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        notifications: pendingNotifications.map((notification) => ({
          id: notification.id,
          message: notification.message,
          entityId: notification.entityId,
          entityType: notification.entityType,
          type: notification.type,
          createdAt: notification.createdAt,
        })),
      }
    })
    .filter(Boolean)
}

export async function markNotificationReadHandler(
  ctx: MutationCtx,
  args: NotificationMutationArgs
) {
  assertServerToken(args.serverToken)
  const notification = await getOwnedNotificationOrNull(
    ctx,
    args.notificationId,
    args.currentUserId
  )

  if (!notification) {
    return
  }

  await ctx.db.patch(notification._id, {
    readAt: notification.readAt ?? getNow(),
  })
}

export async function markNotificationsEmailedHandler(
  ctx: MutationCtx,
  args: MarkNotificationsEmailedArgs
) {
  assertServerToken(args.serverToken)
  const now = getNow()

  for (const notificationId of args.notificationIds) {
    const notification = await getNotificationDoc(ctx, notificationId)

    if (!notification) {
      continue
    }

    await ctx.db.patch(notification._id, {
      emailedAt: now,
    })
  }
}

export async function toggleNotificationReadHandler(
  ctx: MutationCtx,
  args: NotificationMutationArgs
) {
  assertServerToken(args.serverToken)
  const notification = await getOwnedNotificationOrNull(
    ctx,
    args.notificationId,
    args.currentUserId
  )

  if (!notification) {
    return
  }

  await ctx.db.patch(notification._id, {
    readAt: notification.readAt ? null : getNow(),
  })
}

export async function archiveNotificationHandler(
  ctx: MutationCtx,
  args: NotificationMutationArgs
) {
  assertServerToken(args.serverToken)
  const notification = await getOwnedNotificationOrNull(
    ctx,
    args.notificationId,
    args.currentUserId
  )

  if (!notification) {
    return
  }

  await ctx.db.patch(notification._id, {
    archivedAt: notification.archivedAt ?? getNow(),
  })
}

export async function unarchiveNotificationHandler(
  ctx: MutationCtx,
  args: NotificationMutationArgs
) {
  assertServerToken(args.serverToken)
  const notification = await getOwnedNotificationOrNull(
    ctx,
    args.notificationId,
    args.currentUserId
  )

  if (!notification) {
    return
  }

  await ctx.db.patch(notification._id, {
    archivedAt: null,
  })
}

export async function deleteNotificationHandler(
  ctx: MutationCtx,
  args: NotificationMutationArgs
) {
  assertServerToken(args.serverToken)
  const notification = await getOwnedNotificationOrNull(
    ctx,
    args.notificationId,
    args.currentUserId
  )

  if (!notification) {
    return
  }

  await ctx.db.delete(notification._id)
}
