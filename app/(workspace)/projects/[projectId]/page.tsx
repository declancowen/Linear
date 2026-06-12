import { ProjectDetailRedirector } from "@/components/app/screens/project-detail-redirector"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildProjectDetailSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await resolveWorkspaceSeedContext()
  const initialSeed = ctx
    ? await buildProjectDetailSeed(ctx.session, projectId)
    : null

  return (
    <ProjectDetailRedirector projectId={projectId} initialSeed={initialSeed} />
  )
}
