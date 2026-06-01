import type { Notification } from "@/lib/domain/types"

export function isChatMessageNotification(
  notification: Pick<Notification, "entityType" | "type">
) {
  return notification.entityType === "chat" && notification.type === "message"
}

export function shouldShowNotificationInInbox(
  notification: Pick<Notification, "entityType" | "type">
) {
  return !isChatMessageNotification(notification)
}
