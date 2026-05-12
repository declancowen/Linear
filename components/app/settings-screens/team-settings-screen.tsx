"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useShallow } from "zustand/react/shallow"

import {
  optionalTeamSummaryConstraints,
} from "@/lib/domain/input-constraints"
import {
  canAdminTeam,
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
import { useRetainedTeamBySlug } from "@/hooks/use-retained-team-by-slug"
import { TeamIconGlyph } from "@/components/app/entity-icons"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

import {
  PendingInvitesList,
  TeamMembersList,
  teamRoleRank,
} from "./member-management"
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
  type TeamSurfaceDisableReasons,
} from "./team-editor-fields"
import {
  TeamSettingsFooter,
  useTeamSettingsDraft,
  type TeamSettingsTab,
} from "./team-settings-draft"
import { cancelSettingsInvite } from "./utils"

type TeamSettingsTeam = NonNullable<
  ReturnType<typeof useRetainedTeamBySlug>["team"]
>
type TeamMemberRemovalTarget = {
  id: string
  name: string
}
type InviteCancelTarget = {
  id: string
  email: string
}

function useCanManageTeam(teamId: string | null) {
  return useAppStore((state) => (teamId ? canAdminTeam(state, teamId) : false))
}

function useTeamSurfaceDisableReasons(teamId: string | null) {
  return useAppStore(
    useShallow((state) =>
      teamId
        ? getTeamSurfaceDisableReasons(state, teamId)
        : defaultTeamSurfaceDisableReasons
    )
  )
}

function useTeamSettingsLists(team: TeamSettingsTeam | null) {
  const { teamMemberships, users, invites, currentUserId } = useAppStore(
    useShallow((state) => ({
      teamMemberships: state.teamMemberships,
      users: state.users,
      invites: state.invites,
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
  const pendingInvites = useMemo(() => {
    if (!team) {
      return []
    }

    return invites
      .filter(
        (invite) =>
          invite.teamId === team.id && !invite.acceptedAt && !invite.declinedAt
      )
      .map((invite) => {
        const inviter = users.find((entry) => entry.id === invite.invitedBy)

        return {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          invitedByName: inviter?.name ?? "Unknown sender",
          teamNames: [team.name],
        }
      })
      .sort((left, right) => left.email.localeCompare(right.email))
  }, [invites, team, users])

  return {
    pendingInvites,
    teamMembers,
  }
}

function TeamSettingsHeroView({
  currentTeam,
  experience,
  teamMembersCount,
}: {
  currentTeam: TeamSettingsTeam
  experience: TeamExperienceType
  teamMembersCount: number
}) {
  return (
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
          label: `${teamMembersCount} member${teamMembersCount === 1 ? "" : "s"}`,
        },
        {
          key: "experience",
          label: teamExperienceMeta[experience].label,
        },
      ]}
    />
  )
}

function TeamSettingsTeamTab({
  canManageTeam,
  currentTeam,
  deletingTeam,
  experience,
  features,
  icon,
  name,
  savedFeatures,
  summary,
  surfaceDisableReasons,
  onDeleteClick,
  onFeaturesChange,
  onIconChange,
  onNameChange,
  onRegenerateJoinCode,
  onSummaryChange,
}: {
  canManageTeam: boolean
  currentTeam: TeamSettingsTeam
  deletingTeam: boolean
  experience: TeamExperienceType
  features: TeamFeatureSettings
  icon: string
  name: string
  savedFeatures: TeamFeatureSettings
  summary: string
  surfaceDisableReasons: ReturnType<typeof getTeamSurfaceDisableReasons>
  onDeleteClick: () => void
  onFeaturesChange: (
    value:
      | TeamFeatureSettings
      | ((current: TeamFeatureSettings) => TeamFeatureSettings)
  ) => void
  onIconChange: (value: string) => void
  onNameChange: (value: string) => void
  onRegenerateJoinCode: () => Promise<void>
  onSummaryChange: (value: string) => void
}) {
  return (
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
        onRegenerateJoinCode={onRegenerateJoinCode}
        savedFeatures={savedFeatures}
        setFeatures={onFeaturesChange}
        setIcon={onIconChange}
        setName={onNameChange}
        setSummary={onSummaryChange}
        summary={summary}
        summaryConstraints={optionalTeamSummaryConstraints}
        surfaceDisableReasons={surfaceDisableReasons}
      />

      <SettingsGroupLabel label="Danger zone" />
      <SettingsDangerRow
        title="Delete team"
        description={
          <>
            Permanently remove this team and all associated data. This action
            cannot be undone.
            {!canManageTeam ? " Only team admins can delete this team." : ""}
          </>
        }
        action={
          <Button
            type="button"
            variant="destructive"
            disabled={!canManageTeam || deletingTeam}
            onClick={onDeleteClick}
          >
            {deletingTeam ? "Deleting..." : "Delete team"}
          </Button>
        }
      />
    </>
  )
}

function TeamSettingsMembersTab({
  canManageTeam,
  cancellingInviteId,
  pendingAction,
  pendingInvites,
  pendingMemberId,
  teamMembers,
  onCancelInvite,
  onRemoveMember,
  onRoleChange,
}: {
  canManageTeam: boolean
  cancellingInviteId: string | null
  pendingAction: "role" | "remove" | null
  pendingInvites: ReturnType<typeof useTeamSettingsLists>["pendingInvites"]
  pendingMemberId: string | null
  teamMembers: ReturnType<typeof useTeamSettingsLists>["teamMembers"]
  onCancelInvite: (invite: InviteCancelTarget) => void
  onRemoveMember: (member: TeamMemberRemovalTarget) => void
  onRoleChange: (userId: string, role: Role) => void
}) {
  return (
    <>
      <SettingsSection
        title="Members"
        description="Admins manage roles and membership for this team."
        variant="plain"
      >
        <TeamMembersList
          members={teamMembers}
          canManage={canManageTeam}
          pendingMemberId={pendingMemberId}
          pendingAction={pendingAction}
          onRoleChange={(userId, role) => onRoleChange(userId, role)}
          onRemove={(member) =>
            onRemoveMember({
              id: member.id,
              name: member.name,
            })
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Pending invites"
        description="Pending invites still grant access until you cancel them."
        variant="plain"
      >
        <PendingInvitesList
          invites={pendingInvites}
          canManage={canManageTeam}
          pendingInviteId={cancellingInviteId}
          onCancel={(invite) =>
            onCancelInvite({
              id: invite.id,
              email: invite.email,
            })
          }
        />
      </SettingsSection>
    </>
  )
}

function TeamSettingsConfirmDialogs({
  cancellingInviteId,
  deleteDialogOpen,
  deletingTeam,
  inviteToCancel,
  memberToRemove,
  pendingMemberAction,
  onCancelInvite,
  onDeleteDialogOpenChange,
  onDeleteTeam,
  onInviteDialogOpenChange,
  onMemberDialogOpenChange,
  onRemoveTeamMember,
}: {
  cancellingInviteId: string | null
  deleteDialogOpen: boolean
  deletingTeam: boolean
  inviteToCancel: InviteCancelTarget | null
  memberToRemove: TeamMemberRemovalTarget | null
  pendingMemberAction: "role" | "remove" | null
  onCancelInvite: () => void
  onDeleteDialogOpenChange: (open: boolean) => void
  onDeleteTeam: () => void
  onInviteDialogOpenChange: (open: boolean) => void
  onMemberDialogOpenChange: (open: boolean) => void
  onRemoveTeamMember: () => void
}) {
  return (
    <>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
        title="Delete team"
        description="This will permanently remove the team and all associated data. This can't be undone."
        confirmLabel="Delete team"
        variant="destructive"
        loading={deletingTeam}
        onConfirm={onDeleteTeam}
      />
      <ConfirmDialog
        open={memberToRemove != null}
        onOpenChange={onMemberDialogOpenChange}
        title="Remove team member"
        description={
          memberToRemove
            ? `${memberToRemove.name} will lose access to this team and get an inbox notification plus a transactional email.`
            : "This member will lose access to this team."
        }
        confirmLabel="Remove member"
        variant="destructive"
        loading={pendingMemberAction === "remove"}
        onConfirm={onRemoveTeamMember}
      />
      <ConfirmDialog
        open={inviteToCancel != null}
        onOpenChange={onInviteDialogOpenChange}
        title="Cancel pending invite"
        description={
          inviteToCancel
            ? `${inviteToCancel.email} will lose access to this invite immediately and the link will stop working.`
            : "This invite will be deleted immediately."
        }
        confirmLabel="Cancel invite"
        variant="destructive"
        loading={cancellingInviteId != null}
        onConfirm={onCancelInvite}
      />
    </>
  )
}

function TeamSettingsUnavailableState() {
  return (
    <SettingsScaffold
      title="Team settings"
      breadcrumb="Settings"
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

function TeamSettingsAccessRequiredState() {
  return (
    <SettingsScaffold
      title="Team settings"
      breadcrumb="Settings"
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

function useTeamSettingsActions({
  router,
  team,
}: {
  router: ReturnType<typeof useRouter>
  team: ReturnType<typeof useRetainedTeamBySlug>["team"]
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTeam, setDeletingTeam] = useState(false)
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)
  const [pendingMemberAction, setPendingMemberAction] = useState<
    "role" | "remove" | null
  >(null)
  const [memberToRemove, setMemberToRemove] =
    useState<TeamMemberRemovalTarget | null>(null)
  const [inviteToCancel, setInviteToCancel] =
    useState<InviteCancelTarget | null>(null)
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(
    null
  )

  async function handleDeleteTeam() {
    if (!team) {
      return
    }

    try {
      setDeletingTeam(true)
      const deleted = await useAppStore.getState().deleteTeam(team.id)

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
    if (!team) {
      return
    }

    try {
      setPendingMemberId(userId)
      setPendingMemberAction("role")
      await useAppStore.getState().updateTeamMemberRole(team.id, userId, {
        role,
      })
    } finally {
      setPendingMemberId(null)
      setPendingMemberAction(null)
    }
  }

  async function handleRemoveTeamMember() {
    if (!team || !memberToRemove) {
      return
    }

    try {
      setPendingMemberId(memberToRemove.id)
      setPendingMemberAction("remove")
      const removed = await useAppStore
        .getState()
        .removeTeamMember(team.id, memberToRemove.id)

      if (removed) {
        setMemberToRemove(null)
      }
    } finally {
      setPendingMemberId(null)
      setPendingMemberAction(null)
    }
  }

  async function handleCancelInvite() {
    await cancelSettingsInvite(inviteToCancel, {
      setCancellingInviteId,
      setInviteToCancel,
    })
  }

  function handleMemberDialogOpenChange(open: boolean) {
    if (!open && pendingMemberAction !== "remove") {
      setMemberToRemove(null)
    }
  }

  function handleInviteDialogOpenChange(open: boolean) {
    if (!open && cancellingInviteId == null) {
      setInviteToCancel(null)
    }
  }

  return {
    cancellingInviteId,
    deleteDialogOpen,
    deletingTeam,
    handleCancelInvite,
    handleDeleteTeam,
    handleInviteDialogOpenChange,
    handleMemberDialogOpenChange,
    handleRemoveTeamMember,
    handleRoleChange,
    inviteToCancel,
    memberToRemove,
    pendingMemberAction,
    pendingMemberId,
    setDeleteDialogOpen,
    setInviteToCancel,
    setMemberToRemove,
  }
}

function useTeamSettingsAccessRedirect(input: {
  canManageTeam: boolean
  liveTeam: TeamSettingsTeam | null
  router: ReturnType<typeof useRouter>
}) {
  useEffect(() => {
    if (!input.liveTeam || input.canManageTeam) {
      return
    }

    input.router.replace("/workspace/projects")
  }, [input.canManageTeam, input.liveTeam, input.router])
}

function getTeamSettingsAvailability(input: {
  canManageTeam: boolean
  liveTeam: TeamSettingsTeam | null
  team: TeamSettingsTeam | null
}) {
  if (!input.team) {
    return "unavailable"
  }

  if (input.liveTeam && !input.canManageTeam) {
    return "access-required"
  }

  return "ready"
}

function TeamSettingsActiveTabContent({
  actions,
  activeTab,
  canManageTeam,
  currentTeam,
  draft,
  experience,
  pendingInvites,
  surfaceDisableReasons,
  teamMembers,
}: {
  actions: ReturnType<typeof useTeamSettingsActions>
  activeTab: TeamSettingsTab
  canManageTeam: boolean
  currentTeam: TeamSettingsTeam
  draft: ReturnType<typeof useTeamSettingsDraft>
  experience: TeamExperienceType
  pendingInvites: ReturnType<typeof useTeamSettingsLists>["pendingInvites"]
  surfaceDisableReasons: TeamSurfaceDisableReasons
  teamMembers: ReturnType<typeof useTeamSettingsLists>["teamMembers"]
}) {
  if (activeTab === "team") {
    return (
      <TeamSettingsTeamTab
        canManageTeam={canManageTeam}
        currentTeam={currentTeam}
        deletingTeam={actions.deletingTeam}
        experience={experience}
        features={draft.features}
        icon={draft.icon}
        name={draft.name}
        savedFeatures={getTeamFeatureSettings(currentTeam)}
        summary={draft.summary}
        surfaceDisableReasons={surfaceDisableReasons}
        onDeleteClick={() => actions.setDeleteDialogOpen(true)}
        onFeaturesChange={draft.setFeatures}
        onIconChange={(value) =>
          draft.setIcon(normalizeTeamIconToken(value, experience))
        }
        onNameChange={draft.setName}
        onRegenerateJoinCode={async () => {
          await useAppStore.getState().regenerateTeamJoinCode(currentTeam.id)
        }}
        onSummaryChange={draft.setSummary}
      />
    )
  }

  return (
    <TeamSettingsMembersTab
      canManageTeam={canManageTeam}
      cancellingInviteId={actions.cancellingInviteId}
      pendingAction={actions.pendingMemberAction}
      pendingInvites={pendingInvites}
      pendingMemberId={actions.pendingMemberId}
      teamMembers={teamMembers}
      onCancelInvite={actions.setInviteToCancel}
      onRemoveMember={actions.setMemberToRemove}
      onRoleChange={(userId, role) => void actions.handleRoleChange(userId, role)}
    />
  )
}

function TeamSettingsReadyContent({
  actions,
  activeTab,
  canManageTeam,
  currentTeam,
  draft,
  experience,
  pendingInvites,
  setActiveTab,
  surfaceDisableReasons,
  teamMembers,
}: {
  actions: ReturnType<typeof useTeamSettingsActions>
  activeTab: TeamSettingsTab
  canManageTeam: boolean
  currentTeam: TeamSettingsTeam
  draft: ReturnType<typeof useTeamSettingsDraft>
  experience: TeamExperienceType
  pendingInvites: ReturnType<typeof useTeamSettingsLists>["pendingInvites"]
  setActiveTab: (tab: TeamSettingsTab) => void
  surfaceDisableReasons: TeamSurfaceDisableReasons
  teamMembers: ReturnType<typeof useTeamSettingsLists>["teamMembers"]
}) {
  return (
    <SettingsScaffold
      title="Team settings"
      breadcrumb="Settings"
      hero={
        <TeamSettingsHeroView
          currentTeam={currentTeam}
          experience={experience}
          teamMembersCount={teamMembers.length}
        />
      }
      footer={
        <TeamSettingsFooter
          activeTab={activeTab}
          canManageTeam={canManageTeam}
          canSaveTeam={draft.canSaveTeam}
          saving={draft.saving}
          onSave={() => void draft.handleSaveTeam()}
        />
      }
    >
      <SettingsNav
        value={activeTab}
        onValueChange={setActiveTab}
        options={[
          { value: "team", label: "Team" },
          { value: "users", label: "Members", count: teamMembers.length },
        ]}
      />

      <TeamSettingsActiveTabContent
        actions={actions}
        activeTab={activeTab}
        canManageTeam={canManageTeam}
        currentTeam={currentTeam}
        draft={draft}
        experience={experience}
        pendingInvites={pendingInvites}
        surfaceDisableReasons={surfaceDisableReasons}
        teamMembers={teamMembers}
      />

      <TeamSettingsConfirmDialogs
        cancellingInviteId={actions.cancellingInviteId}
        deleteDialogOpen={actions.deleteDialogOpen}
        deletingTeam={actions.deletingTeam}
        inviteToCancel={actions.inviteToCancel}
        memberToRemove={actions.memberToRemove}
        pendingMemberAction={actions.pendingMemberAction}
        onCancelInvite={() => void actions.handleCancelInvite()}
        onDeleteDialogOpenChange={actions.setDeleteDialogOpen}
        onDeleteTeam={() => void actions.handleDeleteTeam()}
        onInviteDialogOpenChange={actions.handleInviteDialogOpenChange}
        onMemberDialogOpenChange={actions.handleMemberDialogOpenChange}
        onRemoveTeamMember={() => void actions.handleRemoveTeamMember()}
      />
    </SettingsScaffold>
  )
}

export function TeamSettingsScreen({ teamSlug }: { teamSlug: string }) {
  const router = useRouter()
  const { liveTeam, team } = useRetainedTeamBySlug(teamSlug)
  const teamId = team?.id ?? null
  const canManageTeam = useCanManageTeam(teamId)
  const surfaceDisableReasons = useTeamSurfaceDisableReasons(teamId)
  const { pendingInvites, teamMembers } = useTeamSettingsLists(team)
  const [activeTab, setActiveTab] = useState<TeamSettingsTab>("team")
  const experience: TeamExperienceType =
    team?.settings.experience ?? "software-development"
  const draft = useTeamSettingsDraft({ experience, router, team })
  const actions = useTeamSettingsActions({ router, team })
  const availability = getTeamSettingsAvailability({
    canManageTeam,
    liveTeam,
    team,
  })

  useTeamSettingsAccessRedirect({ canManageTeam, liveTeam, router })

  if (availability === "unavailable") {
    return <TeamSettingsUnavailableState />
  }

  if (availability === "access-required") {
    return <TeamSettingsAccessRequiredState />
  }

  return (
    <TeamSettingsReadyContent
      actions={actions}
      activeTab={activeTab}
      canManageTeam={canManageTeam}
      currentTeam={team as TeamSettingsTeam}
      draft={draft}
      experience={experience}
      pendingInvites={pendingInvites}
      setActiveTab={setActiveTab}
      surfaceDisableReasons={surfaceDisableReasons}
      teamMembers={teamMembers}
    />
  )
}
