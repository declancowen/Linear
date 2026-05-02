import { withAuth } from "@workos-inc/authkit-nextjs"

import { WorkspaceEntryJoinSection } from "@/components/app/workspace-entry-join-section"
import { getWorkspaceEntryJoinState } from "@/lib/server/authenticated-app"

type InvitesPageProps = {
  searchParams: Promise<{
    code?: string
  }>
}

export default async function InvitesPage({ searchParams }: InvitesPageProps) {
  const auth = await withAuth()

  if (!auth.user) {
    return null
  }

  const params = await searchParams
  const joinCode = params.code?.trim()
  const { joinedTeamIds, pendingInvites } = await getWorkspaceEntryJoinState(
    auth.user,
    auth.organizationId
  )

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-6 overflow-y-auto px-6 py-8">
      <header className="mx-auto w-full max-w-lg text-center">
        <h1 className="text-xl font-semibold tracking-tight">Join a team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accept a pending invite or enter a team code.
        </p>
      </header>

      <WorkspaceEntryJoinSection
        joinCode={joinCode}
        joinedTeamIds={joinedTeamIds}
        pendingInvites={pendingInvites}
      />
    </main>
  )
}
