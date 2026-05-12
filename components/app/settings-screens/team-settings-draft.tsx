"use client"

import { useEffect, useState } from "react"
import type { useRouter } from "next/navigation"

import {
  getTextInputLimitState,
  optionalTeamSummaryConstraints,
  teamNameConstraints,
} from "@/lib/domain/input-constraints"
import { getTeamFeatureSettings } from "@/lib/domain/selectors"
import {
  normalizeTeamIconToken,
  type TeamExperienceType,
  type TeamFeatureSettings,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import type { useRetainedTeamBySlug } from "@/hooks/use-retained-team-by-slug"
import { Button } from "@/components/ui/button"

export type TeamSettingsTab = "team" | "users"

function getTeamSettingsDraftFeatures(
  team: ReturnType<typeof useRetainedTeamBySlug>["team"]
) {
  return team?.settings.features ?? getTeamFeatureSettings(team)
}

function getTeamSettingsDraftIcon(
  team: ReturnType<typeof useRetainedTeamBySlug>["team"],
  experience: TeamExperienceType
) {
  return normalizeTeamIconToken(team?.icon, experience)
}

function getTeamSettingsDraftName(
  team: ReturnType<typeof useRetainedTeamBySlug>["team"]
) {
  return team?.name ?? ""
}

function getTeamSettingsDraftSummary(
  team: ReturnType<typeof useRetainedTeamBySlug>["team"]
) {
  return team?.settings.summary ?? ""
}

function getTeamSettingsDraftValues(
  team: ReturnType<typeof useRetainedTeamBySlug>["team"],
  experience: TeamExperienceType
) {
  return {
    features: getTeamSettingsDraftFeatures(team),
    icon: getTeamSettingsDraftIcon(team, experience),
    name: getTeamSettingsDraftName(team),
    summary: getTeamSettingsDraftSummary(team),
  }
}

export function TeamSettingsFooter({
  activeTab,
  canManageTeam,
  canSaveTeam,
  saving,
  onSave,
}: {
  activeTab: TeamSettingsTab
  canManageTeam: boolean
  canSaveTeam: boolean
  saving: boolean
  onSave: () => void
}) {
  if (activeTab !== "team") {
    return null
  }

  return (
    <Button
      disabled={!canManageTeam || saving || !canSaveTeam}
      onClick={onSave}
    >
      {saving ? "Saving..." : "Save changes"}
    </Button>
  )
}

export function useTeamSettingsDraft({
  experience,
  router,
  team,
}: {
  experience: TeamExperienceType
  router: ReturnType<typeof useRouter>
  team: ReturnType<typeof useRetainedTeamBySlug>["team"]
}) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(team?.name ?? "")
  const [icon, setIcon] = useState(() =>
    normalizeTeamIconToken(team?.icon, experience)
  )
  const [summary, setSummary] = useState(team?.settings.summary ?? "")
  const [features, setFeatures] = useState<TeamFeatureSettings>(
    team?.settings.features ?? getTeamFeatureSettings(team)
  )
  const nameLimitState = getTextInputLimitState(name, teamNameConstraints)
  const summaryLimitState = getTextInputLimitState(
    summary,
    optionalTeamSummaryConstraints
  )
  const canSaveTeam = nameLimitState.canSubmit && summaryLimitState.canSubmit

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const draftValues = getTeamSettingsDraftValues(team, experience)

      setName(draftValues.name)
      setIcon(draftValues.icon)
      setSummary(draftValues.summary)
      setFeatures(draftValues.features)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [experience, team])

  async function handleSaveTeam() {
    if (!team) {
      return
    }

    setSaving(true)
    const updated = await useAppStore.getState().updateTeamDetails(team.id, {
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
  }

  return {
    canSaveTeam,
    features,
    handleSaveTeam,
    icon,
    name,
    saving,
    setFeatures,
    setIcon,
    setName,
    setSummary,
    summary,
  }
}
