import { WorkItemDetailScreen } from "@/components/app/screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildWorkItemDetailSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function WorkItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params
  const ctx = await resolveWorkspaceSeedContext()
  const initialSeed = ctx
    ? await buildWorkItemDetailSeed(ctx.session, itemId)
    : null

  return <WorkItemDetailScreen itemId={itemId} initialSeed={initialSeed} />
}
