import { withAuth } from "@workos-inc/authkit-nextjs"
import {
  Compass,
  LinkSimple,
  LockSimple,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AcceptInviteCard } from "@/components/app/accept-invite-card"
import { OnboardingJoinCard } from "@/components/app/onboarding-join-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  buildAppDestination,
  buildPortalAuthHref,
  getAppModeFromHeaders,
} from "@/lib/portal"
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
  const requestHeaders = await headers()

  if (getAppModeFromHeaders(requestHeaders) === "portal") {
    redirect(buildAppDestination("projects", nextPath))
  }

  const loginHref = buildPortalAuthHref("login", "projects", nextPath)
  const signupHref = buildPortalAuthHref("signup", "projects", nextPath)
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

  if (authContext?.currentWorkspace) {
    redirect("/inbox")
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.15),_transparent_30%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.35))] px-6 py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <Compass className="size-3.5" />
              Onboarding
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">
              Finish setup before entering your first workspace.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              New accounts need team-derived workspace access. Accept an invite card
              or search a team code or team id to join as a viewer.
            </p>
          </div>

          <Card className="border-border/70 bg-card/75 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl">Find a workspace team</CardTitle>
              <CardDescription>
                Enter a team code, team slug, or team id to look up the workspace
                and team you should join.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form className="flex flex-col gap-3 sm:flex-row" action="/onboarding">
                {inviteToken ? (
                  <input type="hidden" name="invite" value={inviteToken} />
                ) : null}
                <div className="flex-1 space-y-2">
                  <Label htmlFor="code">Team code or id</Label>
                  <Input
                    id="code"
                    name="code"
                    defaultValue={joinCode ?? ""}
                    placeholder="Enter team code or id"
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
                  No team matched <span className="font-medium text-foreground">{joinCode}</span>.
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
        </section>

        <section className="space-y-6">
          {inviteToken && inviteData?.team && inviteData.workspace ? (
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
            />
          ) : (
            <Card className="border-border/70 bg-card/75 shadow-none backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  {auth.user ? (
                    <LinkSimple className="size-4" />
                  ) : (
                    <LockSimple className="size-4" />
                  )}
                  {auth.user ? "Invite Links" : "Sign in to continue"}
                </CardTitle>
                <CardDescription>
                  {auth.user
                    ? "Invite links deep-link into this onboarding step. Once you sign up, the matching workspace and team card appears here and accepts into the dashboard."
                    : "Use the same invite or team lookup after authentication. The workspace and team card will stay attached to this onboarding path."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                {auth.user ? (
                  <>
                    <p>
                      Team invites keep access team-scoped. Direct sign-up without an
                      invite still works, but you must join through a team code first.
                    </p>
                    <form action="/auth/logout" method="post">
                      <Button type="submit" variant="outline" className="w-full">
                        Use a different account
                      </Button>
                    </form>
                  </>
                ) : (
                  <>
                    <p>
                      New users without an invite still need a team-linked code before
                      entering a workspace. Sign in or create an account, then accept
                      the matching workspace and team card here.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button asChild className="w-full">
                        <a href={signupHref}>Create account</a>
                      </Button>
                      <Button asChild variant="outline" className="w-full">
                        <a href={loginHref}>Sign in</a>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  )
}
