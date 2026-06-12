import { TeamWorkScreen } from "@/components/app/screens"
import { resolveTeamSeedContext } from "@/lib/server/page-seed-context"
import { buildWorkIndexSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function TeamWorkPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>
}) {
  const { teamSlug } = await params
  const ctx = await resolveTeamSeedContext(teamSlug)
  const initialSeed = ctx
    ? await buildWorkIndexSeed(ctx.session, "team", ctx.teamScope.teamId)
    : null

  return <TeamWorkScreen teamSlug={teamSlug} initialSeed={initialSeed} />
}
