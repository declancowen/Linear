import { PeopleScreen } from "@/components/app/people-screen"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildWorkspacePeopleSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function WorkspacePeoplePage() {
  const ctx = await resolveWorkspaceSeedContext()

  if (!ctx) {
    return null
  }

  const initialSeed = await buildWorkspacePeopleSeed(
    ctx.session,
    ctx.workspaceId
  )

  return <PeopleScreen initialSeed={initialSeed} />
}
