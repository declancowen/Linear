import Link from "next/link"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { OnboardingWorkspaceForm } from "@/components/app/onboarding-workspace-form"
import { WorkspaceEntryJoinSection } from "@/components/app/workspace-entry-join-section"
import { buildAuthHref, buildSessionResolvePath } from "@/lib/auth-routing"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

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

  const { authContext } = await ensureAuthenticatedAppContext(
    auth.user,
    auth.organizationId
  )

  const pendingInvites = authContext?.pendingInvites ?? []
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
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
        <header className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Create or join a workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one, accept an invite, or join with a team code.
          </p>
        </header>

        {currentWorkspace ? (
          <div className="rounded-xl border border-border/60 px-5 py-4">
            <div className="text-sm font-medium">
              You already belong to {currentWorkspace.name}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Go to your dashboard or join another team below.
            </div>
            <Link
              href="/workspace/projects"
              className="mt-2 inline-block text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              Go to workspace
            </Link>
          </div>
        ) : (
          <OnboardingWorkspaceForm />
        )}

        <WorkspaceEntryJoinSection
          autoAcceptToken={inviteToken}
          joinCode={joinCode}
          joinedTeamIds={joinedTeamIds}
          loginHref={loginHref}
          pendingInvites={pendingInvites}
          signupHref={loginHref}
        />
      </div>
    </main>
  )
}
