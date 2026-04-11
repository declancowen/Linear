import { ArrowRight, Compass, LockSimple, Sparkle } from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type AuthEntryScreenProps = {
  mode: "login" | "signup"
  nextPath: string
}

const authModes = {
  login: {
    eyebrow: "Return to workspace",
    title: "Sign in to continue your work.",
    description:
      "Pick up your inbox, boards, projects, and docs where you left them. Team access stays attached to your account and onboarding path.",
    actionHref: "/auth/login",
    actionLabel: "Continue with WorkOS",
    secondaryHref: "/signup",
    secondaryLabel: "Create account",
  },
  signup: {
    eyebrow: "Create your account",
    title: "Start with a team-linked workspace entry.",
    description:
      "New accounts land in onboarding until they join a team. Invite links and team lookup keep the workspace and team attached after sign up.",
    actionHref: "/auth/signup",
    actionLabel: "Create account",
    secondaryHref: "/login",
    secondaryLabel: "Already have an account?",
  },
} as const

export function AuthEntryScreen({
  mode,
  nextPath,
}: AuthEntryScreenProps) {
  const config = authModes[mode]
  const authHref = `${config.actionHref}?next=${encodeURIComponent(nextPath)}`
  const secondaryHref = `${config.secondaryHref}?next=${encodeURIComponent(nextPath)}`
  const highlightTone =
    mode === "login"
      ? "bg-primary text-primary-foreground"
      : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700"

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.1),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.45))] px-6 py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 p-8 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.45)] backdrop-blur xl:p-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),transparent_60%)]" />
          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/85 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                <Compass className="size-3.5" />
                {config.eyebrow}
              </span>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance">
                  {config.title}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  {config.description}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-border/70 bg-background/75 shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm">Onboarding-safe</CardTitle>
                  <CardDescription>
                    Invite and team lookup context survives auth.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border/70 bg-background/75 shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm">Team-derived access</CardTitle>
                  <CardDescription>
                    Workspaces unlock only after a valid team membership exists.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border/70 bg-background/75 shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm">Desktop-ready</CardTitle>
                  <CardDescription>
                    The same auth entry works in the Electron wrapper and web app.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-4 rounded-[1.5rem] border border-border/70 bg-background/85 p-5 md:grid-cols-[0.9fr_1.1fr]">
              <div className="flex flex-col gap-3">
                <div className={`inline-flex size-11 items-center justify-center rounded-2xl ${highlightTone}`}>
                  {mode === "login" ? (
                    <LockSimple className="size-5" />
                  ) : (
                    <Sparkle className="size-5" />
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-medium">Ready for the next step</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    After auth you return to{" "}
                    <span className="font-medium text-foreground">{nextPath}</span>.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                  New users without an invite still need a team code or team match in
                  onboarding and join as viewers by default.
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                  Invite links land with workspace and team context attached, so a new
                  user can sign up and accept in one flow.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <Card className="w-full border-border/70 bg-card/85 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.4)] backdrop-blur">
            <CardHeader className="gap-3">
              <CardTitle className="text-2xl">
                {mode === "login" ? "Account access" : "Create a new account"}
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                {mode === "login"
                  ? "Use your existing WorkOS identity provider flow and continue into your workspace or onboarding path."
                  : "Provision a new WorkOS-backed account, then continue into onboarding or the linked invite flow."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button asChild size="lg" className="w-full">
                <a href={authHref}>
                  {config.actionLabel}
                  <ArrowRight data-icon="inline-end" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full">
                <a href={secondaryHref}>{config.secondaryLabel}</a>
              </Button>
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/35 p-4 text-sm text-muted-foreground">
                Need a team first? Use the onboarding flow or open an invite link and
                the matching workspace card will appear after authentication.
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
