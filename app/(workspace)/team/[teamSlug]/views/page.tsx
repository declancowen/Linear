import { TeamViewsClient } from "@/components/app/screens/team-views-client"
import { resolveTeamSeedContext } from "@/lib/server/page-seed-context"
import { buildViewCatalogSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function TeamViewsPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>
}) {
  const { teamSlug } = await params
  const ctx = await resolveTeamSeedContext(teamSlug)
  const initialSeed = ctx
    ? await buildViewCatalogSeed(ctx.session, "team", ctx.teamScope.teamId)
    : null

  return <TeamViewsClient teamSlug={teamSlug} initialSeed={initialSeed} />
}
