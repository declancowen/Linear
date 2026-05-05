import Link from "next/link"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { OnboardingWorkspaceForm } from "@/components/app/onboarding-workspace-form"
import { WorkspaceEntryJoinSection } from "@/components/app/workspace-entry-join-section"
import { buildAuthHref, buildSessionResolvePath } from "@/lib/auth-routing"
import { getWorkspaceEntryJoinState } from "@/lib/server/authenticated-app"

type OnboardingPageProps = {
  searchParams: Promise<{
    code?: string
    invite?: string
    validated?: string
  }>
}
type OnboardingSearchParams = Awaited<OnboardingPageProps["searchParams"]>
type OnboardingAuth = Awaited<ReturnType<typeof withAuth>>
type OnboardingTokens = {
  inviteToken?: string
  joinCode?: string
}
type OnboardingPaths = {
  loginHref: string
  nextPath: string
  validatedNextPath: string
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const auth = await withAuth()
  const params = await searchParams
  const tokens = getOnboardingTokens(params)
  const paths = getOnboardingPaths(tokens)
  const user = getOnboardingAuthUser(auth, params, paths)

  const { currentWorkspace, joinedTeamIds, pendingInvites } =
    await getWorkspaceEntryJoinState(user, auth.organizationId)

  redirectIfWorkspaceEntryComplete({
    currentWorkspace,
    pendingInvites,
    tokens,
  })

  return (
    <OnboardingPageLayout
      currentWorkspace={currentWorkspace}
      joinedTeamIds={joinedTeamIds}
      loginHref={paths.loginHref}
      pendingInvites={pendingInvites}
      tokens={tokens}
    />
  )
}

function getOnboardingTokens(params: OnboardingSearchParams): OnboardingTokens {
  return {
    inviteToken: params.invite?.trim(),
    joinCode: params.code?.trim(),
  }
}

function getOnboardingPaths(tokens: OnboardingTokens): OnboardingPaths {
  const nextParams = new URLSearchParams()

  if (tokens.inviteToken) {
    nextParams.set("invite", tokens.inviteToken)
  }

  if (tokens.joinCode) {
    nextParams.set("code", tokens.joinCode)
  }

  const validatedNextParams = new URLSearchParams(nextParams)
  validatedNextParams.set("validated", "1")
  const nextPath = `/onboarding${
    nextParams.size > 0 ? `?${nextParams.toString()}` : ""
  }`

  return {
    loginHref: buildAuthHref("login", nextPath),
    nextPath,
    validatedNextPath: `/onboarding?${validatedNextParams.toString()}`,
  }
}

function getOnboardingAuthUser(
  auth: OnboardingAuth,
  params: OnboardingSearchParams,
  paths: OnboardingPaths
): NonNullable<OnboardingAuth["user"]> {
  if (auth.user && params.validated !== "1") {
    redirect(
      buildSessionResolvePath({
        mode: "login",
        nextPath: paths.validatedNextPath,
      })
    )
  }

  if (!auth.user) {
    redirect(paths.loginHref)
  }

  return auth.user
}

function redirectIfWorkspaceEntryComplete({
  currentWorkspace,
  pendingInvites,
  tokens,
}: {
  currentWorkspace: Awaited<
    ReturnType<typeof getWorkspaceEntryJoinState>
  >["currentWorkspace"]
  pendingInvites: Awaited<
    ReturnType<typeof getWorkspaceEntryJoinState>
  >["pendingInvites"]
  tokens: OnboardingTokens
}) {
  if (
    currentWorkspace &&
    !tokens.inviteToken &&
    !tokens.joinCode &&
    pendingInvites.length === 0
  ) {
    redirect("/workspace/projects")
  }
}

function OnboardingPageLayout({
  currentWorkspace,
  joinedTeamIds,
  loginHref,
  pendingInvites,
  tokens,
}: {
  currentWorkspace: Awaited<
    ReturnType<typeof getWorkspaceEntryJoinState>
  >["currentWorkspace"]
  joinedTeamIds: Awaited<
    ReturnType<typeof getWorkspaceEntryJoinState>
  >["joinedTeamIds"]
  loginHref: string
  pendingInvites: Awaited<
    ReturnType<typeof getWorkspaceEntryJoinState>
  >["pendingInvites"]
  tokens: OnboardingTokens
}) {
  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
        <OnboardingHeader />
        {currentWorkspace ? (
          <ExistingWorkspaceNotice workspaceName={currentWorkspace.name} />
        ) : (
          <OnboardingWorkspaceForm />
        )}
        <WorkspaceEntryJoinSection
          autoAcceptToken={tokens.inviteToken}
          joinCode={tokens.joinCode}
          joinedTeamIds={joinedTeamIds}
          loginHref={loginHref}
          pendingInvites={pendingInvites}
          signupHref={loginHref}
        />
      </div>
    </main>
  )
}

function OnboardingHeader() {
  return (
    <header className="text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        Create or join a workspace
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Create one, accept an invite, or join with a team code.
      </p>
    </header>
  )
}

function ExistingWorkspaceNotice({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="rounded-xl border border-border/60 px-5 py-4">
      <div className="text-sm font-medium">
        You already belong to {workspaceName}
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
  )
}
