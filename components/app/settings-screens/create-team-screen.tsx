"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import {
  getTextInputLimitState,
  teamNameConstraints,
  teamSummaryConstraints,
} from "@/lib/domain/input-constraints"
import { canAdminWorkspace, getCurrentWorkspace } from "@/lib/domain/selectors"
import {
  createDefaultTeamFeatureSettings,
  getDefaultTeamIconForExperience,
  normalizeTeamIconToken,
  teamExperienceMeta,
  type TeamFeatureSettings,
  type TeamExperienceType,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { Button } from "@/components/ui/button"

import {
  SettingsHero,
  SettingsScaffold,
  SettingsSection,
} from "./shared"
import {
  defaultTeamSurfaceDisableReasons,
  TeamEditorFields,
} from "./team-editor-fields"
import { getTeamLandingHref } from "./utils"

export function CreateTeamScreen() {
  const router = useRouter()
  const workspace = useAppStore(getCurrentWorkspace)
  const canCreateTeam = useAppStore((state) => {
    const currentWorkspace = getCurrentWorkspace(state)

    return currentWorkspace
      ? canAdminWorkspace(state, currentWorkspace.id)
      : false
  })
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
  const nameLimitState = getTextInputLimitState(name, teamNameConstraints)
  const summaryLimitState = getTextInputLimitState(summary, teamSummaryConstraints)
  const canSubmit = nameLimitState.canSubmit && summaryLimitState.canSubmit

  if (!workspace) {
    return (
      <SettingsScaffold
        title="Create team"
        breadcrumb="Workspace"
        subtitle="Workspace unavailable"
      >
        <SettingsSection
          title="Workspace unavailable"
          description="Select a workspace before creating a team."
        >
          <div />
        </SettingsSection>
      </SettingsScaffold>
    )
  }

  const previewName = name.trim() || "New team"
  const previewSummary = summary.trim()
  const previewIcon = normalizeTeamIconToken(icon, experience)

  return (
    <SettingsScaffold
      title="Create team"
      breadcrumb="Workspace"
      hero={
        <SettingsHero
          leading={
            <div className="flex size-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-fg-2">
              <TeamIconGlyph icon={previewIcon} className="size-6" />
            </div>
          }
          title={previewName}
          description={
            previewSummary ||
            `New ${teamExperienceMeta[experience].label.toLowerCase()} team in ${workspace.name}.`
          }
          meta={[
            {
              key: "type",
              label: teamExperienceMeta[experience].label,
            },
            {
              key: "workspace",
              label: workspace.name,
            },
          ]}
        />
      }
      footer={
        <Button
          disabled={!canCreateTeam || saving || !canSubmit}
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
        <SettingsSection
          title="Read-only access"
          description="You need workspace admin access to create a new team."
          variant="card"
        >
          <div />
        </SettingsSection>
      ) : null}

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
    </SettingsScaffold>
  )
}
