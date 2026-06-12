import { TeamDocsClient } from "@/components/app/screens/team-docs-client"
import { resolveTeamSeedContext } from "@/lib/server/page-seed-context"
import { buildDocumentIndexSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function TeamDocsPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>
}) {
  const { teamSlug } = await params
  const ctx = await resolveTeamSeedContext(teamSlug)
  const initialSeed = ctx
    ? await buildDocumentIndexSeed(ctx.session, "team", ctx.teamScope.teamId)
    : null

  return (
    <TeamDocsClient
      teamSlug={teamSlug}
      title="Docs"
      description="Free-standing team documents with workspace aggregation."
      initialSeed={initialSeed}
    />
  )
}
