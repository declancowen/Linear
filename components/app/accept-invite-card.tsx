"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
      <CardHeader>
        <CardTitle>Join {teamName}</CardTitle>
        <CardDescription>
          This invite adds <span className="font-medium">{inviteEmail}</span> to{" "}
          {workspaceName} as <span className="font-medium capitalize">{role}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>Team invitations are team-scoped and inherit workspace access from that membership.</p>
        {expired ? <p>This invite has expired. Ask a team admin to send a fresh link.</p> : null}
        {accepted ? <p>This invite was already accepted. You can continue into the team.</p> : null}
        {!authenticated ? (
          <p>Sign in or create an account first. After auth, this invite will still be attached to your onboarding flow.</p>
        ) : null}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {authenticated ? (
          <>
            {showDecline ? (
              <Button
                variant="outline"
                disabled={loading || declining || accepted}
                onClick={handleDecline}
              >
                {declining ? "Declining..." : "Decline"}
              </Button>
            ) : null}
            <Button
              disabled={loading || declining || expired}
              onClick={() => void handleAccept()}
            >
              {accepted ? "Open team" : loading ? "Accepting..." : "Accept invite"}
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline">
              <Link href={loginHref}>Sign in</Link>
            </Button>
            <Button asChild>
              <Link href={signupHref}>Create account</Link>
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
