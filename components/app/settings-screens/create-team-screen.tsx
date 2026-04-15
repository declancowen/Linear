"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import {
  canAdminWorkspace,
  getCurrentWorkspace,
} from "@/lib/domain/selectors"
import {
  createDefaultTeamFeatureSettings,
  getDefaultTeamIconForExperience,
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
import {
  defaultTeamSurfaceDisableReasons,
  TeamEditorFields,
} from "./team-editor-fields"
import { getTeamLandingHref } from "./utils"

export function CreateTeamScreen() {
  const router = useRouter()
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)
  const canCreateTeam = workspace
    ? canAdminWorkspace(data, workspace.id)
    : false
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(() =>
    getDefaultTeamIconForExperience("software-development")
  )
  const [summary, setSummary] = useState("")
  const [experience, setExperience] = useState<TeamExperienceType>(
    "software-development"
  )
  const [features, setFeatures] = useState<TeamFeatureSettings>(
    createDefaultTeamFeatureSettings("software-development")
  )
  const [saving, setSaving] = useState(false)

  if (!workspace) {
    return (
      <SettingsScaffold title="Create team" subtitle="Current workspace not found">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Workspace unavailable</CardTitle>
            <CardDescription>
              Select a workspace before creating a team.
            </CardDescription>
          </CardHeader>
        </Card>
      </SettingsScaffold>
    )
  }

  return (
    <SettingsScaffold
      title="Create team"
      subtitle=""
      footer={
        <Button
          disabled={!canCreateTeam || saving}
          onClick={async () => {
            setSaving(true)
            const created = await useAppStore.getState().createTeam({
              name,
              icon,
              summary,
              experience,
              features,
            })
            setSaving(false)

            if (created) {
              router.push(
                getTeamLandingHref(created.teamSlug, created.features)
              )
            }
          }}
        >
          {saving ? "Creating..." : "Create team"}
        </Button>
      }
    >
      {!canCreateTeam ? (
        <Card className="border-dashed shadow-none">
          <CardHeader>
            <CardTitle>Read-only access</CardTitle>
            <CardDescription>
              You need workspace admin access to create a new team.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="space-y-6">
        <div className="space-y-10">
          <TeamEditorFields
            canChangeExperience
            disabled={!canCreateTeam}
            experience={experience}
            features={features}
            icon={icon}
            joinCode=""
            showJoinCode={false}
            joinCodeReadonlyLabel="A 12-character join code is generated automatically when the team is created."
            name={name}
            savedFeatures={features}
            setFeatures={setFeatures}
            setIcon={(value) =>
              setIcon(normalizeTeamIconToken(value, experience))
            }
            setName={setName}
            setSummary={setSummary}
            summary={summary}
            surfaceDisableReasons={defaultTeamSurfaceDisableReasons}
            onExperienceChange={(nextExperience) => {
              setExperience(nextExperience)
              setIcon(getDefaultTeamIconForExperience(nextExperience))
              setFeatures(createDefaultTeamFeatureSettings(nextExperience))
            }}
          />
        </div>
      </div>
    </SettingsScaffold>
  )
}
