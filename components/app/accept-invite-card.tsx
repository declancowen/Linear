"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"

import { syncAcceptInvite, syncDeclineInvite } from "@/lib/convex/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn, resolveImageAssetSource } from "@/lib/utils"

type AcceptInviteCardProps = {
  authenticated: boolean
  token: string
  teamNames: string[]
  workspaceLogo: string
  workspaceName: string
  inviteEmail: string
  loginHref: string
  signupHref: string
  role: string
  expired: boolean
  accepted: boolean
  showDecline?: boolean
  autoAccept?: boolean
  className?: string
}

export function AcceptInviteCard({
  authenticated,
  token,
  teamNames,
  workspaceLogo,
  workspaceName,
  loginHref,
  signupHref,
  role,
  expired,
  accepted,
  showDecline = false,
  autoAccept = false,
  className,
}: AcceptInviteCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [declining, setDeclining] = useState(false)
  const autoAcceptStarted = useRef(false)

  async function handleAccept() {
    setLoading(true)

    try {
      const payload = await syncAcceptInvite(token)

      toast.success("Invite accepted")
      router.push(
        payload.teamSlug
          ? `/team/${payload.teamSlug}/work`
          : "/workspace/projects"
      )
      router.refresh()
      return true
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept invite"
      )
      return false
    } finally {
      setLoading(false)
    }
  }

  async function handleDecline() {
    setDeclining(true)

    try {
      await syncDeclineInvite(token)

      toast.success("Invite declined")
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to decline invite"
      )
    } finally {
      setDeclining(false)
    }
  }

  const handleAutoAccept = useEffectEvent(() => {
    void handleAccept()
  })

  useEffect(() => {
    if (
      !authenticated ||
      !autoAccept ||
      expired ||
      accepted ||
      autoAcceptStarted.current
    ) {
      return
    }

    autoAcceptStarted.current = true
    handleAutoAccept()
  }, [accepted, authenticated, autoAccept, expired])

  const workspaceLogoImageSrc = resolveImageAssetSource(null, workspaceLogo)
  const workspaceBadgeFallback =
    workspaceName.trim().charAt(0).toUpperCase() || "?"
  const teamLabel =
    teamNames.length <= 2
      ? teamNames.join(", ")
      : `${teamNames.slice(0, 2).join(", ")} +${teamNames.length - 2}`
  const teamLineLabel = teamNames.length === 1 ? "Team" : "Teams"

  return (
    <Card className={cn("w-full shadow-none", className)}>
      <div className="flex items-center gap-4 px-5 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
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
          <div className="flex min-w-0 items-baseline gap-1.5">
            <div className="truncate text-sm font-medium">{teamLabel}</div>
            <span className="shrink-0 text-xs text-muted-foreground">·</span>
            {expired ? (
              <span className="shrink-0 text-xs text-destructive">Expired</span>
            ) : accepted ? (
              <span className="shrink-0 text-xs text-green-600">Accepted</span>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground capitalize">
                {role}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {workspaceName}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {teamLineLabel}: {teamNames.join(", ")}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {authenticated ? (
            <>
              {showDecline ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loading || declining || accepted}
                  onClick={handleDecline}
                >
                  {declining ? "..." : "Decline"}
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={loading || declining || expired}
                onClick={() => void handleAccept()}
              >
                {accepted ? "Open" : loading ? "..." : "Accept"}
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={loginHref}>Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={signupHref}>Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
