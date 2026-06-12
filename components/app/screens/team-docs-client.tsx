"use client"

import { DocsScreen } from "@/components/app/screens"
import { getTeamBySlug } from "@/lib/domain/selectors"
import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import type { AppSnapshot } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

/**
 * Renders {@link DocsScreen} for a team route segment.
 *
 * Kept as a thin client wrapper because `DocsScreen` needs the full Team
 * object (used by view derivation, route key, scope discriminators) and the
 * Team is sourced from the app store (already populated by the workspace
 * layout's `workspace-membership` seed). The route segment that owns this
 * route can stay an RSC and pass through the document-index seed it built on
 * the server.
 */
export function TeamDocsClient({
  teamSlug,
  title,
  description,
  initialSeed,
}: {
  teamSlug: string
  title: string
  description: string
  initialSeed: ReadModelFetchResult<Partial<AppSnapshot>> | null
}) {
  const team = useAppStore((state) => getTeamBySlug(state, teamSlug))

  if (!team) {
    return null
  }

  return (
    <DocsScreen
      scopeId={team.id}
      scopeType="team"
      team={team}
      title={title}
      description={description}
      initialSeed={initialSeed}
    />
  )
}
