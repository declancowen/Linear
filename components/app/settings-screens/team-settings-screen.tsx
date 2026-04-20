"use client"

import { useEffect, useMemo, useState } from "react"
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
  teamExperienceMeta,
  type TeamFeatureSettings,
  type TeamExperienceType,
  type Role,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

import { TeamMembersList, teamRoleRank } from "./member-management"
import {
  SettingsDangerRow,
  SettingsGroupLabel,
  SettingsHero,
  SettingsNav,
  SettingsScaffold,
  SettingsSection,
} from "./shared"
import {
  defaultTeamSurfaceDisableReasons,
  TeamEditorFields,
} from "./team-editor-fields"

export function TeamSettingsScreen({ teamSlug }: { teamSlug: string }) {
  const router = useRouter()
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
  const { teamMemberships, users, currentUserId } = useAppStore(
    useShallow((state) => ({
      teamMemberships: state.teamMemberships,
      users: state.users,
      currentUserId: state.currentUserId,
    }))
  )
  const teamMembers = useMemo(() => {
    if (!team) {
      return []
    }

    return teamMemberships
      .filter((membership) => membership.teamId === team.id)
      .flatMap((membership) => {
        const user = users.find((entry) => entry.id === membership.userId)

        if (!user) {
          return []
        }

        return [
          {
            id: user.id,
            name: user.name,
            email: user.email,
            title: user.title,
            avatarUrl: user.avatarUrl,
            avatarImageUrl: user.avatarImageUrl,
            status: user.status,
            role: membership.role,
            isCurrentUser: user.id === currentUserId,
          },
        ]
      })
      .sort((left, right) => {
        const rankDifference =
          teamRoleRank[left.role] - teamRoleRank[right.role]

        if (rankDifference !== 0) {
          return rankDifference
        }

        return left.name.localeCompare(right.name)
      })
  }, [currentUserId, team, teamMemberships, users])
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTeam, setDeletingTeam] = useState(false)
  const [activeTab, setActiveTab] = useState<"team" | "users">("team")
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)
  const [pendingMemberAction, setPendingMemberAction] = useState<
    "role" | "remove" | null
  >(null)
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string
    name: string
  } | null>(null)
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

  useEffect(() => {
    if (!team || canManageTeam) {
      return
    }

    router.replace("/workspace/projects")
  }, [canManageTeam, router, team])

  if (!team) {
    return (
      <SettingsScaffold
        title="Team settings"
        subtitle="Requested team not found"
      >
        <SettingsSection
          title="Team unavailable"
          description="The requested team does not exist in the current workspace."
        >
          <div />
        </SettingsSection>
      </SettingsScaffold>
    )
  }

  if (!canManageTeam) {
    return (
      <SettingsScaffold
        title="Team settings"
        subtitle="Team admin access required"
      >
        <SettingsSection
          title="Redirecting"
          description="Only team admins can open team settings."
        >
          <div />
        </SettingsSection>
      </SettingsScaffold>
    )
  }

  const currentTeam = team
  const savedFeatures = getTeamFeatureSettings(team)

  async function handleDeleteTeam() {
    try {
      setDeletingTeam(true)
      const deleted = await useAppStore.getState().deleteTeam(currentTeam.id)

      if (!deleted) {
        return
      }

      setDeleteDialogOpen(false)
      router.replace("/workspace/projects")
    } finally {
      setDeletingTeam(false)
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    try {
      setPendingMemberId(userId)
      setPendingMemberAction("role")
      await useAppStore
        .getState()
        .updateTeamMemberRole(currentTeam.id, userId, {
          role,
        })
    } finally {
      setPendingMemberId(null)
      setPendingMemberAction(null)
    }
  }

  async function handleRemoveTeamMember() {
    if (!memberToRemove) {
      return
    }

    try {
      setPendingMemberId(memberToRemove.id)
      setPendingMemberAction("remove")
      const removed = await useAppStore
        .getState()
        .removeTeamMember(currentTeam.id, memberToRemove.id)

      if (removed) {
        setMemberToRemove(null)
      }
    } finally {
      setPendingMemberId(null)
      setPendingMemberAction(null)
    }
  }

  return (
    <SettingsScaffold
      title="Team settings"
      hero={
        <SettingsHero
          leading={
            <div className="flex size-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-fg-2">
              <TeamIconGlyph icon={currentTeam.icon} className="size-6" />
            </div>
          }
          title={currentTeam.name}
          description={
            currentTeam.settings.summary || "No summary for this team yet."
          }
          meta={[
            {
              key: "members",
              label: `${teamMembers.length} member${teamMembers.length === 1 ? "" : "s"}`,
            },
            {
              key: "experience",
              label: teamExperienceMeta[experience].label,
            },
          ]}
        />
      }
      footer={
        activeTab === "team" ? (
          <Button
            disabled={!canManageTeam || saving}
            onClick={async () => {
              setSaving(true)
              const updated = await useAppStore
                .getState()
                .updateTeamDetails(currentTeam.id, {
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
        ) : null
      }
    >
      <SettingsNav
        value={activeTab}
        onValueChange={setActiveTab}
        options={[
          { value: "team", label: "Team" },
          { value: "users", label: "Users", count: teamMembers.length },
        ]}
      />

      {activeTab === "team" ? (
        <>
          <TeamEditorFields
            canChangeExperience={false}
            disabled={!canManageTeam}
            experience={experience}
            features={features}
            icon={icon}
            joinCode={currentTeam.settings.joinCode}
            joinCodeReadonlyLabel="This 12-character code is stored on the team and can be regenerated at any time."
            name={name}
            onRegenerateJoinCode={async () => {
              await useAppStore
                .getState()
                .regenerateTeamJoinCode(currentTeam.id)
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

          <SettingsGroupLabel label="Danger zone" />
          <SettingsDangerRow
            title="Delete team"
            description={
              <>
                Permanently remove this team and all associated data. This
                action cannot be undone.
                {!canManageTeam
                  ? " Only team admins can delete this team."
                  : ""}
              </>
            }
            action={
              <Button
                type="button"
                variant="destructive"
                disabled={!canManageTeam || deletingTeam}
                onClick={() => setDeleteDialogOpen(true)}
              >
                {deletingTeam ? "Deleting..." : "Delete team"}
              </Button>
            }
          />
        </>
      ) : (
        <SettingsSection
          title={`Team members · ${teamMembers.length}`}
          description="Admins manage membership and roles for this team."
        >
          <TeamMembersList
            members={teamMembers}
            canManage={canManageTeam}
            pendingMemberId={pendingMemberId}
            pendingAction={pendingMemberAction}
            onRoleChange={(userId, role) =>
              void handleRoleChange(userId, role)
            }
            onRemove={(member) =>
              setMemberToRemove({
                id: member.id,
                name: member.name,
              })
            }
          />
        </SettingsSection>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete team"
        description="This will permanently remove the team and all associated data. This can't be undone."
        confirmLabel="Delete team"
        variant="destructive"
        loading={deletingTeam}
        onConfirm={() => void handleDeleteTeam()}
      />
      <ConfirmDialog
        open={memberToRemove != null}
        onOpenChange={(open) => {
          if (!open && pendingMemberAction !== "remove") {
            setMemberToRemove(null)
          }
        }}
        title="Remove team member"
        description={
          memberToRemove
            ? `${memberToRemove.name} will lose access to this team and get an inbox notification plus a transactional email.`
            : "This member will lose access to this team."
        }
        confirmLabel="Remove member"
        variant="destructive"
        loading={pendingMemberAction === "remove"}
        onConfirm={() => void handleRemoveTeamMember()}
      />
    </SettingsScaffold>
  )
}
