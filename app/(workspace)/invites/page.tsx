import { withAuth } from "@workos-inc/authkit-nextjs"
import {
  LinkSimple,
  MagnifyingGlass,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr"

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
import { lookupTeamByJoinCodeServer } from "@/lib/server/convex"
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
  const joinResult = joinCode
    ? await lookupTeamByJoinCodeServer(joinCode)
    : null

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs tracking-[0.24em] text-muted-foreground uppercase">
          <LinkSimple className="size-3.5" />
          Join workspace
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Join another workspace team
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Review pending invites or enter a team code. Team membership grants
          the workspace access and role you receive.
        </p>
      </header>

      <Card className="border-border/70 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersThree className="size-4" />
            Join with a team code
          </CardTitle>
          <CardDescription>
            Search by team code, team slug, or team id. Matching team invites
            keep their invited role; otherwise the join defaults to viewer
            access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="flex flex-col gap-3 sm:flex-row" action="/invites">
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
              authenticated
              joinCode={joinResult.team.joinCode}
              loginHref="/login"
              signupHref="/signup"
              teamName={joinResult.team.name}
              teamSummary={joinResult.team.summary}
              workspaceLogo={joinResult.workspace.logoUrl}
              workspaceName={joinResult.workspace.name}
            />
          ) : null}
        </CardContent>
      </Card>

      {pendingInvites.length === 0 ? (
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle>No pending invites</CardTitle>
            <CardDescription>
              New team invites will appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle>Waiting for your response</CardTitle>
            <CardDescription>
              Each invite is team-scoped and grants workspace access through
              that team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  className="border border-border/70 bg-background"
                />
              ) : null
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
