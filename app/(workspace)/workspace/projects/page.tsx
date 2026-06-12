import { ProjectsScreen } from "@/components/app/screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildProjectIndexSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function WorkspaceProjectsPage() {
  const ctx = await resolveWorkspaceSeedContext()

  if (!ctx) {
    return null
  }

  const initialSeed = await buildProjectIndexSeed(
    ctx.session,
    "workspace",
    ctx.workspaceId
  )

  return (
    <ProjectsScreen
      scopeId={ctx.workspaceId}
      scopeType="workspace"
      title="Workspace projects"
      description="Projects across the teams you belong to, aggregated into a single workspace view."
      initialSeed={initialSeed}
    />
  )
}
