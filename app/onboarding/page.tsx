import Link from "next/link"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { LinkSimple } from "@phosphor-icons/react/dist/ssr"
import { redirect } from "next/navigation"

import { AcceptInviteCard } from "@/components/app/accept-invite-card"
import { OnboardingWorkspaceForm } from "@/components/app/onboarding-workspace-form"
import { WorkspaceEntryJoinSection } from "@/components/app/workspace-entry-join-section"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buildAuthHref, buildSessionResolvePath } from "@/lib/auth-routing"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { getInviteByTokenServer } from "@/lib/server/convex"

type OnboardingPageProps = {
  searchParams: Promise<{
    code?: string
    invite?: string
    validated?: string
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

  const validatedNextParams = new URLSearchParams(nextParams)
  validatedNextParams.set("validated", "1")
  const nextPath = `/onboarding${nextParams.size > 0 ? `?${nextParams.toString()}` : ""}`
  const loginHref = buildAuthHref("login", nextPath)

  if (auth.user && params.validated !== "1") {
    redirect(
      buildSessionResolvePath({
        mode: "login",
        nextPath: `/onboarding?${validatedNextParams.toString()}`,
      })
    )
  }

  if (!auth.user) {
    redirect(loginHref)
  }

  const inviteData = inviteToken
    ? await getInviteByTokenServer(inviteToken)
    : null
  const { authContext } = await ensureAuthenticatedAppContext(
    auth.user,
    auth.organizationId
  )

  const pendingInvites =
    authContext?.pendingInvites.filter(
      (entry) => !inviteToken || entry.invite.token !== inviteToken
    ) ?? []
  const joinedTeamIds =
    authContext?.memberships.map((entry) => entry.teamId) ?? []
  const currentWorkspace = authContext?.currentWorkspace ?? null

  if (
    currentWorkspace &&
    !inviteToken &&
    !joinCode &&
    pendingInvites.length === 0
  ) {
    redirect("/workspace/projects")
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.4))] px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="space-y-2">
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Create or join a workspace.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Create one, accept an invite, or join with a team code.
          </p>
        </div>

        {currentWorkspace ? (
          <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl">
                You already belong to {currentWorkspace.name}
              </CardTitle>
              <CardDescription>
                Go to your dashboard or join another team below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/workspace/projects"
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                Go to workspace
              </Link>
            </CardContent>
          </Card>
        ) : (
          <OnboardingWorkspaceForm />
        )}

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border/70" />
          <span className="text-[10px] font-medium tracking-[0.24em] text-muted-foreground uppercase">
            Join Workspace
          </span>
          <div className="h-px flex-1 bg-border/70" />
        </div>

        <div className="space-y-6">
          {inviteToken ? (
            <div className="mx-auto w-full max-w-lg">
              <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <LinkSimple className="size-4" />
                    Invite
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {inviteData?.team &&
                  inviteData.workspace &&
                  !inviteData.invite.declinedAt ? (
                    <AcceptInviteCard
                      authenticated
                      token={inviteToken}
                      teamName={inviteData.team.name}
                      workspaceName={inviteData.workspace.name}
                      inviteEmail={inviteData.invite.email}
                      loginHref={loginHref}
                      signupHref={loginHref}
                      role={inviteData.invite.role}
                      expired={false}
                      accepted={Boolean(inviteData.invite.acceptedAt)}
                      autoAccept
                      className="border border-border/70 bg-background/70"
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                      This invite is no longer valid. You can still join another
                      team below if you have a code.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          <WorkspaceEntryJoinSection
            joinCode={joinCode}
            joinedTeamIds={joinedTeamIds}
            loginHref={loginHref}
            pendingInvites={pendingInvites}
            signupHref={loginHref}
          />
        </div>
      </div>
    </main>
  )
}
