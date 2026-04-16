"use client"

import {
  syncArchiveNotification,
  syncArchiveNotifications,
  syncDeleteNotification,
  syncMarkNotificationRead,
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
  | "toggleNotificationRead"
  | "archiveNotification"
  | "archiveNotifications"
  | "unarchiveNotification"
  | "unarchiveNotifications"
  | "deleteNotification"
>

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

      const notificationIdSet = new Set(notificationIds)
      const archivedAt = getNow()

      set((state) => ({
        notifications: state.notifications.map((notification) =>
          notificationIdSet.has(notification.id)
            ? {
                ...notification,
                archivedAt: notification.archivedAt ?? archivedAt,
              }
            : notification
        ),
        ui: {
          ...state.ui,
          activeInboxNotificationId: state.ui.activeInboxNotificationId
            ? notificationIdSet.has(state.ui.activeInboxNotificationId)
              ? null
              : state.ui.activeInboxNotificationId
            : null,
        },
      }))

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

      const notificationIdSet = new Set(notificationIds)

      set((state) => ({
        notifications: state.notifications.map((notification) =>
          notificationIdSet.has(notification.id)
            ? {
                ...notification,
                archivedAt: null,
              }
            : notification
        ),
        ui: {
          ...state.ui,
          activeInboxNotificationId: state.ui.activeInboxNotificationId
            ? notificationIdSet.has(state.ui.activeInboxNotificationId)
              ? null
              : state.ui.activeInboxNotificationId
            : null,
        },
      }))

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
