import { api } from "@/convex/_generated/api"
import { coerceApplicationError } from "@/lib/server/application-errors"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

import {
  getConvexServerClient,
  getServerToken,
  runConvexRequestWithRetry,
  withServerToken,
} from "./core"

const SNAPSHOT_ERROR_MAPPINGS = [
  {
    match: "Authenticated user not found",
    status: 404,
    code: "SNAPSHOT_USER_NOT_FOUND",
  },
] as const

export async function ensureConvexUserFromAuth(user: AuthenticatedAppUser) {
  return runConvexRequestWithRetry("ensureConvexUserFromAuth", () =>
    getConvexServerClient().mutation(api.app.ensureUserFromAuth, {
      serverToken: getServerToken(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      workosUserId: user.workosUserId,
    })
  )
}

export async function ensureConvexUserReadyServer(user: AuthenticatedAppUser) {
  const authContext = await getAuthContextServer({
    workosUserId: user.workosUserId,
    email: user.email,
  })

  if (authContext?.currentUser) {
    return authContext
  }

  await ensureConvexUserFromAuth(user)

  return getAuthContextServer({
    workosUserId: user.workosUserId,
    email: user.email,
  })
}

export async function getAuthContextServer(input: {
  workosUserId: string
  email?: string
}) {
  return runConvexRequestWithRetry("getAuthContextServer", () =>
    getConvexServerClient().query(api.app.getAuthContext, withServerToken(input))
  )
}

export async function getSnapshotServer(input?: {
  workosUserId?: string
  email?: string
}) {
  try {
    return await runConvexRequestWithRetry("getSnapshotServer", () =>
      getConvexServerClient().query(
        api.app.getSnapshot,
        withServerToken(input ?? {})
      )
    )
  } catch (error) {
    throw coerceApplicationError(error, [...SNAPSHOT_ERROR_MAPPINGS]) ?? error
  }
}

export async function getSnapshotVersionServer(input?: {
  workosUserId?: string
  email?: string
}) {
  try {
    return await runConvexRequestWithRetry("getSnapshotVersionServer", () =>
      getConvexServerClient().query(
        api.app.getSnapshotVersion,
        withServerToken(input ?? {})
      )
    )
  } catch (error) {
    throw coerceApplicationError(error, [...SNAPSHOT_ERROR_MAPPINGS]) ?? error
  }
}

export async function getInviteByTokenServer(token: string) {
  return getConvexServerClient().query(
    api.app.getInviteByToken,
    withServerToken({ token })
  )
}

export async function lookupTeamByJoinCodeServer(code: string) {
  return getConvexServerClient().query(
    api.app.lookupTeamByJoinCode,
    withServerToken({ code })
  )
}

export async function listWorkspacesForSyncServer() {
  return getConvexServerClient().query(
    api.app.listWorkspacesForSync,
    withServerToken({})
  )
}

export async function listPendingNotificationDigestsServer() {
  return getConvexServerClient().query(
    api.app.listPendingNotificationDigests,
    withServerToken({})
  )
}
