import { PeopleProfileScreen } from "@/components/app/people-screen"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildWorkspacePeopleSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function WorkspacePersonPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const ctx = await resolveWorkspaceSeedContext()

  if (!ctx) {
    return null
  }

  const initialSeed = await buildWorkspacePeopleSeed(
    ctx.session,
    ctx.workspaceId
  )

  return <PeopleProfileScreen userId={userId} initialSeed={initialSeed} />
}
