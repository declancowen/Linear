import { InboxScreen } from "@/components/app/screens"
import { resolveWorkspaceSeedContext } from "@/lib/server/page-seed-context"
import { buildNotificationInboxSeed } from "@/lib/server/scoped-read-model-seeds"

export default async function InboxPage() {
  const ctx = await resolveWorkspaceSeedContext()

  if (!ctx) {
    return null
  }

  const initialSeed = await buildNotificationInboxSeed(ctx.session, ctx.userId)

  return <InboxScreen initialSeed={initialSeed} />
}
