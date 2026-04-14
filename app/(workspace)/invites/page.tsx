import { withAuth } from "@workos-inc/authkit-nextjs"
import { LinkSimple } from "@phosphor-icons/react/dist/ssr"

import { WorkspaceEntryJoinSection } from "@/components/app/workspace-entry-join-section"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

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
  const { authContext } = await ensureAuthenticatedAppContext(
    auth.user,
    auth.organizationId
  )
  const pendingInvites = authContext?.pendingInvites ?? []
  const joinedTeamIds =
    authContext?.memberships.map((entry) => entry.teamId) ?? []

  return (
    <main className="flex w-full flex-col gap-6 px-6 py-8">
      <header className="mx-auto w-full max-w-lg text-center">
        <div className="flex items-center justify-center gap-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          <LinkSimple className="size-3" />
          Join workspace
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Join a team
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a 12-character code or open an invite.
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
