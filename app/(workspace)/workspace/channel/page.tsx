import { WorkspaceChannelsScreen } from "@/components/app/collaboration-screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildConversationListSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function WorkspaceChannelPage() {
  const ctx = await resolveWorkspaceSeedContext()

  if (!ctx) {
    return null
  }

  const initialSeed = await buildConversationListSeed(ctx.session, ctx.userId)

  return <WorkspaceChannelsScreen initialSeed={initialSeed} />
}
