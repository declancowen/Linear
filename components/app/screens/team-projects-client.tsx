"use client"

import { ProjectsScreen } from "@/components/app/screens"
import { getTeamBySlug } from "@/lib/domain/selectors"
import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import type { AppSnapshot } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

export function TeamProjectsClient({
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

  return (
    <ProjectsScreen
      scopeId={team.id}
      scopeType="team"
      team={team}
      title={`${team.name} projects`}
      description="Projects owned by the current team, with linked work and child work rolled up together."
      initialSeed={initialSeed}
    />
  )
}
