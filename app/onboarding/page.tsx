import { withAuth } from "@workos-inc/authkit-nextjs"
import {
  Buildings,
  Compass,
  LinkSimple,
  MagnifyingGlass,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr"
import { redirect } from "next/navigation"

import { AcceptInviteCard } from "@/components/app/accept-invite-card"
import { AuthLogo } from "@/components/app/auth-logo"
import { JoinWorkspacePanel } from "@/components/app/join-workspace-panel"
import { OnboardingJoinCard } from "@/components/app/onboarding-join-card"
import { OnboardingTeamForm } from "@/components/app/onboarding-team-form"
import { OnboardingWorkspaceForm } from "@/components/app/onboarding-workspace-form"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buildAuthHref } from "@/lib/auth-routing"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  getInviteByTokenServer,
  lookupTeamByJoinCodeServer,
} from "@/lib/server/convex"

type OnboardingPageProps = {
  searchParams: Promise<{
    code?: string
    invite?: string
  }>
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const auth = await withAuth()
  const params = await searchParams
  const inviteToken = params.invite?.trim()
  const joinCode = params.code?.trim()
  const nextParams = new URLSearchParams()

  if (inviteToken) {
    nextParams.set("invite", inviteToken)
  }

  if (joinCode) {
    nextParams.set("code", joinCode)
  }

  const nextPath = `/onboarding${nextParams.size > 0 ? `?${nextParams.toString()}` : ""}`
  const loginHref = buildAuthHref("login", nextPath)
  const signupHref = buildAuthHref("signup", nextPath)
  const inviteData = inviteToken
    ? await getInviteByTokenServer(inviteToken)
    : null
  const joinResult = joinCode ? await lookupTeamByJoinCodeServer(joinCode) : null
  const authContext = auth.user
    ? (
        await ensureAuthenticatedAppContext(
          auth.user,
          auth.organizationId
        )
      ).authContext
    : null

  if (authContext?.onboardingState === "ready" && !inviteToken) {
    redirect("/workspace/projects")
  }

  const pendingInvites =
    authContext?.pendingInvites.filter(
      (entry) => !inviteToken || entry.invite.token !== inviteToken
    ) ?? []

  if (
    authContext?.onboardingState === "needs-team" &&
    authContext.pendingWorkspace
  ) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.4))] px-6 py-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <Compass className="size-3.5" />
              Workspace Setup
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight">
              Create the first team before entering {authContext.pendingWorkspace.name}.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              This workspace exists, but it is not usable until the first team is
              created. If you sign out and come back, you will return to this step.
            </p>
          </div>

          <OnboardingTeamForm
            workspaceName={authContext.pendingWorkspace.name}
          />
        </div>
      </main>
    )
  }

  if (inviteToken) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
        <div className="flex w-full max-w-lg flex-col gap-6">
          <AuthLogo />

          <header className="text-center">
            <div className="flex items-center justify-center gap-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              <LinkSimple className="size-3" />
              Join workspace
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              Join a team
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Open your invite to join the shared workspace.
            </p>
          </header>

          {inviteData?.team &&
          inviteData.workspace &&
          !inviteData.invite.declinedAt ? (
            <AcceptInviteCard
              authenticated={Boolean(auth.user)}
              token={inviteToken}
              teamName={inviteData.team.name}
              workspaceName={inviteData.workspace.name}
              inviteEmail={inviteData.invite.email}
              loginHref={loginHref}
              signupHref={signupHref}
              role={inviteData.invite.role}
              expired={false}
              accepted={Boolean(inviteData.invite.acceptedAt)}
              autoAccept={Boolean(auth.user)}
              className="bg-card"
            />
          ) : (
            <Card className="shadow-none">
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Invite not found</CardTitle>
                <CardDescription>
                  This invite link is no longer valid. Ask for a fresh invite or
                  sign in to check your pending invites.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <section className="space-y-3 text-center">
            <div className="space-y-1">
              <CardTitle className="text-xl">Join with a team code</CardTitle>
              <CardDescription>
                You can also enter the same 12-character code used in the app.
              </CardDescription>
            </div>
            <JoinWorkspacePanel
              authenticated={Boolean(auth.user)}
              initialCode={joinCode}
              joinedTeamIds={authContext?.memberships.map((entry) => entry.teamId) ?? []}
              loginHref={loginHref}
              signupHref={signupHref}
            />
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.4))] px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
            <Compass className="size-3.5" />
            Onboarding
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight">
            Create a workspace or join one with an invite or team code.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            New accounts start here. Create the workspace first and then the first
            team, or join an existing workspace through an invite or 12-character
            team code.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <OnboardingWorkspaceForm
              authenticated={Boolean(auth.user)}
              loginHref={loginHref}
              signupHref={signupHref}
            />

            {pendingInvites.length > 0 ? (
              <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <LinkSimple className="size-4" />
                    Pending invites
                  </CardTitle>
                  <CardDescription>
                    Accept or decline the workspaces and teams already shared with
                    you.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingInvites.map((entry) =>
                    entry.team && entry.workspace ? (
                      <AcceptInviteCard
                        key={entry.invite.id}
                        authenticated={Boolean(auth.user)}
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
                        className="border border-border/70 bg-background/70"
                      />
                    ) : null
                  )}
                </CardContent>
              </Card>
            ) : null}
          </section>

          <section className="space-y-6">
            <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <UsersThree className="size-4" />
                  Join with a team code
                </CardTitle>
                <CardDescription>
                  Search by team code, team slug, or team id. Joining through a
                  code adds you as a viewer unless a direct invite upgrades your
                  role.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form className="flex flex-col gap-3 sm:flex-row" action="/onboarding">
                  {inviteToken ? (
                    <input type="hidden" name="invite" value={inviteToken} />
                  ) : null}
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="code">Team code or slug</Label>
                    <Input
                      id="code"
                      name="code"
                      defaultValue={joinCode ?? ""}
                      placeholder="Enter a team code or slug"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full sm:w-auto">
                      <MagnifyingGlass className="size-4" />
                      Search
                    </Button>
                  </div>
                </form>

                {joinCode && !joinResult ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                    No team matched{" "}
                    <span className="font-medium text-foreground">{joinCode}</span>.
                  </div>
                ) : null}

                {joinResult ? (
                  <OnboardingJoinCard
                    authenticated={Boolean(auth.user)}
                    joinCode={joinResult.team.joinCode}
                    loginHref={loginHref}
                    signupHref={signupHref}
                    teamName={joinResult.team.name}
                    teamSummary={joinResult.team.summary}
                    workspaceLogo={joinResult.workspace.logoUrl}
                    workspaceName={joinResult.workspace.name}
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Buildings className="size-4" />
                  How access works
                </CardTitle>
                <CardDescription>
                  Invites start at the workspace level and always connect to a
                  team.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Invite links can drop you straight into the shared team.</p>
                <p>Code-based joins default to viewer access until an invite upgrades your role.</p>
                <p>If you already belong to a workspace, pending invites remain available from the workspace menu in the app.</p>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  )
}
