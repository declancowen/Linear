import type { Notification } from "@/lib/domain/types"

export function collectNotificationInboxEntityIds(
  notifications: Iterable<Notification>
) {
  const inviteIds = new Set<string>()
  const conversationIds = new Set<string>()
  const postIds = new Set<string>()
  const projectIds = new Set<string>()

  for (const notification of notifications) {
    if (notification.entityType === "invite") {
      inviteIds.add(notification.entityId)
    } else if (notification.entityType === "chat") {
      conversationIds.add(notification.entityId)
    } else if (notification.entityType === "channelPost") {
      postIds.add(notification.entityId)
    } else if (notification.entityType === "project") {
      projectIds.add(notification.entityId)
    }
  }

  return { conversationIds, inviteIds, postIds, projectIds }
}
