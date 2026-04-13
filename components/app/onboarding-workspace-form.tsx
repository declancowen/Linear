"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type OnboardingWorkspaceFormProps = {
  authenticated: boolean
  loginHref: string
  signupHref: string
}

export function OnboardingWorkspaceForm({
  authenticated,
  loginHref,
  signupHref,
}: OnboardingWorkspaceFormProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleCreateWorkspace() {
    setSubmitting(true)

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description: description.trim() || undefined,
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to create workspace")
      }

      toast.success("Workspace created")
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create workspace"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/80 shadow-none backdrop-blur">
      <CardHeader>
        <CardTitle className="text-xl">Create a workspace</CardTitle>
        <CardDescription>
          Start from the workspace, then create the first team before entering the
          app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {authenticated ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
              <FieldContent>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Recipe Room"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="workspace-description">
                Description
              </FieldLabel>
              <FieldContent>
                <Textarea
                  id="workspace-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-24 resize-none"
                  placeholder="Product, delivery, and customer-facing work for the core team."
                />
              </FieldContent>
              <FieldDescription>
                Logo initials and a default accent are generated automatically.
              </FieldDescription>
            </Field>
            <Button
              disabled={submitting}
              onClick={() => void handleCreateWorkspace()}
            >
              {submitting ? "Creating..." : "Create workspace"}
            </Button>
          </FieldGroup>
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
