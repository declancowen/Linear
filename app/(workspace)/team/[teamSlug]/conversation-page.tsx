import type { ComponentType } from "react"

import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildConversationListSeed } from "@/lib/server/scoped-read-model-seeds"

type TeamConversationPageProps = {
  params: Promise<{ teamSlug: string }>
}

type TeamConversationScreenProps = {
  teamSlug: string
  initialSeed: Awaited<ReturnType<typeof buildConversationListSeed>>
}

export function createTeamConversationPage(
  Screen: ComponentType<TeamConversationScreenProps>,
  resolveSeedContext: typeof resolveWorkspaceSeedContext,
  buildSeed: typeof buildConversationListSeed
) {
  return async function TeamConversationPage({
    params,
  }: TeamConversationPageProps) {
    const { teamSlug } = await params
    const ctx = await resolveSeedContext()

    if (!ctx) {
      return null
    }

    const initialSeed = await buildSeed(ctx.session, ctx.userId)

    return <Screen teamSlug={teamSlug} initialSeed={initialSeed} />
  }
}
