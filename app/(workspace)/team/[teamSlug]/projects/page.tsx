import { TeamProjectsClient } from "@/components/app/screens/team-projects-client"
import { resolveTeamSeedContext } from "@/lib/server/page-seed-context"
import { buildProjectIndexSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function TeamProjectsPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>
}) {
  const { teamSlug } = await params
  const ctx = await resolveTeamSeedContext(teamSlug)
  const initialSeed = ctx
    ? await buildProjectIndexSeed(ctx.session, "team", ctx.teamScope.teamId)
    : null

  return <TeamProjectsClient teamSlug={teamSlug} initialSeed={initialSeed} />
}
