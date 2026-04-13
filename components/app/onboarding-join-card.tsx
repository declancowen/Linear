"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Buildings, SpinnerGap, Users } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { resolveImageAssetSource } from "@/lib/utils"

type OnboardingJoinCardProps = {
  authenticated: boolean
  alreadyJoined?: boolean
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
  alreadyJoined = false,
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
  const workspaceLogoImageSrc = resolveImageAssetSource(null, workspaceLogo)

  return (
    <Card className="gap-0 py-0 shadow-none ring-foreground/10">
      <div className="flex items-center gap-3 border-b px-5 py-3.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
          {workspaceLogoImageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={workspaceName}
              className="size-full rounded-lg object-cover"
              src={workspaceLogoImageSrc}
            />
          ) : (
            workspaceLogo
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{workspaceName}</div>
          <div className="text-xs text-muted-foreground">
            Join <span className="font-medium text-foreground">{teamName}</span>{" "}
            to access this workspace
          </div>
        </div>
      </div>
      <div className="px-5 py-3.5">
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Buildings className="size-3.5" />
            <span>{workspaceName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-3.5" />
            <span>{teamName}</span>
          </div>
          {teamSummary ? (
            <p className="mt-1 text-xs leading-relaxed">{teamSummary}</p>
          ) : null}
        </div>
      </div>
      <div className="border-t px-5 py-3.5">
        {authenticated ? (
          <Button
            size="lg"
            className="h-11 w-full text-base"
            disabled={submitting || alreadyJoined}
            onClick={async () => {
              if (alreadyJoined) {
                return
              }

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
            {alreadyJoined ? "Joined" : "Join workspace"}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="lg" className="h-11 flex-1">
              <Link href={loginHref}>Sign in</Link>
            </Button>
            <Button asChild size="lg" className="h-11 flex-1">
              <Link href={signupHref}>Create account</Link>
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
