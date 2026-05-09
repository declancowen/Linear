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

type AppStoreSnapshot = Parameters<typeof getCurrentWorkspace>[0]

function selectCanCreateTeam(state: AppStoreSnapshot) {
  const currentWorkspace = getCurrentWorkspace(state)

  return currentWorkspace ? canAdminWorkspace(state, currentWorkspace.id) : false
}

function CreateTeamUnavailableSection() {
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

function CreateTeamHero({
  experience,
  name,
  summary,
  workspaceName,
  icon,
}: {
  experience: TeamExperienceType
  name: string
  summary: string
  workspaceName: string
  icon: string
}) {
  const previewName = name.trim() || "New team"
  const previewSummary = summary.trim()
  const previewIcon = normalizeTeamIconToken(icon, experience)

  return (
    <SettingsHero
      leading={
        <div className="flex size-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-fg-2">
          <TeamIconGlyph icon={previewIcon} className="size-6" />
        </div>
      }
      title={previewName}
      description={
        previewSummary ||
        `New ${teamExperienceMeta[experience].label.toLowerCase()} team in ${workspaceName}.`
      }
      meta={[
        {
          key: "type",
          label: teamExperienceMeta[experience].label,
        },
        {
          key: "workspace",
          label: workspaceName,
        },
      ]}
    />
  )
}

function useCreateTeamDraft() {
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

  return {
    canSubmit: nameLimitState.canSubmit && summaryLimitState.canSubmit,
    experience,
    features,
    icon,
    name,
    saving,
    setExperience,
    setFeatures,
    setIcon,
    setName,
    setSaving,
    setSummary,
    summary,
  }
}

async function createTeamFromDraft(input: {
  draft: ReturnType<typeof useCreateTeamDraft>
  router: ReturnType<typeof useRouter>
}) {
  input.draft.setSaving(true)
  const created = await useAppStore.getState().createTeam({
    name: input.draft.name,
    icon: input.draft.icon,
    summary: input.draft.summary,
    experience: input.draft.experience,
    features: input.draft.features,
  })
  input.draft.setSaving(false)

  if (created) {
    input.router.push(getTeamLandingHref(created.teamSlug, created.features))
  }
}

export function CreateTeamScreen() {
  const router = useRouter()
  const workspace = useAppStore(getCurrentWorkspace)
  const canCreateTeam = useAppStore(selectCanCreateTeam)
  const draft = useCreateTeamDraft()

  if (!workspace) {
    return <CreateTeamUnavailableSection />
  }

  async function handleCreateTeam() {
    await createTeamFromDraft({ draft, router })
  }

  return (
    <SettingsScaffold
      title="Create team"
      breadcrumb="Workspace"
      hero={
        <CreateTeamHero
          experience={draft.experience}
          icon={draft.icon}
          name={draft.name}
          summary={draft.summary}
          workspaceName={workspace.name}
        />
      }
      footer={
        <Button
          disabled={!canCreateTeam || draft.saving || !draft.canSubmit}
          onClick={handleCreateTeam}
        >
          {draft.saving ? "Creating..." : "Create team"}
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
        experience={draft.experience}
        features={draft.features}
        icon={draft.icon}
        joinCode=""
        showJoinCode={false}
        joinCodeReadonlyLabel="A 12-character join code is generated automatically when the team is created."
        name={draft.name}
        savedFeatures={draft.features}
        setFeatures={draft.setFeatures}
        setIcon={(value) =>
          draft.setIcon(normalizeTeamIconToken(value, draft.experience))
        }
        setName={draft.setName}
        setSummary={draft.setSummary}
        summary={draft.summary}
        surfaceDisableReasons={defaultTeamSurfaceDisableReasons}
        onExperienceChange={(nextExperience) => {
          draft.setExperience(nextExperience)
          draft.setIcon(getDefaultTeamIconForExperience(nextExperience))
          draft.setFeatures(createDefaultTeamFeatureSettings(nextExperience))
        }}
      />
    </SettingsScaffold>
  )
}
