import type { MutationCtx, QueryCtx } from "../_generated/server"

import { assertServerToken, getNow } from "./core"
import {
  getNotificationDoc,
  listPendingDigestNotifications,
  listUsersByIds,
} from "./data"
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
  const pendingNotifications = (
    await listPendingDigestNotifications(ctx)
  ).filter(
    (notification) =>
      !notification.readAt &&
      !notification.archivedAt &&
      !notification.emailedAt
  )
  const users = (
    await listUsersByIds(
      ctx,
      pendingNotifications.map((notification) => notification.userId)
    )
  ).map(normalizeUser)
  const notificationsByUserId = new Map<string, typeof pendingNotifications>()

  for (const notification of pendingNotifications) {
    const existing = notificationsByUserId.get(notification.userId) ?? []
    existing.push(notification)
    notificationsByUserId.set(notification.userId, existing)
  }

  return users
    .filter((user) => user.preferences.emailDigest)
    .map((user) => {
      const pendingNotificationsForUser = [
        ...(notificationsByUserId.get(user.id) ?? []),
      ].sort((left, right) => right.createdAt.localeCompare(left.createdAt))

      if (pendingNotificationsForUser.length === 0) {
        return null
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        notifications: pendingNotificationsForUser.map((notification) => ({
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
    throw new Error("Notification not found")
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
    throw new Error("Notification not found")
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
    throw new Error("Notification not found")
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
    throw new Error("Notification not found")
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
    throw new Error("Notification not found")
  }

  await ctx.db.delete(notification._id)
}
