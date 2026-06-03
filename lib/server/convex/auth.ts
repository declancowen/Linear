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

const SCOPED_READ_MODEL_ERROR_MAPPINGS = [
  {
    match:
      /Could not find public function for 'app:(getScopedReadModelVersions|bumpScopedReadModelVersions)'/i,
    status: 503,
    code: "SCOPED_READ_MODELS_UNAVAILABLE",
    message: "Scoped read models are unavailable",
  },
] as const

let hasLoggedScopedReadModelFallback = false

function normalizeScopeKeys(scopeKeys: string[]) {
  return [
    ...new Set(scopeKeys.map((scopeKey) => scopeKey.trim()).filter(Boolean)),
  ]
}

function createZeroVersionEnvelope(scopeKeys: string[]) {
  return {
    versions: normalizeScopeKeys(scopeKeys).map((scopeKey) => ({
      scopeKey,
      version: 0,
    })),
  }
}

function warnScopedReadModelFallback(error: unknown) {
  if (hasLoggedScopedReadModelFallback) {
    return
  }

  hasLoggedScopedReadModelFallback = true
  console.warn(
    "Scoped read model invalidation is unavailable; falling back to snapshot-only refresh",
    error instanceof Error ? { message: error.message } : undefined
  )
}

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
    getConvexServerClient().query(
      api.app.getAuthContext,
      withServerToken(input)
    )
  )
}

export async function listWorkspacesForSyncServer() {
  return runConvexRequestWithRetry("listWorkspacesForSyncServer", () =>
    getConvexServerClient().query(
      api.app.listWorkspacesForSync,
      withServerToken({})
    )
  )
}

export async function consumeDesktopHandoffTicketServer(input: {
  ticketId: string
  expiresAt: number
  consumedAt: number
}) {
  return runConvexRequestWithRetry("consumeDesktopHandoffTicketServer", () =>
    getConvexServerClient().mutation(
      api.app.consumeDesktopHandoffTicket,
      withServerToken(input)
    )
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

export async function getWorkspaceMembershipBootstrapServer(input: {
  workosUserId?: string
  email?: string
  workspaceId: string
}) {
  try {
    return await runConvexRequestWithRetry(
      "getWorkspaceMembershipBootstrapServer",
      () =>
        getConvexServerClient().query(
          api.app.getWorkspaceMembershipBootstrap,
          withServerToken(input)
        )
    )
  } catch (error) {
    throw coerceApplicationError(error, [...SNAPSHOT_ERROR_MAPPINGS]) ?? error
  }
}

export async function getScopedReadModelVersionsServer(input: {
  scopeKeys: string[]
}) {
  try {
    return await runConvexRequestWithRetry(
      "getScopedReadModelVersionsServer",
      () =>
        getConvexServerClient().query(
          api.app.getScopedReadModelVersions,
          withServerToken({
            scopeKeys: input.scopeKeys,
          })
        )
    )
  } catch (error) {
    const applicationError = coerceApplicationError(error, [
      ...SCOPED_READ_MODEL_ERROR_MAPPINGS,
    ])

    if (applicationError?.code === "SCOPED_READ_MODELS_UNAVAILABLE") {
      warnScopedReadModelFallback(error)
      throw applicationError
    }

    throw applicationError ?? error
  }
}

export type ScopedReadModelServerInstruction =
  | { kind: "document-detail"; documentId: string }
  | {
      kind: "document-index"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | { kind: "work-item-detail"; itemId: string }
  | {
      kind: "work-index"
      scopeType: "personal" | "team" | "workspace"
      scopeId: string
    }
  | { kind: "project-detail"; projectId: string }
  | {
      kind: "project-index"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | { kind: "workspace-people"; workspaceId: string }
  | {
      kind: "view-catalog"
      scopeType: "team" | "workspace"
      scopeId: string
    }
  | { kind: "notification-inbox" }
  | { kind: "conversation-list" }
  | { kind: "conversation-thread"; conversationId: string }
  | { kind: "channel-feed"; conversationId: string }
  | { kind: "search-seed"; workspaceId: string }

export type ScopedReadModelScopeKeyServerTarget =
  | { kind: "document"; documentId: string }
  | { kind: "work-item"; itemId: string }
  | { kind: "custom-property-definition"; teamId: string }
  | { kind: "project"; projectId: string }
  | { kind: "view"; viewId: string }
  | { kind: "conversation"; conversationId: string }
  | { kind: "channel-post"; postId: string }
  | { kind: "chat-message"; messageId: string }
  | { kind: "user-workspace-membership"; userId: string }

export async function getScopedReadModelServer(input: {
  workosUserId?: string
  email?: string
  selectedWorkspaceId?: string | null
  instruction: ScopedReadModelServerInstruction
}) {
  try {
    return await runConvexRequestWithRetry("getScopedReadModelServer", () =>
      getConvexServerClient().query(
        api.app.getScopedReadModel,
        withServerToken(input)
      )
    )
  } catch (error) {
    throw coerceApplicationError(error, [...SNAPSHOT_ERROR_MAPPINGS]) ?? error
  }
}

export async function resolveScopedReadModelScopeKeysServer(input: {
  workosUserId?: string
  email?: string
  selectedWorkspaceId?: string | null
  target: ScopedReadModelScopeKeyServerTarget
}) {
  try {
    return await runConvexRequestWithRetry(
      "resolveScopedReadModelScopeKeysServer",
      () =>
        getConvexServerClient().query(
          api.app.resolveScopedReadModelScopeKeys,
          withServerToken(input)
        )
    )
  } catch (error) {
    throw coerceApplicationError(error, [...SNAPSHOT_ERROR_MAPPINGS]) ?? error
  }
}

export async function authorizeScopedReadModelScopeKeysConvexServer(input: {
  workosUserId?: string
  email?: string
  selectedWorkspaceId?: string | null
  scopeKeys: string[]
}) {
  try {
    return await runConvexRequestWithRetry(
      "authorizeScopedReadModelScopeKeysConvexServer",
      () =>
        getConvexServerClient().query(
          api.app.authorizeScopedReadModelScopeKeys,
          withServerToken(input)
        )
    )
  } catch (error) {
    throw coerceApplicationError(error, [...SNAPSHOT_ERROR_MAPPINGS]) ?? error
  }
}

export async function bumpScopedReadModelVersionsServer(input: {
  scopeKeys: string[]
}) {
  try {
    return await runConvexRequestWithRetry(
      "bumpScopedReadModelVersionsServer",
      () =>
        getConvexServerClient().mutation(
          api.app.bumpScopedReadModelVersions,
          withServerToken({
            scopeKeys: input.scopeKeys,
          })
        )
    )
  } catch (error) {
    const applicationError = coerceApplicationError(error, [
      ...SCOPED_READ_MODEL_ERROR_MAPPINGS,
    ])

    if (applicationError?.code === "SCOPED_READ_MODELS_UNAVAILABLE") {
      warnScopedReadModelFallback(error)
      return createZeroVersionEnvelope(input.scopeKeys)
    }

    throw applicationError ?? error
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
