"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SpinnerGap } from "@phosphor-icons/react"
import { toast } from "sonner"

import { syncJoinTeam } from "@/lib/convex/client"
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
  joinCode,
  loginHref,
  signupHref,
}: OnboardingJoinCardProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const workspaceLogoImageSrc = resolveImageAssetSource(null, workspaceLogo)
  const workspaceBadgeFallback =
    workspaceName.trim().charAt(0).toUpperCase() || "?"

  return (
    <Card className="gap-0 py-0 shadow-none">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
            {workspaceLogoImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={workspaceName}
                className="size-full rounded-lg object-cover"
                src={workspaceLogoImageSrc}
              />
            ) : (
              workspaceBadgeFallback
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{teamName}</div>
            <div className="text-xs text-muted-foreground">{workspaceName}</div>
          </div>
        </div>
      </div>
      <div className="border-t px-5 py-4">
        <div>
          {authenticated ? (
            <Button
              size={alreadyJoined ? "default" : "lg"}
              className={alreadyJoined ? "w-full" : "h-11 w-full"}
              disabled={submitting || alreadyJoined}
              onClick={async () => {
                if (alreadyJoined) {
                  return
                }

                setSubmitting(true)

                try {
                  const payload = await syncJoinTeam(joinCode)

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
                    error instanceof Error
                      ? error.message
                      : "Failed to join team"
                  )
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? (
                <SpinnerGap className="size-4 animate-spin" />
              ) : null}
              {alreadyJoined ? "Already joined" : "Join team"}
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
      </div>
    </Card>
  )
}
