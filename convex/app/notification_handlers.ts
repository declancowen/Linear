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
  claimId?: string
  notificationIds: string[]
}

type ClaimPendingNotificationDigestsArgs = ServerAccessArgs & {
  claimId: string
}

type ReleaseNotificationDigestClaimArgs = ServerAccessArgs & {
  claimId: string
  notificationIds: string[]
}

type PendingDigestNotification = {
  id: string
  message: string
  entityId: string
  entityType:
    | "chat"
    | "team"
    | "workspace"
    | "project"
    | "workItem"
    | "document"
    | "invite"
    | "channelPost"
  type: "mention" | "assignment" | "comment" | "invite" | "status-change"
  createdAt: string
}

type PendingNotificationDigest = {
  user: {
    id: string
    email: string
    name: string
  }
  notifications: PendingDigestNotification[]
}

const DIGEST_CLAIM_TTL_MS = 15 * 60 * 1000

function isActiveDigestClaim(
  notification: {
    digestClaimId?: string | null
    digestClaimedAt?: string | null
  },
  nowMs: number
) {
  if (!notification.digestClaimId || !notification.digestClaimedAt) {
    return false
  }

  const claimedAtMs = Date.parse(notification.digestClaimedAt)

  if (Number.isNaN(claimedAtMs)) {
    return false
  }

  return nowMs - claimedAtMs < DIGEST_CLAIM_TTL_MS
}

async function buildPendingNotificationDigests(
  ctx: QueryCtx | MutationCtx,
  pendingNotifications: Awaited<ReturnType<typeof listPendingDigestNotifications>>
): Promise<PendingNotificationDigest[]> {
  const users = (
    await listUsersByIds(
      ctx,
      pendingNotifications.map((notification) => notification.userId)
    )
  ).map(normalizeUser)
  const notificationsByUserId = new Map<
    string,
    typeof pendingNotifications
  >()

  for (const notification of pendingNotifications) {
    const existing = notificationsByUserId.get(notification.userId) ?? []
    existing.push(notification)
    notificationsByUserId.set(notification.userId, existing)
  }

  return users
    .filter((user) => user.preferences.emailDigest)
    .flatMap((user) => {
      const pendingNotificationsForUser = [
        ...(notificationsByUserId.get(user.id) ?? []),
      ].sort((left, right) => right.createdAt.localeCompare(left.createdAt))

      if (pendingNotificationsForUser.length === 0) {
        return []
      }

      return [
        {
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
        },
      ]
    })
}

function filterClaimablePendingNotifications(
  notifications: Awaited<ReturnType<typeof listPendingDigestNotifications>>,
  nowMs: number
) {
  return notifications.filter(
    (notification) =>
      !notification.readAt &&
      !notification.archivedAt &&
      !notification.emailedAt &&
      !isActiveDigestClaim(notification, nowMs)
  )
}

export async function listPendingNotificationDigestsHandler(
  ctx: QueryCtx,
  args: ServerAccessArgs
) {
  assertServerToken(args.serverToken)
  const nowMs = Date.now()
  const pendingNotifications = filterClaimablePendingNotifications(
    await listPendingDigestNotifications(ctx),
    nowMs
  )

  return buildPendingNotificationDigests(ctx, pendingNotifications)
}

export async function claimPendingNotificationDigestsHandler(
  ctx: MutationCtx,
  args: ClaimPendingNotificationDigestsArgs
) {
  assertServerToken(args.serverToken)
  const now = getNow()
  const nowMs = Date.parse(now)
  const pendingNotifications = filterClaimablePendingNotifications(
    await listPendingDigestNotifications(ctx),
    nowMs
  )
  const digests = await buildPendingNotificationDigests(ctx, pendingNotifications)
  const claimedNotificationIds = new Set<string>()

  for (const digest of digests) {
    for (const notification of digest.notifications) {
      const existing = await getNotificationDoc(ctx, notification.id)

      if (
        !existing ||
        existing.readAt ||
        existing.archivedAt ||
        existing.emailedAt ||
        isActiveDigestClaim(existing, nowMs)
      ) {
        continue
      }

      await ctx.db.patch(existing._id, {
        digestClaimId: args.claimId,
        digestClaimedAt: now,
      })
      claimedNotificationIds.add(existing.id)
    }
  }

  return digests
    .map((digest) => ({
      ...digest,
      notifications: digest.notifications.filter((notification) =>
        claimedNotificationIds.has(notification.id)
      ),
    }))
    .filter((digest) => digest.notifications.length > 0)
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

    if (
      !notification ||
      (args.claimId && notification.digestClaimId !== args.claimId)
    ) {
      continue
    }

    await ctx.db.patch(notification._id, {
      digestClaimId: null,
      digestClaimedAt: null,
      emailedAt: now,
    })
  }
}

export async function releaseNotificationDigestClaimHandler(
  ctx: MutationCtx,
  args: ReleaseNotificationDigestClaimArgs
) {
  assertServerToken(args.serverToken)

  for (const notificationId of args.notificationIds) {
    const notification = await getNotificationDoc(ctx, notificationId)

    if (
      !notification ||
      notification.emailedAt ||
      notification.digestClaimId !== args.claimId
    ) {
      continue
    }

    await ctx.db.patch(notification._id, {
      digestClaimId: null,
      digestClaimedAt: null,
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
