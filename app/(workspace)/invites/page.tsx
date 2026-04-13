import { withAuth } from "@workos-inc/authkit-nextjs"
import { LinkSimple } from "@phosphor-icons/react/dist/ssr"

import { AcceptInviteCard } from "@/components/app/accept-invite-card"
import { JoinWorkspacePanel } from "@/components/app/join-workspace-panel"
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

      <JoinWorkspacePanel
        authenticated
        initialCode={joinCode}
        joinedTeamIds={joinedTeamIds}
      />

      {/* Pending invites */}
      {pendingInvites.length === 0 ? (
        <div className="mx-auto w-full max-w-lg rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No pending invites</p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-lg rounded-lg border border-border/70 bg-card">
          <div className="border-b px-4 py-3">
            <span className="text-sm font-medium">Pending invites</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {pendingInvites.length}
            </span>
          </div>
          <div className="divide-y">
            {pendingInvites.map((entry) =>
              entry.team && entry.workspace ? (
                <AcceptInviteCard
                  key={entry.invite.id}
                  authenticated
                  token={entry.invite.token}
                  teamName={entry.team.name}
                  workspaceName={entry.workspace.name}
                  inviteEmail={entry.invite.email}
                  loginHref="/login"
                  signupHref="/signup"
                  role={entry.invite.role}
                  expired={false}
                  accepted={Boolean(entry.invite.acceptedAt)}
                  showDecline
                  className="rounded-none border-0 shadow-none"
                />
              ) : null
            )}
          </div>
        </div>
      )}
    </main>
  )
}
