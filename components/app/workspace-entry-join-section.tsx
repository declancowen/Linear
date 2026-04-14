import { AcceptInviteCard } from "@/components/app/accept-invite-card"
import { JoinWorkspacePanel } from "@/components/app/join-workspace-panel"

type WorkspaceEntryJoinSectionProps = {
  joinCode?: string
  joinedTeamIds: string[]
  loginHref?: string
  pendingInvites: Array<{
    invite: {
      acceptedAt: string | null
      email: string
      id: string
      role: string
      token: string
    }
    team: {
      name: string
    } | null
    workspace: {
      name: string
    } | null
  }>
  signupHref?: string
}

export function WorkspaceEntryJoinSection({
  joinCode,
  joinedTeamIds,
  loginHref = "/login",
  pendingInvites,
  signupHref = "/signup",
}: WorkspaceEntryJoinSectionProps) {
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-6">
      {pendingInvites.length > 0 ? (
        <>
          <div className="rounded-lg border border-border/70 bg-card">
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
                    loginHref={loginHref}
                    signupHref={signupHref}
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

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/70" />
            <span className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Or join with code
            </span>
            <div className="h-px flex-1 bg-border/70" />
          </div>
        </>
      ) : null}

      <JoinWorkspacePanel
        authenticated
        initialCode={joinCode}
        joinedTeamIds={joinedTeamIds}
        loginHref={loginHref}
        signupHref={signupHref}
      />
    </section>
  )
}
