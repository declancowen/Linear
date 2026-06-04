import type {
  Notification,
  NotificationEntityType,
  NotificationType,
} from "@/lib/domain/types"

function createNotificationRecord({
  actorId,
  contentPreview,
  createdAt,
  entityId,
  entityType,
  id,
  message,
  targetCommentId,
  type,
  userId,
}: {
  actorId: string
  contentPreview?: string | null
  createdAt: string
  entityId: string
  entityType: NotificationEntityType
  id: string
  message: string
  targetCommentId?: string | null
  type: NotificationType
  userId: string
}): Notification {
  return {
    id,
    userId,
    actorId,
    message,
    entityType,
    entityId,
    type,
    contentPreview: contentPreview?.trim() || null,
    targetCommentId: targetCommentId?.trim() || null,
    readAt: null,
    archivedAt: null,
    emailedAt: null,
    createdAt,
  }
}

export type CreateNotificationRecordArgs = [
  userId: string,
  actorId: string,
  message: string,
  entityType: NotificationEntityType,
  entityId: string,
  type: NotificationType,
  metadata?: {
    contentPreview?: string | null
    targetCommentId?: string | null
  },
]

export function createNotificationRecordFromArgs(
  [
    userId,
    actorId,
    message,
    entityType,
    entityId,
    type,
    metadata = {},
  ]: CreateNotificationRecordArgs,
  options: {
    createdAt: string
    id: string
  }
) {
  return createNotificationRecord({
    id: options.id,
    userId,
    actorId,
    message,
    entityType,
    entityId,
    type,
    contentPreview: metadata.contentPreview,
    targetCommentId: metadata.targetCommentId,
    createdAt: options.createdAt,
  })
}
