"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type AcceptInviteCardProps = {
  authenticated: boolean
  token: string
  teamName: string
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
  workspaceName,
  inviteEmail,
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

  return (
    <Card className={cn("w-full shadow-none", className)}>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{teamName}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">{workspaceName}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{inviteEmail}</span>
            <span className="capitalize">{role}</span>
            {expired ? (
              <span className="text-red-500">Expired</span>
            ) : null}
            {accepted ? (
              <span className="text-green-500">Accepted</span>
            ) : null}
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
