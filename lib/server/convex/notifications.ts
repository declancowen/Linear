import { api } from "@/convex/_generated/api"
import { coerceApplicationError } from "@/lib/server/application-errors"

import {
  getConvexServerClient,
  runConvexRequestWithRetry,
  withServerToken,
} from "./core"
import { resolveServerOrigin } from "../request-origin"

const INVITE_MUTATION_ERROR_MAPPINGS = [
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Only admins and members can invite",
    status: 403,
    code: "TEAM_INVITE_FORBIDDEN",
  },
  {
    match: "Invite not found",
    status: 404,
    code: "INVITE_NOT_FOUND",
  },
  {
    match: "Invite has been declined",
    status: 409,
    code: "INVITE_DECLINED",
  },
  {
    match: "Invite has already been accepted",
    status: 409,
    code: "INVITE_ALREADY_ACCEPTED",
  },
  {
    match: "Only team admins can cancel invites",
    status: 403,
    code: "INVITE_CANCEL_FORBIDDEN",
  },
  {
    match: "Only workspace admins can perform this action",
    status: 403,
    code: "INVITE_CANCEL_FORBIDDEN",
  },
] as const

const NOTIFICATION_MUTATION_ERROR_MAPPINGS = [
  {
    match: "Notification not found",
    status: 404,
    code: "NOTIFICATION_NOT_FOUND",
  },
  {
    match: "You do not have access to this notification",
    status: 403,
    code: "NOTIFICATION_ACCESS_DENIED",
  },
] as const

export async function createInviteServer(input: {
  currentUserId: string
  teamId: string
  batchId?: string
  email: string
  role: "admin" | "member" | "viewer" | "guest"
}) {
  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.createInvite,
      withServerToken({
        ...input,
        origin,
      })
    )
  } catch (error) {
    throw coerceApplicationError(error, [...INVITE_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function cancelInviteServer(input: {
  currentUserId: string
  inviteId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.cancelInvite,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...INVITE_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function acceptInviteServer(input: {
  currentUserId: string
  token: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.acceptInvite,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...INVITE_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function declineInviteServer(input: {
  currentUserId: string
  token: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.declineInvite,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...INVITE_MUTATION_ERROR_MAPPINGS]) ?? error
  }
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

export async function enqueueMentionEmailJobsServer(
  jobs: Array<{
    kind: "mention"
    notificationId: string
    toEmail: string
    subject: string
    text: string
    html: string
  }>
) {
  return enqueueEmailJobsServer(jobs)
}

export async function enqueueEmailJobsServer(
  jobs: Array<{
    kind: "mention" | "assignment" | "invite" | "access-change"
    notificationId?: string
    toEmail: string
    subject: string
    text: string
    html: string
  }>
) {
  if (jobs.length === 0) {
    return {
      queued: 0,
    }
  }

  return getConvexServerClient().mutation(
    api.app.enqueueEmailJobs,
    withServerToken({
      jobs,
    })
  )
}

export async function markNotificationReadServer(input: {
  currentUserId: string
  notificationId: string
}) {
  try {
    return await runConvexRequestWithRetry("markNotificationReadServer", () =>
      getConvexServerClient().mutation(
        api.app.markNotificationRead,
        withServerToken(input)
      )
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...NOTIFICATION_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function toggleNotificationReadServer(input: {
  currentUserId: string
  notificationId: string
}) {
  try {
    return await runConvexRequestWithRetry("toggleNotificationReadServer", () =>
      getConvexServerClient().mutation(
        api.app.toggleNotificationRead,
        withServerToken(input)
      )
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...NOTIFICATION_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function archiveNotificationServer(input: {
  currentUserId: string
  notificationId: string
}) {
  try {
    return await runConvexRequestWithRetry("archiveNotificationServer", () =>
      getConvexServerClient().mutation(
        api.app.archiveNotification,
        withServerToken(input)
      )
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...NOTIFICATION_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function unarchiveNotificationServer(input: {
  currentUserId: string
  notificationId: string
}) {
  try {
    return await runConvexRequestWithRetry("unarchiveNotificationServer", () =>
      getConvexServerClient().mutation(
        api.app.unarchiveNotification,
        withServerToken(input)
      )
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...NOTIFICATION_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function deleteNotificationServer(input: {
  currentUserId: string
  notificationId: string
}) {
  try {
    return await runConvexRequestWithRetry("deleteNotificationServer", () =>
      getConvexServerClient().mutation(
        api.app.deleteNotification,
        withServerToken(input)
      )
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...NOTIFICATION_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}
