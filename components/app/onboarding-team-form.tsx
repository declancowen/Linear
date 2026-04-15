"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { syncCreateTeam } from "@/lib/convex/client"
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
import {
  createDefaultTeamFeatureSettings,
  getDefaultTeamIconForExperience,
  type TeamExperienceType,
  type TeamFeatureSettings,
} from "@/lib/domain/types"

const teamPresets: Array<{
  id: string
  label: string
  description: string
  experience: TeamExperienceType
}> = [
  {
    id: "software-development",
    label: "Software development",
    description: "Epics, features, requirements, and stories.",
    experience: "software-development",
  },
  {
    id: "issue-analysis",
    label: "Issue tracking",
    description: "Issues, sub-issues, triage, and follow-up.",
    experience: "issue-analysis",
  },
  {
    id: "project-management",
    label: "Project management",
    description: "Tasks, sub-tasks, plans, and delivery work.",
    experience: "project-management",
  },
  {
    id: "community",
    label: "Community",
    description: "Chat, channels, discussion, and updates.",
    experience: "community",
  },
]

function getTeamLandingHref(teamSlug: string, features: TeamFeatureSettings) {
  if (features.issues) {
    return `/team/${teamSlug}/work`
  }

  if (features.chat) {
    return `/team/${teamSlug}/chat`
  }

  if (features.channels) {
    return `/team/${teamSlug}/channel`
  }

  if (features.docs) {
    return `/team/${teamSlug}/docs`
  }

  return "/workspace/projects"
}

type OnboardingTeamFormProps = {
  workspaceName: string
}

export function OnboardingTeamForm({ workspaceName }: OnboardingTeamFormProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [summary, setSummary] = useState("")
  const [presetId, setPresetId] = useState(teamPresets[0].id)
  const [submitting, setSubmitting] = useState(false)

  const preset =
    teamPresets.find((entry) => entry.id === presetId) ?? teamPresets[0]

  async function handleCreateTeam() {
    setSubmitting(true)

    try {
      const payload = await syncCreateTeam({
        name,
        icon: getDefaultTeamIconForExperience(preset.experience),
        summary,
        experience: preset.experience,
        features: createDefaultTeamFeatureSettings(preset.experience),
      })

      toast.success("Team created")
      router.push(
        payload?.teamSlug && payload.features
          ? getTeamLandingHref(payload.teamSlug, payload.features)
          : "/workspace/projects"
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create team"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/85 shadow-none backdrop-blur">
      <CardHeader>
        <CardTitle className="text-2xl">Create the first team</CardTitle>
        <CardDescription>
          {workspaceName} is ready. Create one team before entering the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="team-name">Team name</FieldLabel>
            <FieldContent>
              <Input
                id="team-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Software development"
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="team-summary">Summary</FieldLabel>
            <FieldContent>
              <Textarea
                id="team-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className="min-h-24 resize-none"
                placeholder="Ship product work, manage delivery, and keep priorities aligned."
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Team type</FieldLabel>
            <FieldContent>
              <div className="grid gap-3 md:grid-cols-2">
                {teamPresets.map((entry) => {
                  const selected = entry.id === presetId

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border/70 hover:bg-accent/40"
                      }`}
                      onClick={() => setPresetId(entry.id)}
                    >
                      <div className="text-sm font-medium">{entry.label}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {entry.description}
                      </div>
                    </button>
                  )
                })}
              </div>
            </FieldContent>
            <FieldDescription>
              The team join code is generated automatically and can be
              regenerated later in team settings.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <Button disabled={submitting} onClick={() => void handleCreateTeam()}>
          {submitting ? "Creating..." : "Create first team"}
        </Button>
      </CardContent>
    </Card>
  )
}
