import { WorkspaceItemsScreen } from "@/components/app/screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildWorkIndexSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function WorkspaceItemsPage() {
  const ctx = await resolveWorkspaceSeedContext()

  if (!ctx) {
    return null
  }

  const initialSeed = await buildWorkIndexSeed(
    ctx.session,
    "workspace",
    ctx.workspaceId
  )

  return <WorkspaceItemsScreen initialSeed={initialSeed} />
}
