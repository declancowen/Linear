"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useShallow } from "zustand/react/shallow"

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
import {
  defaultTeamSurfaceDisableReasons,
  TeamEditorFields,
} from "./team-editor-fields"

export function TeamSettingsScreen({ teamSlug }: { teamSlug: string }) {
  const team = useAppStore((state) => getTeamBySlug(state, teamSlug))
  const canManageTeam = useAppStore((state) => {
    const currentTeam = getTeamBySlug(state, teamSlug)

    return currentTeam ? canAdminTeam(state, currentTeam.id) : false
  })
  const surfaceDisableReasons = useAppStore(
    useShallow((state) => {
      const currentTeam = getTeamBySlug(state, teamSlug)

      return currentTeam
        ? getTeamSurfaceDisableReasons(state, currentTeam.id)
        : defaultTeamSurfaceDisableReasons
    })
  )
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setName(team?.name ?? "")
      setIcon(
        normalizeTeamIconToken(
          team?.icon,
          team?.settings.experience ?? "software-development"
        )
      )
      setSummary(team?.settings.summary ?? "")
      setFeatures(team?.settings.features ?? getTeamFeatureSettings(team))
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [team])

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

  const savedFeatures = getTeamFeatureSettings(team)

  return (
    <SettingsScaffold
      title="Team settings"
      subtitle="Identity, team type, and surfaces"
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
      <div className="max-w-3xl space-y-10">
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

        <section className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Danger zone
            </h2>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">Delete team</div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Permanently remove this team and all associated data. This
                action cannot be undone.
              </p>
            </div>
            <Button type="button" variant="destructive" disabled>
              Delete team
            </Button>
          </div>
        </section>
      </div>
    </SettingsScaffold>
  )
}
