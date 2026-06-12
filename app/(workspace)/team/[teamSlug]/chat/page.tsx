import { TeamChatScreen } from "@/components/app/collaboration-screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildConversationListSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function TeamChatPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>
}) {
  const { teamSlug } = await params
  const ctx = await resolveWorkspaceSeedContext()

  if (!ctx) {
    return null
  }

  const initialSeed = await buildConversationListSeed(ctx.session, ctx.userId)

  return <TeamChatScreen teamSlug={teamSlug} initialSeed={initialSeed} />
}
