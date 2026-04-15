import { api } from "@/convex/_generated/api"

import {
  getConvexServerClient,
  runConvexRequestWithRetry,
  withServerToken,
} from "./core"

export async function createInviteServer(input: {
  currentUserId: string
  teamId: string
  email: string
  role: "admin" | "member" | "viewer" | "guest"
}) {
  return getConvexServerClient().mutation(
    api.app.createInvite,
    withServerToken(input)
  )
}

export async function acceptInviteServer(input: {
  currentUserId: string
  token: string
}) {
  return getConvexServerClient().mutation(
    api.app.acceptInvite,
    withServerToken(input)
  )
}

export async function declineInviteServer(input: {
  currentUserId: string
  token: string
}) {
  return getConvexServerClient().mutation(
    api.app.declineInvite,
    withServerToken(input)
  )
}

export async function markNotificationsEmailedServer(
  notificationIds: string[]
) {
  return getConvexServerClient().mutation(
    api.app.markNotificationsEmailed,
    withServerToken({
      notificationIds,
    })
  )
}

export async function markNotificationReadServer(input: {
  currentUserId: string
  notificationId: string
}) {
  return runConvexRequestWithRetry("markNotificationReadServer", () =>
    getConvexServerClient().mutation(
      api.app.markNotificationRead,
      withServerToken(input)
    )
  )
}

export async function toggleNotificationReadServer(input: {
  currentUserId: string
  notificationId: string
}) {
  return runConvexRequestWithRetry("toggleNotificationReadServer", () =>
    getConvexServerClient().mutation(
      api.app.toggleNotificationRead,
      withServerToken(input)
    )
  )
}

export async function archiveNotificationServer(input: {
  currentUserId: string
  notificationId: string
}) {
  return runConvexRequestWithRetry("archiveNotificationServer", () =>
    getConvexServerClient().mutation(
      api.app.archiveNotification,
      withServerToken(input)
    )
  )
}

export async function unarchiveNotificationServer(input: {
  currentUserId: string
  notificationId: string
}) {
  return runConvexRequestWithRetry("unarchiveNotificationServer", () =>
    getConvexServerClient().mutation(
      api.app.unarchiveNotification,
      withServerToken(input)
    )
  )
}

export async function deleteNotificationServer(input: {
  currentUserId: string
  notificationId: string
}) {
  return runConvexRequestWithRetry("deleteNotificationServer", () =>
    getConvexServerClient().mutation(
      api.app.deleteNotification,
      withServerToken(input)
    )
  )
}
