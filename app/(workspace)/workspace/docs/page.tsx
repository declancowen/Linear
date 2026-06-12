import { DocsScreen } from "@/components/app/screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildDocumentIndexSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function WorkspaceDocsPage() {
  const ctx = await resolveWorkspaceSeedContext()

  if (!ctx) {
    return null
  }

  const initialSeed = await buildDocumentIndexSeed(
    ctx.session,
    "workspace",
    ctx.workspaceId
  )

  return (
    <DocsScreen
      scopeId={ctx.workspaceId}
      scopeType="workspace"
      title="Docs"
      description="Aggregate team-owned documents visible from the workspace."
      initialSeed={initialSeed}
    />
  )
}
