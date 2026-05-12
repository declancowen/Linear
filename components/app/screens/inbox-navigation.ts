import type { Notification } from "@/lib/domain/types"

export function getNextActiveInboxNotificationIdAfterMove({
  activeId,
  movedNotificationId,
  visibleNotifications,
}: {
  activeId: string | null
  movedNotificationId: string
  visibleNotifications: Notification[]
}) {
  if (activeId !== movedNotificationId) {
    return undefined
  }

  return (
    visibleNotifications.find((entry) => entry.id !== movedNotificationId)
      ?.id ?? null
  )
}
