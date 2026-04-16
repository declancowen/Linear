"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"
import { useShallow } from "zustand/react/shallow"

import {
  getCurrentWorkspace,
  getTeamFeatureSettings,
  getTeamSurfaceDisableReasons,
} from "@/lib/domain/selectors"
import {
  createDefaultTeamFeatureSettings,
  getDefaultTeamIconForExperience,
  normalizeTeamIconToken,
  type TeamExperienceType,
  type TeamFeatureSettings,
  teamExperienceMeta,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  defaultTeamSurfaceDisableReasons,
  getTeamLandingHref,
  TeamEditorFields,
} from "./team-editor-fields"

export function CreateTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const workspace = useAppStore(getCurrentWorkspace)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={`${workspace?.id ?? "workspace"}-${open}`}
        className="flex max-h-[88svh] flex-col overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base">Create team</DialogTitle>
          <DialogDescription>
            Add a new team to {workspace?.name ?? "the current workspace"}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TeamEditorFields
            name={name}
            icon={icon}
            summary={summary}
            joinCode=""
            experience={experience}
            features={features}
            setName={setName}
            setIcon={(value) =>
              setIcon(normalizeTeamIconToken(value, experience))
            }
            setSummary={setSummary}
            setFeatures={setFeatures}
            savedFeatures={features}
            surfaceDisableReasons={defaultTeamSurfaceDisableReasons}
            canChangeExperience
            showJoinCode={false}
            onExperienceChange={(nextExperience) => {
              setExperience(nextExperience)
              setIcon(getDefaultTeamIconForExperience(nextExperience))
              setFeatures(createDefaultTeamFeatureSettings(nextExperience))
            }}
            joinCodeReadonlyLabel="A 12-character join code is generated automatically when the team is created."
          />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving}
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
                onOpenChange(false)
                router.push(getTeamLandingHref(created.teamSlug, created.features))
              }
            }}
          >
            {saving ? "Creating..." : "Create team"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TeamDetailsDialog({
  open,
  onOpenChange,
  teamId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
}) {
  const team = useAppStore(
    (state) => state.teams.find((entry) => entry.id === teamId) ?? null
  )
  const surfaceDisableReasons = useAppStore(
    useShallow((state) => {
      const currentTeam =
        state.teams.find((entry) => entry.id === teamId) ?? null

      return currentTeam
        ? getTeamSurfaceDisableReasons(state, currentTeam.id)
        : defaultTeamSurfaceDisableReasons
    })
  )
  const [name, setName] = useState(team?.name ?? "")
  const experience: TeamExperienceType =
    team?.settings.experience ?? "software-development"
  const [icon, setIcon] = useState(() =>
    normalizeTeamIconToken(team?.icon, experience)
  )
  const [summary, setSummary] = useState(team?.settings.summary ?? "")
  const [features, setFeatures] = useState(
    team?.settings.features ?? getTeamFeatureSettings(team)
  )
  const [saving, setSaving] = useState(false)

  if (!team) {
    return null
  }

  const savedFeatures = getTeamFeatureSettings(team)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={`${team.id}-${open}`}
        className="flex max-h-[88svh] flex-col overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base">Team settings</DialogTitle>
          <DialogDescription>
            {team.name} · {teamExperienceMeta[experience].label}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TeamEditorFields
            name={name}
            icon={icon}
            summary={summary}
            joinCode={team.settings.joinCode}
            experience={experience}
            features={features}
            setName={setName}
            setIcon={(value) =>
              setIcon(normalizeTeamIconToken(value, experience))
            }
            setSummary={setSummary}
            setFeatures={setFeatures}
            savedFeatures={savedFeatures}
            surfaceDisableReasons={surfaceDisableReasons}
            onRegenerateJoinCode={async () => {
              await useAppStore.getState().regenerateTeamJoinCode(team.id)
            }}
            joinCodeReadonlyLabel="This 12-character code is stored on the team and can be regenerated at any time."
          />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving}
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
                onOpenChange(false)
              }
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
