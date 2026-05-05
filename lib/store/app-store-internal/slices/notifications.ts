"use client"

import {
  syncArchiveNotification,
  syncArchiveNotifications,
  syncDeleteNotification,
  syncMarkNotificationRead,
  syncMarkNotificationsRead,
  syncToggleNotificationRead,
  syncUnarchiveNotification,
  syncUnarchiveNotifications,
} from "@/lib/convex/client"

import { getNow } from "../helpers"
import { createStoreRuntime } from "../runtime"
import type { AppStore, AppStoreGet, AppStoreSet } from "../types"

type NotificationSlice = Pick<
  AppStore,
  | "markNotificationRead"
  | "markNotificationsRead"
  | "toggleNotificationRead"
  | "archiveNotification"
  | "archiveNotifications"
  | "unarchiveNotification"
  | "unarchiveNotifications"
  | "deleteNotification"
>

function updateNotificationArchiveState(
  notifications: AppStore["notifications"],
  notificationIds: string[],
  archivedAt: string | null
) {
  const notificationIdSet = new Set(notificationIds)

  return {
    notificationIdSet,
    notifications: notifications.map((notification) =>
      notificationIdSet.has(notification.id)
        ? {
            ...notification,
            archivedAt:
              archivedAt === null
                ? null
                : (notification.archivedAt ?? archivedAt),
          }
        : notification
    ),
  }
}

function clearActiveInboxNotificationSelection(
  ui: AppStore["ui"],
  notificationIdSet: ReadonlySet<string>
) {
  return {
    ...ui,
    activeInboxNotificationId: ui.activeInboxNotificationId
      ? notificationIdSet.has(ui.activeInboxNotificationId)
        ? null
        : ui.activeInboxNotificationId
      : null,
  }
}

export function createNotificationSlice(
  set: AppStoreSet,
  get: AppStoreGet,
  runtime: ReturnType<typeof createStoreRuntime>
): NotificationSlice {
  return {
    markNotificationRead(notificationId) {
      set((state) => ({
        notifications: state.notifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, readAt: notification.readAt ?? getNow() }
            : notification
        ),
      }))

      runtime.syncInBackground(
        syncMarkNotificationRead(notificationId),
        "Failed to update notification"
      )
    },
    markNotificationsRead(notificationIds) {
      if (notificationIds.length === 0) {
        return
      }

      const notificationIdSet = new Set(notificationIds)
      const readAt = getNow()

      set((state) => ({
        notifications: state.notifications.map((notification) =>
          notificationIdSet.has(notification.id)
            ? {
                ...notification,
                readAt: notification.readAt ?? readAt,
              }
            : notification
        ),
      }))

      runtime.syncInBackground(
        syncMarkNotificationsRead(notificationIds),
        "Failed to mark notifications as read"
      )
    },
    toggleNotificationRead(notificationId) {
      set((state) => ({
        notifications: state.notifications.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                readAt: notification.readAt ? null : getNow(),
              }
            : notification
        ),
      }))

      runtime.syncInBackground(
        syncToggleNotificationRead(notificationId),
        "Failed to update notification"
      )
    },
    archiveNotification(notificationId) {
      set((state) => ({
        notifications: state.notifications.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                archivedAt: notification.archivedAt ?? getNow(),
              }
            : notification
        ),
      }))

      runtime.syncInBackground(
        syncArchiveNotification(notificationId),
        "Failed to archive notification"
      )
    },
    archiveNotifications(notificationIds) {
      if (notificationIds.length === 0) {
        return
      }

      const archivedAt = getNow()

      set((state) => {
        const { notificationIdSet, notifications } =
          updateNotificationArchiveState(
            state.notifications,
            notificationIds,
            archivedAt
          )

        return {
          notifications,
          ui: clearActiveInboxNotificationSelection(state.ui, notificationIdSet),
        }
      })

      runtime.syncInBackground(
        syncArchiveNotifications(notificationIds),
        "Failed to archive notifications"
      )
    },
    unarchiveNotification(notificationId) {
      set((state) => ({
        notifications: state.notifications.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                archivedAt: null,
              }
            : notification
        ),
      }))

      runtime.syncInBackground(
        syncUnarchiveNotification(notificationId),
        "Failed to unarchive notification"
      )
    },
    unarchiveNotifications(notificationIds) {
      if (notificationIds.length === 0) {
        return
      }

      set((state) => {
        const { notificationIdSet, notifications } =
          updateNotificationArchiveState(
            state.notifications,
            notificationIds,
            null
          )

        return {
          notifications,
          ui: clearActiveInboxNotificationSelection(state.ui, notificationIdSet),
        }
      })

      runtime.syncInBackground(
        syncUnarchiveNotifications(notificationIds),
        "Failed to unarchive notifications"
      )
    },
    async deleteNotification(notificationId) {
      set((state) => ({
        notifications: state.notifications.filter(
          (notification) => notification.id !== notificationId
        ),
        ui: {
          ...state.ui,
          activeInboxNotificationId:
            state.ui.activeInboxNotificationId === notificationId
              ? null
              : state.ui.activeInboxNotificationId,
        },
      }))

      try {
        await syncDeleteNotification(notificationId)
      } catch (error) {
        await runtime.handleSyncFailure(error, "Failed to delete notification")
      }
    },
  }
}
