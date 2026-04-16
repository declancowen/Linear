import type { AppData } from "@/lib/domain/types"

export function getUnreadNotifications(data: AppData) {
  return data.notifications.filter(
    (notification) =>
      notification.userId === data.currentUserId &&
      notification.readAt === null &&
      notification.archivedAt == null
  )
}
