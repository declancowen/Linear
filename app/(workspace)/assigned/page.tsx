import { AssignedScreen } from "@/components/app/screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildWorkIndexSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function AssignedPage() {
  const ctx = await resolveWorkspaceSeedContext()

  if (!ctx) {
    return null
  }

  const initialSeed = await buildWorkIndexSeed(
    ctx.session,
    "personal",
    ctx.userId
  )

  return <AssignedScreen initialSeed={initialSeed} />
}
