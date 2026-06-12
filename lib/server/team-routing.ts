import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { getWorkspaceMembershipBootstrapServer } from "@/lib/server/convex"
import { logProviderError } from "@/lib/server/provider-errors"
import type { AuthenticatedSession } from "@/lib/server/route-auth"

export type ResolvedTeamScope = {
  teamId: string
  workspaceId: string
  teamSlug: string
}

/**
 * Resolve a team-slug from a `/team/[teamSlug]/...` route segment to its
 * stable team id (and owning workspace id) on the server, so route segments
 * can seed team-scoped read models without first rendering on the client to
 * read the slug-to-id mapping out of the app store.
 *
 * Sources the current workspace from the authenticated app context (the same
 * source the workspace layout uses) and reuses
 * `getWorkspaceMembershipBootstrapServer` rather than introducing a new
 * Convex query, keeping team-routing inside the existing membership
 * read-model boundary.
 *
 * Returns `null` when the slug doesn't match any accessible team in the
 * current workspace, or when the workspace context cannot be established.
 * Route segments should treat that as a 404 condition.
 */
export async function resolveTeamScopeFromSlug(
  session: AuthenticatedSession,
  teamSlug: string
): Promise<ResolvedTeamScope | null> {
  const trimmedSlug = teamSlug.trim()

  if (!trimmedSlug) {
    return null
  }

  const { authContext } = await ensureAuthenticatedAppContext(
    session.user,
    session.organizationId
  )

  const workspaceId = authContext?.currentWorkspace?.id

  if (!workspaceId) {
    return null
  }

  let workspaceMembership: Awaited<
    ReturnType<typeof getWorkspaceMembershipBootstrapServer>
  > | null = null

  try {
    workspaceMembership = await getWorkspaceMembershipBootstrapServer({
      workosUserId: session.user.id,
      email: session.user.email ?? undefined,
      workspaceId,
    })
  } catch (error) {
    logProviderError(
      "[server] failed to load workspace membership for team-slug resolution",
      error
    )
    return null
  }

  const team = (workspaceMembership?.teams ?? []).find(
    (entry) => entry.slug === trimmedSlug
  )

  if (!team) {
    return null
  }

  return {
    teamId: team.id,
    workspaceId: team.workspaceId,
    teamSlug: team.slug,
  }
}
