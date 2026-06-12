"use client"

import { ViewsScreen } from "@/components/app/screens"
import { getTeamBySlug, teamHasFeature } from "@/lib/domain/selectors"
import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import type { AppSnapshot } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

export function TeamViewsClient({
  teamSlug,
  initialSeed,
}: {
  teamSlug: string
  initialSeed: ReadModelFetchResult<Partial<AppSnapshot>> | null
}) {
  const team = useAppStore((state) => getTeamBySlug(state, teamSlug))

  if (!team) {
    return null
  }

  if (!teamHasFeature(team, "views")) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Views are disabled for this team.
      </div>
    )
  }

  return (
    <ViewsScreen
      scopeId={team.id}
      scopeType="team"
      title={`${team.name} views`}
      description="Saved work views with list, board, and timeline layouts."
      initialSeed={initialSeed}
    />
  )
}
