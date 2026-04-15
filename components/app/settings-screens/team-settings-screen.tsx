"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import {
  canAdminTeam,
  getTeamBySlug,
  getTeamFeatureSettings,
  getTeamSurfaceDisableReasons,
} from "@/lib/domain/selectors"
import {
  normalizeTeamIconToken,
  type TeamFeatureSettings,
  type TeamExperienceType,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { SettingsScaffold } from "./shared"
import { TeamEditorFields } from "./team-editor-fields"

export function TeamSettingsScreen({ teamSlug }: { teamSlug: string }) {
  const data = useAppStore()
  const team = getTeamBySlug(data, teamSlug)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const experience: TeamExperienceType =
    team?.settings.experience ?? "software-development"
  const [name, setName] = useState(team?.name ?? "")
  const [icon, setIcon] = useState(() =>
    normalizeTeamIconToken(team?.icon, experience)
  )
  const [summary, setSummary] = useState(team?.settings.summary ?? "")
  const [features, setFeatures] = useState<TeamFeatureSettings>(
    team?.settings.features ?? getTeamFeatureSettings(team)
  )

  if (!team) {
    return (
      <SettingsScaffold
        title="Team settings"
        subtitle="Requested team not found"
      >
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Team unavailable</CardTitle>
            <CardDescription>
              The requested team does not exist in the current workspace.
            </CardDescription>
          </CardHeader>
        </Card>
      </SettingsScaffold>
    )
  }

  const canManageTeam = canAdminTeam(data, team.id)
  const savedFeatures = getTeamFeatureSettings(team)
  const surfaceDisableReasons = getTeamSurfaceDisableReasons(data, team.id)

  return (
    <SettingsScaffold
      title="Team settings"
      subtitle=""
      footer={
        <Button
          disabled={!canManageTeam || saving}
          onClick={async () => {
            setSaving(true)
            const updated = await useAppStore
              .getState()
              .updateTeamDetails(team.id, {
                name,
                icon,
                summary,
                experience,
                features,
              })
            setSaving(false)

            if (updated) {
              router.refresh()
            }
          }}
        >
          {saving ? "Saving..." : "Save team"}
        </Button>
      }
    >
      <div className="space-y-6">
        {!canManageTeam ? (
          <Card className="border-dashed shadow-none">
            <CardHeader>
              <CardTitle>Read-only access</CardTitle>
              <CardDescription>
                Only team admins can change these settings.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <TeamEditorFields
          canChangeExperience={false}
          disabled={!canManageTeam}
          experience={experience}
          features={features}
          icon={icon}
          joinCode={team.settings.joinCode}
          joinCodeReadonlyLabel="This 12-character code is stored on the team and can be regenerated at any time."
          name={name}
          onRegenerateJoinCode={async () => {
            await useAppStore.getState().regenerateTeamJoinCode(team.id)
          }}
          savedFeatures={savedFeatures}
          setFeatures={setFeatures}
          setIcon={(value) =>
            setIcon(normalizeTeamIconToken(value, experience))
          }
          setName={setName}
          setSummary={setSummary}
          summary={summary}
          surfaceDisableReasons={surfaceDisableReasons}
        />
      </div>
    </SettingsScaffold>
  )
}
