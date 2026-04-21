import { AcceptInviteCard } from "@/components/app/accept-invite-card"
import { JoinWorkspacePanel } from "@/components/app/join-workspace-panel"

type WorkspaceEntryJoinSectionProps = {
  autoAcceptToken?: string
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
    teamNames: string[]
    workspace: {
      logoUrl: string
      name: string
    } | null
  }>
  signupHref?: string
}

export function WorkspaceEntryJoinSection({
  autoAcceptToken,
  joinCode,
  joinedTeamIds,
  loginHref = "/login",
  pendingInvites,
  signupHref = "/signup",
}: WorkspaceEntryJoinSectionProps) {
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Pending invites
          </h2>
          <span className="text-xs text-muted-foreground">
            {pendingInvites.length}
          </span>
        </div>

        {pendingInvites.length > 0 ? (
          <div className="space-y-2">
            {pendingInvites.map((entry) =>
              entry.workspace ? (
                <AcceptInviteCard
                  key={entry.invite.id}
                  authenticated
                  token={entry.invite.token}
                  teamNames={entry.teamNames}
                  workspaceLogo={entry.workspace.logoUrl}
                  workspaceName={entry.workspace.name}
                  inviteEmail={entry.invite.email}
                  loginHref={loginHref}
                  signupHref={signupHref}
                  role={entry.invite.role}
                  expired={false}
                  accepted={Boolean(entry.invite.acceptedAt)}
                  autoAccept={entry.invite.token === autoAcceptToken}
                  showDecline
                />
              ) : null
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No pending invites</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Join with code
        </h2>
        <JoinWorkspacePanel
          authenticated
          initialCode={joinCode}
          joinedTeamIds={joinedTeamIds}
          loginHref={loginHref}
          signupHref={signupHref}
        />
      </div>
    </section>
  )
}
