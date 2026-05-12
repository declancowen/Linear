export function createTestNotificationRecord(
  userId: string,
  actorId: string,
  message: string,
  entityType: string,
  entityId: string,
  type: string
) {
  return {
    id: `notification_${userId}`,
    userId,
    actorId,
    message,
    entityType,
    entityId,
    type,
  }
}
