"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn, resolveImageAssetSource } from "@/lib/utils"

type AcceptInviteCardProps = {
  authenticated: boolean
  token: string
  teamName: string
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
  teamName,
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
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      })

      const payload = (await response.json()) as {
        error?: string
        teamSlug?: string | null
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to accept invite")
      }

      toast.success("Invite accepted")
      router.push(
        payload.teamSlug ? `/team/${payload.teamSlug}/work` : "/workspace/projects"
      )
      router.refresh()
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept invite")
      return false
    } finally {
      setLoading(false)
    }
  }

  async function handleDecline() {
    setDeclining(true)

    try {
      const response = await fetch("/api/invites/decline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to decline invite")
      }

      toast.success("Invite declined")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to decline invite")
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
  const workspaceBadgeFallback = workspaceName.trim().charAt(0).toUpperCase() || "?"

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
            <div className="truncate text-sm font-medium">
              {teamName}
            </div>
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
