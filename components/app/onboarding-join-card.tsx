"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Buildings, SpinnerGap, Users } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type OnboardingJoinCardProps = {
  authenticated: boolean
  workspaceName: string
  workspaceLogo: string
  teamName: string
  teamSummary: string
  joinCode: string
  loginHref: string
  signupHref: string
}

export function OnboardingJoinCard({
  authenticated,
  workspaceName,
  workspaceLogo,
  teamName,
  teamSummary,
  joinCode,
  loginHref,
  signupHref,
}: OnboardingJoinCardProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  return (
    <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
            {workspaceLogo}
          </span>
          <span>{workspaceName}</span>
        </CardTitle>
        <CardDescription>
          Join <span className="font-medium text-foreground">{teamName}</span>{" "}
          to unlock the workspace. Active team invites keep their invited role;
          otherwise code-based joins default to viewer access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Buildings className="size-4" />
            <span>Workspace: {workspaceName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4" />
            <span>Team: {teamName}</span>
          </div>
          <p>{teamSummary}</p>
        </div>
        {authenticated ? (
          <Button
            className="w-full"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true)

              try {
                const response = await fetch("/api/teams/join", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ code: joinCode }),
                })
                const payload = (await response.json()) as {
                  error?: string
                  role?: string
                  teamSlug?: string | null
                }

                if (!response.ok) {
                  throw new Error(payload.error ?? "Failed to join team")
                }

                toast.success(
                  `Joined ${teamName} as ${payload.role ?? "viewer"}`
                )
                router.push(
                  payload.teamSlug
                    ? `/team/${payload.teamSlug}/work`
                    : "/workspace/projects"
                )
                router.refresh()
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Failed to join team"
                )
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {submitting ? <SpinnerGap className="size-4 animate-spin" /> : null}
            Join Workspace
          </Button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline">
              <Link href={loginHref}>Sign in</Link>
            </Button>
            <Button asChild>
              <Link href={signupHref}>Create account</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
