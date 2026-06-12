import { DocumentDetailScreen } from "@/components/app/screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildDocumentDetailSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const { documentId } = await params
  const ctx = await resolveWorkspaceSeedContext()
  const initialSeed = ctx
    ? await buildDocumentDetailSeed(ctx.session, documentId)
    : null

  return (
    <DocumentDetailScreen documentId={documentId} initialSeed={initialSeed} />
  )
}
