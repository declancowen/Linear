import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import type { AuthenticatedSession } from "@/lib/server/route-auth"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse } from "@/lib/server/route-response"
import {
  resolveTeamScopeFromSlug,
  type ResolvedTeamScope,
} from "@/lib/server/team-routing"

export type WorkspaceSeedContext = {
  session: AuthenticatedSession
  userId: string
  workspaceId: string
}

export type TeamSeedContext = {
  session: AuthenticatedSession
  userId: string
  teamScope: ResolvedTeamScope
}

/**
 * Resolve the standard auth + workspace context every workspace-scoped RSC
 * route segment needs to build a scoped read-model seed:
 *
 * - the authenticated session (for `loadScopedReadModelForSession` calls)
 * - the current user id (for user-scoped seeds like notification-inbox)
 * - the current workspace id (for workspace-scoped seeds)
 *
 * Returns `null` for any failure mode (missing session, no current user, no
 * current workspace). Route segments should treat `null` as "render nothing,
 * the layout has already redirected".
 *
 * This helper exists to eliminate the per-route duplication of the
 * `requireSession` → `ensureAuthenticatedAppContext` → null-guard chain that
 * every surface page would otherwise repeat.
 */
export async function resolveWorkspaceSeedContext(): Promise<WorkspaceSeedContext | null> {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return null
  }

  const { authContext } = await ensureAuthenticatedAppContext(
    session.user,
    session.organizationId
  )

  const userId = authContext?.currentUser?.id
  const workspaceId = authContext?.currentWorkspace?.id

  if (!userId || !workspaceId) {
    return null
  }

  return { session, userId, workspaceId }
}

/**
 * Resolve auth + team context for `/team/[teamSlug]/...` route segments.
 *
 * Returns `null` if the slug doesn't resolve to a team the user has access
 * to, or if the session/user can't be established.
 */
export async function resolveTeamSeedContext(
  teamSlug: string
): Promise<TeamSeedContext | null> {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return null
  }

  const { authContext } = await ensureAuthenticatedAppContext(
    session.user,
    session.organizationId
  )

  const userId = authContext?.currentUser?.id

  if (!userId) {
    return null
  }

  const teamScope = await resolveTeamScopeFromSlug(session, teamSlug)

  if (!teamScope) {
    return null
  }

  return { session, userId, teamScope }
}
