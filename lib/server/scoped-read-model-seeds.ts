import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import type { AppSnapshot } from "@/lib/domain/types"
import type { ScopedReadModelReplaceInstruction } from "@/lib/scoped-sync/read-models"
import type { ScopedReadModelServerInstruction } from "@/lib/server/convex"
import { logProviderError } from "@/lib/server/provider-errors"
import type { AuthenticatedSession } from "@/lib/server/route-auth"
import { loadScopedReadModelForSession } from "@/lib/server/scoped-read-model-route-handlers"

/**
 * A scoped read-model seed produced on the server, ready to be passed into a
 * client component as the `initialSeed` for `useScopedReadModelRefresh`.
 *
 * The shape mirrors the client `ReadModelFetchResult` exactly so the same
 * merge/replace contract applies on both sides: `data` is the patch to merge
 * into the app store, `replace` lists the scoped collections that should be
 * fully replaced rather than merged.
 */
type ScopedReadModelSeed = ReadModelFetchResult<Partial<AppSnapshot>>

type ServerSeedSpec = {
  instruction: ScopedReadModelServerInstruction
  replace: ScopedReadModelReplaceInstruction[]
}

/**
 * Internal generic seed builder. Loads a scoped read model on the server using
 * the same auth context the corresponding `/api/read-models/*` route handler
 * would use, then wraps it in the same `{ data, replace }` shape the client
 * fetcher returns.
 *
 * Returns `null` when the read model cannot be loaded so route segments can
 * gracefully fall back to a client-only fetch path. Failures are logged via
 * `logProviderError` so SSR seed regressions are observable in production.
 */
async function buildScopedReadModelSeed(
  session: AuthenticatedSession,
  spec: ServerSeedSpec
): Promise<ScopedReadModelSeed | null> {
  try {
    const data = await loadScopedReadModelForSession(session, spec.instruction)

    if (!data) {
      return null
    }

    return {
      data: data as Partial<AppSnapshot>,
      replace: spec.replace,
    }
  } catch (error) {
    logProviderError(
      `[server] failed to build scoped read-model seed (${spec.instruction.kind})`,
      error
    )
    return null
  }
}

export function buildDocumentIndexSeed(
  session: AuthenticatedSession,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return buildScopedReadModelSeed(session, {
    instruction: { kind: "document-index", scopeType, scopeId },
    replace: [{ kind: "document-index", scopeType, scopeId }],
  })
}

export function buildDocumentDetailSeed(
  session: AuthenticatedSession,
  documentId: string
) {
  return buildScopedReadModelSeed(session, {
    instruction: { kind: "document-detail", documentId },
    replace: [{ kind: "document-detail", documentId }],
  })
}

export function buildWorkIndexSeed(
  session: AuthenticatedSession,
  scopeType: "team" | "workspace" | "personal",
  scopeId: string
) {
  return buildScopedReadModelSeed(session, {
    instruction: { kind: "work-index", scopeType, scopeId },
    replace: [{ kind: "work-index", scopeType, scopeId }],
  })
}

export function buildWorkItemDetailSeed(
  session: AuthenticatedSession,
  itemId: string
) {
  return buildScopedReadModelSeed(session, {
    instruction: { kind: "work-item-detail", itemId },
    replace: [{ kind: "work-item-detail", itemId }],
  })
}

export function buildProjectIndexSeed(
  session: AuthenticatedSession,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return buildScopedReadModelSeed(session, {
    instruction: { kind: "project-index", scopeType, scopeId },
    replace: [{ kind: "project-index", scopeType, scopeId }],
  })
}

export function buildProjectDetailSeed(
  session: AuthenticatedSession,
  projectId: string
) {
  return buildScopedReadModelSeed(session, {
    instruction: { kind: "project-detail", projectId },
    replace: [{ kind: "project-detail", projectId }],
  })
}

export function buildViewCatalogSeed(
  session: AuthenticatedSession,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  return buildScopedReadModelSeed(session, {
    instruction: { kind: "view-catalog", scopeType, scopeId },
    replace: [{ kind: "view-catalog", scopeType, scopeId }],
  })
}

export function buildWorkspacePeopleSeed(
  session: AuthenticatedSession,
  workspaceId: string
) {
  return buildScopedReadModelSeed(session, {
    instruction: { kind: "workspace-people", workspaceId },
    replace: [{ kind: "workspace-people", workspaceId }],
  })
}

/**
 * Notification-inbox is scoped to the current user. The replace instruction
 * needs the userId, which the client derives from the store; on the server,
 * callers must pass it from the authenticated app context.
 */
export function buildNotificationInboxSeed(
  session: AuthenticatedSession,
  userId: string
) {
  return buildScopedReadModelSeed(session, {
    instruction: { kind: "notification-inbox" },
    replace: [{ kind: "notification-inbox", userId }],
  })
}

/**
 * Conversation-list is scoped to the current user (same as notification-inbox).
 * Used for /chats and as the parent step of the channel/chat surface seed:
 * load the list, derive the active conversation id from it client-side, then
 * fetch the corresponding thread or channel feed via the existing client
 * fetcher.
 */
export function buildConversationListSeed(
  session: AuthenticatedSession,
  userId: string
) {
  return buildScopedReadModelSeed(session, {
    instruction: { kind: "conversation-list" },
    replace: [{ kind: "conversation-list", userId }],
  })
}
