"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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

type AcceptInviteCardProps = {
  authenticated: boolean
  token: string
  teamName: string
  workspaceName: string
  inviteEmail: string
  nextPath: string
  role: string
  expired: boolean
  accepted: boolean
}

export function AcceptInviteCard({
  authenticated,
  token,
  teamName,
  workspaceName,
  inviteEmail,
  nextPath,
  role,
  expired,
  accepted,
}: AcceptInviteCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

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
      router.push(payload.teamSlug ? `/team/${payload.teamSlug}/work` : "/inbox")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept invite")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mx-auto mt-16 w-full max-w-xl shadow-none">
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
            <Button variant="outline" onClick={() => router.push("/inbox")}>
              Back to inbox
            </Button>
            <Button disabled={loading || expired} onClick={handleAccept}>
              {accepted ? "Open team" : loading ? "Accepting..." : "Accept invite"}
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline">
              <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
                Sign in
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/signup?next=${encodeURIComponent(nextPath)}`}>
                Create account
              </Link>
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
