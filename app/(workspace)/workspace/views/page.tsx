import { ViewsScreen } from "@/components/app/screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildViewCatalogSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function WorkspaceViewsPage() {
  const ctx = await resolveWorkspaceSeedContext()

  if (!ctx) {
    return null
  }

  const initialSeed = await buildViewCatalogSeed(
    ctx.session,
    "workspace",
    ctx.workspaceId
  )

  return (
    <ViewsScreen
      scopeId={ctx.workspaceId}
      scopeType="workspace"
      title="Workspace views"
      description="Saved workspace and team views across the teams you belong to."
      initialSeed={initialSeed}
    />
  )
}
