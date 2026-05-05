"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { syncUpdateWorkspaceBranding } from "@/lib/convex/client"
import {
  getTextInputLimitState,
  optionalWorkspaceDescriptionConstraints,
  workspaceAccentConstraints,
  workspaceBrandingNameConstraints,
  workspaceFallbackBadgeConstraints,
} from "@/lib/domain/input-constraints"
import { getCurrentWorkspace, isWorkspaceOwner } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import {
  PendingInvitesList,
  WorkspaceUsersList,
  type SettingsPendingInvite,
  type WorkspaceSettingsUser,
} from "./member-management"
import {
  ImageUploadControl,
  SettingsDangerRow,
  SettingsGroupLabel,
  SettingsHero,
  SettingsNav,
  SettingsRow,
  SettingsRowGroup,
  SettingsScaffold,
  SettingsSection,
} from "./shared"
import {
  cancelSettingsInvite,
  getUserInitials,
  uploadSettingsImage,
} from "./utils"
import {
  getWorkspaceBrandingSnapshot,
  upsertGroupedPendingInvite,
  type WorkspaceBrandingSnapshot,
} from "./workspace-settings-state"

const workspaceAccentOptions = [
  {
    value: "emerald",
    label: "Emerald",
    swatchClassName: "bg-emerald-500",
  },
  {
    value: "blue",
    label: "Blue",
    swatchClassName: "bg-blue-500",
  },
  {
    value: "violet",
    label: "Violet",
    swatchClassName: "bg-violet-500",
  },
  {
    value: "amber",
    label: "Amber",
    swatchClassName: "bg-amber-500",
  },
  {
    value: "rose",
    label: "Rose",
    swatchClassName: "bg-rose-500",
  },
  {
    value: "slate",
    label: "Slate",
    swatchClassName: "bg-slate-500",
  },
] as const

type WorkspaceSettingsWorkspace = ReturnType<typeof getCurrentWorkspace>
type WorkspaceTextLimitState = ReturnType<typeof getTextInputLimitState>
type WorkspaceAccentValue = (typeof workspaceAccentOptions)[number]["value"]
type WorkspaceUserRemovalTarget = {
  id: string
  name: string
}
type InviteCancelTarget = {
  id: string
  email: string
}
type WorkspaceBrandingFieldsDraft = {
  snapshotKey: string
  name: string
  logoUrl: string
  accent: string
  description: string
}
type WorkspaceLogoDraft = {
  resetKey: string | null
  savedLogoImageSrc: string | null
  logoPreviewUrl: string | null
  logoImageStorageId?: string
  clearLogoImage: boolean
}
type WorkspaceSettingsStoreState = ReturnType<typeof useAppStore.getState>
type WorkspaceSettingsInvite = WorkspaceSettingsStoreState["invites"][number]
type WorkspaceSettingsTeam = WorkspaceSettingsStoreState["teams"][number]
type WorkspaceSettingsStoreUser = WorkspaceSettingsStoreState["users"][number]
type GroupedPendingInvite = Omit<SettingsPendingInvite, "teamNames"> & {
  teamNames: Set<string>
}

function buildWorkspaceTeamNameMap(
  teams: WorkspaceSettingsTeam[],
  workspaceId: string
) {
  return new Map(
    teams
      .filter((team) => team.workspaceId === workspaceId)
      .map((team) => [team.id, team.name])
  )
}

function isPendingWorkspaceInvite(
  invite: WorkspaceSettingsInvite,
  workspaceId: string
) {
  return (
    invite.workspaceId === workspaceId && !invite.acceptedAt && !invite.declinedAt
  )
}

function buildPendingWorkspaceInvites({
  invites,
  teams,
  users,
  workspaceId,
}: {
  invites: WorkspaceSettingsInvite[]
  teams: WorkspaceSettingsTeam[]
  users: WorkspaceSettingsStoreUser[]
  workspaceId: string
}) {
  const teamNameMap = buildWorkspaceTeamNameMap(teams, workspaceId)
  const groupedInvites = new Map<string, GroupedPendingInvite>()

  for (const invite of invites) {
    if (!isPendingWorkspaceInvite(invite, workspaceId)) {
      continue
    }

    upsertGroupedPendingInvite({
      groupedInvites,
      invite,
      teamName: teamNameMap.get(invite.teamId),
      users,
    })
  }

  return [...groupedInvites.values()]
    .map((invite) => ({
      ...invite,
      teamNames: [...invite.teamNames].sort((left, right) =>
        left.localeCompare(right)
      ),
    }))
    .sort((left, right) => left.email.localeCompare(right.email))
}

function useWorkspaceAccessLists(workspace: WorkspaceSettingsWorkspace) {
  const {
    teams,
    workspaceMemberships,
    teamMemberships,
    users,
    invites,
    currentUserId,
  } = useAppStore(
    useShallow((state) => {
      return {
        teams: state.teams,
        workspaceMemberships: state.workspaceMemberships,
        teamMemberships: state.teamMemberships,
        users: state.users,
        invites: state.invites,
        currentUserId: state.currentUserId,
      }
    })
  )
  const workspaceUsers = useMemo(() => {
    if (!workspace) {
      return []
    }

    const workspaceTeams = teams.filter(
      (team) => team.workspaceId === workspace.id
    )
    const teamNameMap = new Map(
      workspaceTeams.map((team) => [team.id, team.name])
    )
    const workspaceTeamIds = new Set(workspaceTeams.map((team) => team.id))
    const workspaceUserIds = new Set([
      ...workspaceMemberships
        .filter((membership) => membership.workspaceId === workspace.id)
        .map((membership) => membership.userId),
      ...teamMemberships
        .filter((membership) => workspaceTeamIds.has(membership.teamId))
        .map((membership) => membership.userId),
    ])

    if (workspace.createdBy) {
      workspaceUserIds.add(workspace.createdBy)
    }

    return users
      .filter((user) => workspaceUserIds.has(user.id))
      .map((user) => {
        const hasWorkspaceAdminRole =
          workspace.createdBy === user.id ||
          workspaceMemberships.some(
            (membership) =>
              membership.workspaceId === workspace.id &&
              membership.userId === user.id &&
              membership.role === "admin"
          )
        const hasTeamAdminRole = teamMemberships.some(
          (membership) =>
            membership.userId === user.id &&
            workspaceTeamIds.has(membership.teamId) &&
            membership.role === "admin"
        )
        const teamNames = teamMemberships
          .filter(
            (membership) =>
              membership.userId === user.id &&
              teamNameMap.has(membership.teamId)
          )
          .map((membership) => teamNameMap.get(membership.teamId) ?? "")
          .filter(Boolean)
          .sort((left, right) => left.localeCompare(right))

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          title: user.title,
          avatarUrl: user.avatarUrl,
          avatarImageUrl: user.avatarImageUrl,
          status: user.status,
          isOwner: workspace.createdBy === user.id,
          isWorkspaceAdmin: hasWorkspaceAdminRole,
          isTeamAdmin: !hasWorkspaceAdminRole && hasTeamAdminRole,
          isCurrentUser: currentUserId === user.id,
          teamNames,
        }
      })
      .sort((left, right) => {
        if (left.isOwner !== right.isOwner) {
          return left.isOwner ? -1 : 1
        }

        return left.name.localeCompare(right.name)
      })
  }, [
    currentUserId,
    teamMemberships,
    teams,
    users,
    workspace,
    workspaceMemberships,
  ])
  const pendingInvites = useMemo(() => {
    if (!workspace) {
      return []
    }

    return buildPendingWorkspaceInvites({
      invites,
      teams,
      users,
      workspaceId: workspace.id,
    })
  }, [invites, teams, users, workspace])
  const workspaceTeamsCount = useMemo(() => {
    if (!workspace) {
      return 0
    }

    return teams.filter((team) => team.workspaceId === workspace.id).length
  }, [teams, workspace])

  return {
    pendingInvites,
    workspaceTeamsCount,
    workspaceUsers,
  }
}

function WorkspaceSettingsHero({
  workspace,
  logoImageSrc,
  savedAccentLabel,
  workspaceTeamsCount,
  workspaceUsersCount,
}: {
  workspace: NonNullable<WorkspaceSettingsWorkspace>
  logoImageSrc?: string | null
  savedAccentLabel: string
  workspaceTeamsCount: number
  workspaceUsersCount: number
}) {
  return (
    <SettingsHero
      leading={
        <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-2">
          {logoImageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={workspace.name}
              className="size-full object-cover"
              src={logoImageSrc}
            />
          ) : (
            <span className="text-[15px] font-semibold text-fg-2">
              {workspace.logoUrl || getUserInitials(workspace.name)}
            </span>
          )}
        </div>
      }
      title={workspace.name}
      description={workspace.settings.description || "No description set."}
      meta={[
        {
          key: "members",
          label: `${workspaceUsersCount} member${workspaceUsersCount === 1 ? "" : "s"}`,
        },
        {
          key: "teams",
          label: `${workspaceTeamsCount} team${workspaceTeamsCount === 1 ? "" : "s"}`,
        },
        { key: "accent", label: `${savedAccentLabel} accent` },
      ]}
    />
  )
}

function WorkspaceBrandingSection({
  canManageWorkspace,
  description,
  descriptionLimitState,
  fallbackBadge,
  logoLimitState,
  logoPreviewUrl,
  logoUrl,
  name,
  nameLimitState,
  uploadingLogo,
  onClearLogo,
  onDescriptionChange,
  onLogoUrlChange,
  onNameChange,
  onUploadLogo,
}: {
  canManageWorkspace: boolean
  description: string
  descriptionLimitState: WorkspaceTextLimitState
  fallbackBadge: string
  logoLimitState: WorkspaceTextLimitState
  logoPreviewUrl: string | null
  logoUrl: string
  name: string
  nameLimitState: WorkspaceTextLimitState
  uploadingLogo: boolean
  onClearLogo: () => void
  onDescriptionChange: (value: string) => void
  onLogoUrlChange: (value: string) => void
  onNameChange: (value: string) => void
  onUploadLogo: (file: File) => void | Promise<void>
}) {
  return (
    <SettingsSection
      title="Branding"
      description="Name, logo, and description for your workspace."
      variant="plain"
    >
      <SettingsRowGroup>
        <SettingsRow
          label="Logo"
          description="Square image used across the workspace."
          control={
            <ImageUploadControl
              description="Square image, at least 256px. PNG or JPG up to 10 MB."
              disabled={!canManageWorkspace}
              imageSrc={logoPreviewUrl}
              onClear={onClearLogo}
              onSelect={onUploadLogo}
              preview={
                <span className="text-base font-semibold text-fg-2">
                  {fallbackBadge}
                </span>
              }
              shape="square"
              title="Workspace logo"
              uploading={uploadingLogo}
            />
          }
        />
        <SettingsRow
          label="Name"
          description="Visible across the workspace and in invite emails."
          alignment="center"
          control={
            <div>
              <Input
                id="workspace-name"
                disabled={!canManageWorkspace}
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                maxLength={workspaceBrandingNameConstraints.max}
              />
              <FieldCharacterLimit
                state={nameLimitState}
                limit={workspaceBrandingNameConstraints.max}
              />
            </div>
          }
        />
        <SettingsRow
          label="Fallback badge"
          description="Used when no uploaded workspace image is available."
          alignment="center"
          control={
            <div>
              <Input
                id="workspace-logo"
                disabled={!canManageWorkspace}
                value={logoUrl}
                onChange={(event) => onLogoUrlChange(event.target.value)}
                maxLength={workspaceFallbackBadgeConstraints.max}
              />
              <FieldCharacterLimit
                state={logoLimitState}
                limit={workspaceFallbackBadgeConstraints.max}
              />
            </div>
          }
        />
        <SettingsRow
          label="Description"
          description="Shown in the workspace summary and any discovery surfaces."
          control={
            <div>
              <Textarea
                id="workspace-description"
                className="min-h-24 resize-none"
                disabled={!canManageWorkspace}
                value={description}
                onChange={(event) => onDescriptionChange(event.target.value)}
                maxLength={optionalWorkspaceDescriptionConstraints.max}
              />
              <FieldCharacterLimit
                state={descriptionLimitState}
                limit={optionalWorkspaceDescriptionConstraints.max}
              />
            </div>
          }
        />
      </SettingsRowGroup>
    </SettingsSection>
  )
}

function WorkspaceAccentSection({
  accent,
  canManageWorkspace,
  onAccentChange,
}: {
  accent: string
  canManageWorkspace: boolean
  onAccentChange: (accent: WorkspaceAccentValue) => void
}) {
  return (
    <SettingsSection
      title="Accent color"
      description="Used on badges, highlights, and workspace surfaces."
      variant="plain"
    >
      <div className="flex flex-wrap gap-2 rounded-xl border border-line bg-surface px-5 py-4">
        {workspaceAccentOptions.map((option) => {
          const selected = accent === option.value

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              aria-label={option.label}
              title={option.label}
              className={cn(
                "group inline-flex items-center gap-2 rounded-full border bg-background py-1 pr-3 pl-1 text-[12.5px] font-medium transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                selected
                  ? "border-line text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:border-line-soft hover:text-foreground"
              )}
              disabled={!canManageWorkspace}
              onClick={() => onAccentChange(option.value)}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full ring-1 ring-foreground/10 ring-inset",
                  option.swatchClassName
                )}
              >
                {selected ? (
                  <Check className="size-3 text-white" weight="bold" />
                ) : null}
              </span>
              {option.label}
            </button>
          )
        })}
      </div>
    </SettingsSection>
  )
}

function WorkspaceDangerSection({
  canDeleteWorkspace,
  deletingWorkspace,
  onDeleteClick,
}: {
  canDeleteWorkspace: boolean
  deletingWorkspace: boolean
  onDeleteClick: () => void
}) {
  return (
    <>
      <SettingsGroupLabel label="Danger zone" />
      <SettingsDangerRow
        title="Delete workspace"
        description={
          <>
            Permanently remove this workspace and all associated data. This
            action cannot be undone.
            {!canDeleteWorkspace
              ? " Only the workspace owner can delete the workspace."
              : ""}
          </>
        }
        action={
          <Button
            type="button"
            variant="destructive"
            disabled={!canDeleteWorkspace || deletingWorkspace}
            onClick={onDeleteClick}
          >
            {deletingWorkspace ? "Deleting..." : "Delete workspace"}
          </Button>
        }
      />
    </>
  )
}

function WorkspaceMembersSection({
  canManageWorkspace,
  cancellingInviteId,
  pendingInvites,
  removingWorkspaceUserId,
  workspaceUsers,
  onCancelInvite,
  onRemoveWorkspaceUser,
}: {
  canManageWorkspace: boolean
  cancellingInviteId: string | null
  pendingInvites: SettingsPendingInvite[]
  removingWorkspaceUserId: string | null
  workspaceUsers: WorkspaceSettingsUser[]
  onCancelInvite: (invite: SettingsPendingInvite) => void
  onRemoveWorkspaceUser: (member: WorkspaceSettingsUser) => void
}) {
  return (
    <>
      <SettingsSection
        title="Workspace members"
        description="People with access to this workspace through team memberships."
        variant="plain"
      >
        <WorkspaceUsersList
          members={workspaceUsers}
          canManage={canManageWorkspace}
          pendingMemberId={removingWorkspaceUserId}
          onRemove={onRemoveWorkspaceUser}
        />
      </SettingsSection>

      <SettingsSection
        title="Pending invites"
        description="Pending invites still grant access until you cancel them."
        variant="plain"
      >
        <PendingInvitesList
          invites={pendingInvites}
          canManage={canManageWorkspace}
          pendingInviteId={cancellingInviteId}
          onCancel={onCancelInvite}
        />
      </SettingsSection>
    </>
  )
}

function WorkspaceConfirmDialogs({
  cancellingInviteId,
  deleteDialogOpen,
  deletingWorkspace,
  inviteToCancel,
  removingWorkspaceUserId,
  workspaceUserToRemove,
  onCancelInvite,
  onDeleteDialogOpenChange,
  onDeleteWorkspace,
  onInviteDialogOpenChange,
  onRemoveWorkspaceUser,
  onWorkspaceUserDialogOpenChange,
}: {
  cancellingInviteId: string | null
  deleteDialogOpen: boolean
  deletingWorkspace: boolean
  inviteToCancel: InviteCancelTarget | null
  removingWorkspaceUserId: string | null
  workspaceUserToRemove: WorkspaceUserRemovalTarget | null
  onCancelInvite: () => void
  onDeleteDialogOpenChange: (open: boolean) => void
  onDeleteWorkspace: () => void
  onInviteDialogOpenChange: (open: boolean) => void
  onRemoveWorkspaceUser: () => void
  onWorkspaceUserDialogOpenChange: (open: boolean) => void
}) {
  return (
    <>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
        title="Delete workspace"
        description="This will permanently remove the workspace, all teams, and all associated data. This can't be undone."
        confirmLabel="Delete workspace"
        variant="destructive"
        loading={deletingWorkspace}
        onConfirm={onDeleteWorkspace}
      />
      <ConfirmDialog
        open={workspaceUserToRemove != null}
        onOpenChange={onWorkspaceUserDialogOpenChange}
        title="Remove workspace user"
        description={
          workspaceUserToRemove
            ? `${workspaceUserToRemove.name} will lose access to this workspace immediately.`
            : "This user will lose access to this workspace."
        }
        confirmLabel="Remove user"
        variant="destructive"
        loading={removingWorkspaceUserId != null}
        onConfirm={onRemoveWorkspaceUser}
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

function getWorkspaceAccentLabel(accent: string) {
  return accent.charAt(0).toUpperCase() + accent.slice(1)
}

function canSaveWorkspaceBrandingDraft(limitStates: WorkspaceTextLimitState[]) {
  return limitStates.every((state) => state.canSubmit)
}

function getWorkspaceLogoUploadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to upload logo"
}

function getWorkspaceBrandingSnapshotKey(snapshot: WorkspaceBrandingSnapshot) {
  return JSON.stringify([
    snapshot.workspaceId,
    snapshot.name,
    snapshot.logoUrl,
    snapshot.accent,
    snapshot.description,
  ])
}

function createWorkspaceBrandingFieldsDraft(
  snapshot: WorkspaceBrandingSnapshot
): WorkspaceBrandingFieldsDraft {
  return {
    snapshotKey: getWorkspaceBrandingSnapshotKey(snapshot),
    name: snapshot.name,
    logoUrl: snapshot.logoUrl,
    accent: snapshot.accent,
    description: snapshot.description,
  }
}

function getActiveWorkspaceBrandingFieldsDraft(
  draft: WorkspaceBrandingFieldsDraft,
  snapshot: WorkspaceBrandingSnapshot
) {
  const snapshotKey = getWorkspaceBrandingSnapshotKey(snapshot)

  return draft.snapshotKey === snapshotKey
    ? draft
    : createWorkspaceBrandingFieldsDraft(snapshot)
}

function createWorkspaceLogoDraft(
  savedLogoImageSrc: string | null,
  resetKey: string | null
): WorkspaceLogoDraft {
  return {
    resetKey,
    savedLogoImageSrc,
    logoPreviewUrl: savedLogoImageSrc,
    logoImageStorageId: undefined,
    clearLogoImage: false,
  }
}

function getActiveWorkspaceLogoDraft(
  draft: WorkspaceLogoDraft,
  savedLogoImageSrc: string | null,
  resetKey: string | null
) {
  return draft.resetKey === resetKey &&
    draft.savedLogoImageSrc === savedLogoImageSrc
    ? draft
    : createWorkspaceLogoDraft(savedLogoImageSrc, resetKey)
}

function useWorkspaceOwnerRedirect(
  workspaceId: string | null,
  canManageWorkspace: boolean
) {
  const router = useRouter()

  useEffect(() => {
    if (!workspaceId || canManageWorkspace) {
      return
    }

    router.replace("/workspace/projects")
  }, [canManageWorkspace, router, workspaceId])
}

function useBlobUrlCleanup(url: string | null) {
  useEffect(() => {
    if (!url?.startsWith("blob:")) {
      return
    }

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [url])
}

function useWorkspaceBrandingFields(snapshot: WorkspaceBrandingSnapshot) {
  const [draft, setDraft] = useState(() =>
    createWorkspaceBrandingFieldsDraft(snapshot)
  )
  const activeDraft = getActiveWorkspaceBrandingFieldsDraft(draft, snapshot)
  const nameLimitState = getTextInputLimitState(
    activeDraft.name,
    workspaceBrandingNameConstraints
  )
  const logoLimitState = getTextInputLimitState(
    activeDraft.logoUrl,
    workspaceFallbackBadgeConstraints
  )
  const accentLimitState = getTextInputLimitState(
    activeDraft.accent,
    workspaceAccentConstraints
  )
  const descriptionLimitState = getTextInputLimitState(
    activeDraft.description,
    optionalWorkspaceDescriptionConstraints
  )

  return {
    accent: activeDraft.accent,
    accentLimitState,
    description: activeDraft.description,
    descriptionLimitState,
    logoLimitState,
    logoUrl: activeDraft.logoUrl,
    name: activeDraft.name,
    nameLimitState,
    onAccentChange: (accent: string) => setDraft({ ...activeDraft, accent }),
    onDescriptionChange: (description: string) =>
      setDraft({ ...activeDraft, description }),
    onLogoUrlChange: (logoUrl: string) => setDraft({ ...activeDraft, logoUrl }),
    onNameChange: (name: string) => setDraft({ ...activeDraft, name }),
  }
}

function useWorkspaceLogoDraft(
  savedLogoImageSrc: string | null,
  resetKey: string | null
) {
  const [draft, setDraft] = useState(() =>
    createWorkspaceLogoDraft(savedLogoImageSrc, resetKey)
  )
  const activeDraft = getActiveWorkspaceLogoDraft(
    draft,
    savedLogoImageSrc,
    resetKey
  )
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useBlobUrlCleanup(activeDraft.logoPreviewUrl)

  async function handleLogoUpload(file: File) {
    try {
      setUploadingLogo(true)
      const uploaded = await uploadSettingsImage("workspace-logo", file)
      setDraft({
        resetKey,
        savedLogoImageSrc,
        logoPreviewUrl: uploaded.previewUrl,
        logoImageStorageId: uploaded.storageId,
        clearLogoImage: false,
      })
    } catch (error) {
      toast.error(getWorkspaceLogoUploadErrorMessage(error))
    } finally {
      setUploadingLogo(false)
    }
  }

  function handleClearLogo() {
    setDraft({
      resetKey,
      savedLogoImageSrc,
      logoPreviewUrl: null,
      logoImageStorageId: undefined,
      clearLogoImage: true,
    })
  }

  return {
    clearLogoImage: activeDraft.clearLogoImage,
    logoImageStorageId: activeDraft.logoImageStorageId,
    logoPreviewUrl: activeDraft.logoPreviewUrl,
    uploadingLogo,
    onClearLogo: handleClearLogo,
    onUploadLogo: handleLogoUpload,
  }
}

function useWorkspaceBrandingDraft(workspace: WorkspaceSettingsWorkspace) {
  const snapshot = getWorkspaceBrandingSnapshot(workspace)
  const fields = useWorkspaceBrandingFields(snapshot)
  const logoDraft = useWorkspaceLogoDraft(
    snapshot.logoImageSrc,
    snapshot.workspaceId
  )
  const canSaveWorkspace = canSaveWorkspaceBrandingDraft([
    fields.nameLimitState,
    fields.logoLimitState,
    fields.accentLimitState,
    fields.descriptionLimitState,
  ])

  return {
    ...fields,
    ...logoDraft,
    canSaveWorkspace,
    currentLogoImageSrc: snapshot.logoImageSrc,
    fallbackBadge:
      fields.logoUrl.trim() || getUserInitials(fields.name || snapshot.name),
    savedAccentLabel: getWorkspaceAccentLabel(snapshot.accent),
  }
}

function useWorkspaceSettingsActions({
  accent,
  clearLogoImage,
  description,
  logoImageStorageId,
  logoUrl,
  name,
  workspace,
}: {
  accent: string
  clearLogoImage: boolean
  description: string
  logoImageStorageId?: string
  logoUrl: string
  name: string
  workspace: WorkspaceSettingsWorkspace
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingWorkspace, setDeletingWorkspace] = useState(false)
  const [workspaceUserToRemove, setWorkspaceUserToRemove] =
    useState<WorkspaceUserRemovalTarget | null>(null)
  const [inviteToCancel, setInviteToCancel] =
    useState<InviteCancelTarget | null>(null)
  const [removingWorkspaceUserId, setRemovingWorkspaceUserId] = useState<
    string | null
  >(null)
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(
    null
  )

  async function handleSave() {
    if (!workspace) {
      return
    }

    try {
      setSaving(true)
      await syncUpdateWorkspaceBranding(
        workspace.id,
        name,
        logoUrl,
        accent,
        description,
        {
          ...(logoImageStorageId ? { logoImageStorageId } : {}),
          ...(clearLogoImage ? { clearLogoImage: true } : {}),
        }
      )

      toast.success("Workspace updated")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Failed to update workspace"
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteWorkspace() {
    try {
      setDeletingWorkspace(true)
      const deleted = await useAppStore.getState().deleteCurrentWorkspace()

      if (!deleted) {
        return
      }

      setDeleteDialogOpen(false)
      router.replace("/")
    } finally {
      setDeletingWorkspace(false)
    }
  }

  async function handleRemoveWorkspaceUser() {
    if (!workspaceUserToRemove) {
      return
    }

    try {
      setRemovingWorkspaceUserId(workspaceUserToRemove.id)
      const removed = await useAppStore
        .getState()
        .removeWorkspaceUser(workspaceUserToRemove.id)

      if (removed) {
        setWorkspaceUserToRemove(null)
      }
    } finally {
      setRemovingWorkspaceUserId(null)
    }
  }

  async function handleCancelInvite() {
    await cancelSettingsInvite(inviteToCancel, {
      setCancellingInviteId,
      setInviteToCancel,
    })
  }

  function handleWorkspaceUserRemoveRequest(member: WorkspaceSettingsUser) {
    setWorkspaceUserToRemove({
      id: member.id,
      name: member.name,
    })
  }

  function handleInviteCancelRequest(invite: SettingsPendingInvite) {
    setInviteToCancel({
      id: invite.id,
      email: invite.email,
    })
  }

  function handleWorkspaceUserDialogOpenChange(open: boolean) {
    if (!open && !removingWorkspaceUserId) {
      setWorkspaceUserToRemove(null)
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
    deletingWorkspace,
    inviteToCancel,
    removingWorkspaceUserId,
    saving,
    workspaceUserToRemove,
    onCancelInvite: handleCancelInvite,
    onDeleteDialogOpenChange: setDeleteDialogOpen,
    onDeleteWorkspace: handleDeleteWorkspace,
    onInviteCancelRequest: handleInviteCancelRequest,
    onInviteDialogOpenChange: handleInviteDialogOpenChange,
    onRemoveWorkspaceUser: handleRemoveWorkspaceUser,
    onSave: handleSave,
    onWorkspaceUserDialogOpenChange: handleWorkspaceUserDialogOpenChange,
    onWorkspaceUserRemoveRequest: handleWorkspaceUserRemoveRequest,
    openDeleteDialog: () => setDeleteDialogOpen(true),
  }
}

function WorkspaceSettingsUnavailableState() {
  return (
    <SettingsScaffold
      title="Workspace settings"
      breadcrumb="Settings"
      subtitle="Current workspace not found"
    >
      <SettingsSection
        title="Workspace unavailable"
        description="Select a workspace before opening workspace settings."
      >
        <div />
      </SettingsSection>
    </SettingsScaffold>
  )
}

function WorkspaceSettingsAccessRequiredState() {
  return (
    <SettingsScaffold
      title="Workspace settings"
      breadcrumb="Settings"
      subtitle="Workspace owner access required"
    >
      <SettingsSection
        title="Redirecting"
        description="Only the workspace owner can open workspace settings."
      >
        <div />
      </SettingsSection>
    </SettingsScaffold>
  )
}

function WorkspaceSettingsFooter({
  actions,
  activeTab,
  brandingDraft,
  canManageWorkspace,
}: {
  actions: ReturnType<typeof useWorkspaceSettingsActions>
  activeTab: "workspace" | "users"
  brandingDraft: ReturnType<typeof useWorkspaceBrandingDraft>
  canManageWorkspace: boolean
}) {
  if (activeTab !== "workspace") {
    return null
  }

  return (
    <Button
      disabled={
        !canManageWorkspace || actions.saving || !brandingDraft.canSaveWorkspace
      }
      onClick={() => void actions.onSave()}
    >
      {actions.saving ? "Saving..." : "Save changes"}
    </Button>
  )
}

function WorkspaceSettingsTabs({
  activeTab,
  workspaceUsersCount,
  onActiveTabChange,
}: {
  activeTab: "workspace" | "users"
  workspaceUsersCount: number
  onActiveTabChange: (tab: "workspace" | "users") => void
}) {
  return (
    <SettingsNav
      value={activeTab}
      onValueChange={onActiveTabChange}
      options={[
        { value: "workspace", label: "Workspace" },
        {
          value: "users",
          label: "Members",
          count: workspaceUsersCount,
        },
      ]}
    />
  )
}

function WorkspaceSettingsTabContent({
  actions,
  activeTab,
  brandingDraft,
  canDeleteWorkspace,
  canManageWorkspace,
  pendingInvites,
  workspaceUsers,
}: {
  actions: ReturnType<typeof useWorkspaceSettingsActions>
  activeTab: "workspace" | "users"
  brandingDraft: ReturnType<typeof useWorkspaceBrandingDraft>
  canDeleteWorkspace: boolean
  canManageWorkspace: boolean
  pendingInvites: SettingsPendingInvite[]
  workspaceUsers: WorkspaceSettingsUser[]
}) {
  if (activeTab === "users") {
    return (
      <WorkspaceMembersSection
        canManageWorkspace={canManageWorkspace}
        cancellingInviteId={actions.cancellingInviteId}
        pendingInvites={pendingInvites}
        removingWorkspaceUserId={actions.removingWorkspaceUserId}
        workspaceUsers={workspaceUsers}
        onCancelInvite={actions.onInviteCancelRequest}
        onRemoveWorkspaceUser={actions.onWorkspaceUserRemoveRequest}
      />
    )
  }

  return (
    <>
      <WorkspaceBrandingSection
        canManageWorkspace={canManageWorkspace}
        description={brandingDraft.description}
        descriptionLimitState={brandingDraft.descriptionLimitState}
        fallbackBadge={brandingDraft.fallbackBadge}
        logoLimitState={brandingDraft.logoLimitState}
        logoPreviewUrl={brandingDraft.logoPreviewUrl}
        logoUrl={brandingDraft.logoUrl}
        name={brandingDraft.name}
        nameLimitState={brandingDraft.nameLimitState}
        uploadingLogo={brandingDraft.uploadingLogo}
        onClearLogo={brandingDraft.onClearLogo}
        onDescriptionChange={brandingDraft.onDescriptionChange}
        onLogoUrlChange={brandingDraft.onLogoUrlChange}
        onNameChange={brandingDraft.onNameChange}
        onUploadLogo={brandingDraft.onUploadLogo}
      />
      <WorkspaceAccentSection
        accent={brandingDraft.accent}
        canManageWorkspace={canManageWorkspace}
        onAccentChange={brandingDraft.onAccentChange}
      />
      <WorkspaceDangerSection
        canDeleteWorkspace={canDeleteWorkspace}
        deletingWorkspace={actions.deletingWorkspace}
        onDeleteClick={actions.openDeleteDialog}
      />
    </>
  )
}

export function WorkspaceSettingsScreen() {
  const workspace = useAppStore(getCurrentWorkspace)
  const workspaceId = workspace?.id ?? null
  const canManageWorkspace = useAppStore((state) => {
    const currentWorkspace = getCurrentWorkspace(state)

    return currentWorkspace
      ? isWorkspaceOwner(state, currentWorkspace.id)
      : false
  })
  const { pendingInvites, workspaceTeamsCount, workspaceUsers } =
    useWorkspaceAccessLists(workspace)
  const brandingDraft = useWorkspaceBrandingDraft(workspace)
  const actions = useWorkspaceSettingsActions({
    accent: brandingDraft.accent,
    clearLogoImage: brandingDraft.clearLogoImage,
    description: brandingDraft.description,
    logoImageStorageId: brandingDraft.logoImageStorageId,
    logoUrl: brandingDraft.logoUrl,
    name: brandingDraft.name,
    workspace,
  })
  const [activeTab, setActiveTab] = useState<"workspace" | "users">("workspace")
  const workspaceUsersCount = workspaceUsers.length
  const canDeleteWorkspace = canManageWorkspace

  useWorkspaceOwnerRedirect(workspaceId, canManageWorkspace)

  if (!workspace) {
    return <WorkspaceSettingsUnavailableState />
  }

  if (!canManageWorkspace) {
    return <WorkspaceSettingsAccessRequiredState />
  }

  return (
    <SettingsScaffold
      title="Workspace settings"
      breadcrumb="Settings"
      hero={
        <WorkspaceSettingsHero
          workspace={workspace}
          logoImageSrc={brandingDraft.currentLogoImageSrc}
          savedAccentLabel={brandingDraft.savedAccentLabel}
          workspaceTeamsCount={workspaceTeamsCount}
          workspaceUsersCount={workspaceUsersCount}
        />
      }
      footer={
        <WorkspaceSettingsFooter
          actions={actions}
          activeTab={activeTab}
          brandingDraft={brandingDraft}
          canManageWorkspace={canManageWorkspace}
        />
      }
    >
      <WorkspaceSettingsTabs
        activeTab={activeTab}
        workspaceUsersCount={workspaceUsersCount}
        onActiveTabChange={setActiveTab}
      />
      <WorkspaceSettingsTabContent
        actions={actions}
        activeTab={activeTab}
        brandingDraft={brandingDraft}
        canDeleteWorkspace={canDeleteWorkspace}
        canManageWorkspace={canManageWorkspace}
        pendingInvites={pendingInvites}
        workspaceUsers={workspaceUsers}
      />

      <WorkspaceConfirmDialogs
        cancellingInviteId={actions.cancellingInviteId}
        deleteDialogOpen={actions.deleteDialogOpen}
        deletingWorkspace={actions.deletingWorkspace}
        inviteToCancel={actions.inviteToCancel}
        removingWorkspaceUserId={actions.removingWorkspaceUserId}
        workspaceUserToRemove={actions.workspaceUserToRemove}
        onCancelInvite={() => void actions.onCancelInvite()}
        onDeleteDialogOpenChange={actions.onDeleteDialogOpenChange}
        onDeleteWorkspace={() => void actions.onDeleteWorkspace()}
        onInviteDialogOpenChange={actions.onInviteDialogOpenChange}
        onRemoveWorkspaceUser={() => void actions.onRemoveWorkspaceUser()}
        onWorkspaceUserDialogOpenChange={
          actions.onWorkspaceUserDialogOpenChange
        }
      />
    </SettingsScaffold>
  )
}
