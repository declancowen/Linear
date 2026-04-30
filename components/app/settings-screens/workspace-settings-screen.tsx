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
import { cn, resolveImageAssetSource } from "@/lib/utils"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { PendingInvitesList, WorkspaceUsersList } from "./member-management"
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
import { getUserInitials } from "./utils"
import { uploadSettingsImage } from "./utils"

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

export function WorkspaceSettingsScreen() {
  const router = useRouter()
  const workspace = useAppStore(getCurrentWorkspace)
  const workspaceId = workspace?.id ?? null
  const workspaceName = workspace?.name ?? ""
  const workspaceLogoUrl = workspace?.logoUrl ?? ""
  const workspaceResolvedLogoSrc =
    resolveImageAssetSource(workspace?.logoImageUrl, workspace?.logoUrl) ?? null
  const workspaceAccent = workspace?.settings.accent ?? "emerald"
  const workspaceDescription = workspace?.settings.description ?? ""
  const canManageWorkspace = useAppStore((state) => {
    const currentWorkspace = getCurrentWorkspace(state)

    return currentWorkspace
      ? isWorkspaceOwner(state, currentWorkspace.id)
      : false
  })
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

    const teamNameMap = new Map(
      teams
        .filter((team) => team.workspaceId === workspace.id)
        .map((team) => [team.id, team.name])
    )

    const groupedInvites = new Map<
      string,
      {
        id: string
        email: string
        role: (typeof invites)[number]["role"]
        invitedByName: string
        teamNames: Set<string>
      }
    >()

    for (const invite of invites) {
      if (
        invite.workspaceId !== workspace.id ||
        invite.acceptedAt ||
        invite.declinedAt
      ) {
        continue
      }

      const inviter = users.find((entry) => entry.id === invite.invitedBy)
      const groupKey = invite.batchId ?? invite.id
      const existingInvite = groupedInvites.get(groupKey)
      const teamName = teamNameMap.get(invite.teamId)

      if (existingInvite) {
        if (teamName) {
          existingInvite.teamNames.add(teamName)
        }
        continue
      }

      groupedInvites.set(groupKey, {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        invitedByName: inviter?.name ?? "Unknown sender",
        teamNames: new Set(teamName ? [teamName] : []),
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
  }, [invites, teams, users, workspace])
  const canDeleteWorkspace = canManageWorkspace
  const workspaceTeamsCount = useAppStore((state) => {
    if (!state.currentWorkspaceId) {
      return 0
    }

    return state.teams.filter(
      (team) => team.workspaceId === state.currentWorkspaceId
    ).length
  })
  const currentLogoImageSrc = resolveImageAssetSource(
    workspace?.logoImageUrl,
    workspace?.logoUrl
  )
  const [name, setName] = useState(workspace?.name ?? "")
  const [logoUrl, setLogoUrl] = useState(workspace?.logoUrl ?? "")
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    currentLogoImageSrc ?? null
  )
  const [logoImageStorageId, setLogoImageStorageId] = useState<
    string | undefined
  >(undefined)
  const [clearLogoImage, setClearLogoImage] = useState(false)
  const [accent, setAccent] = useState(workspace?.settings.accent ?? "emerald")
  const [description, setDescription] = useState(
    workspace?.settings.description ?? ""
  )
  const nameLimitState = getTextInputLimitState(
    name,
    workspaceBrandingNameConstraints
  )
  const logoLimitState = getTextInputLimitState(
    logoUrl,
    workspaceFallbackBadgeConstraints
  )
  const accentLimitState = getTextInputLimitState(accent, workspaceAccentConstraints)
  const descriptionLimitState = getTextInputLimitState(
    description,
    optionalWorkspaceDescriptionConstraints
  )
  const canSaveWorkspace =
    nameLimitState.canSubmit &&
    logoLimitState.canSubmit &&
    accentLimitState.canSubmit &&
    descriptionLimitState.canSubmit
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingWorkspace, setDeletingWorkspace] = useState(false)
  const [activeTab, setActiveTab] = useState<"workspace" | "users">("workspace")
  const [workspaceUserToRemove, setWorkspaceUserToRemove] = useState<{
    id: string
    name: string
  } | null>(null)
  const [inviteToCancel, setInviteToCancel] = useState<{
    id: string
    email: string
  } | null>(null)
  const [removingWorkspaceUserId, setRemovingWorkspaceUserId] = useState<
    string | null
  >(null)
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(
    null
  )
  const fallbackBadge =
    logoUrl.trim() || getUserInitials(name || workspace?.name)
  const savedAccent = workspace?.settings.accent ?? "emerald"
  const savedAccentLabel =
    savedAccent.charAt(0).toUpperCase() + savedAccent.slice(1)
  const workspaceUsersCount = workspaceUsers.length

  useEffect(() => {
    if (!logoPreviewUrl?.startsWith("blob:")) {
      return
    }

    return () => {
      URL.revokeObjectURL(logoPreviewUrl)
    }
  }, [logoPreviewUrl])

  useEffect(() => {
    setName(workspaceName)
    setLogoUrl(workspaceLogoUrl)
    setLogoPreviewUrl(workspaceResolvedLogoSrc)
    setLogoImageStorageId(undefined)
    setClearLogoImage(false)
    setAccent(workspaceAccent)
    setDescription(workspaceDescription)
  }, [
    workspaceAccent,
    workspaceDescription,
    workspaceId,
    workspaceLogoUrl,
    workspaceName,
    workspaceResolvedLogoSrc,
  ])

  useEffect(() => {
    if (!workspaceId || canManageWorkspace) {
      return
    }

    router.replace("/workspace/projects")
  }, [canManageWorkspace, router, workspaceId])

  if (!workspace) {
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

  if (!canManageWorkspace) {
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

  const currentWorkspace = workspace

  async function handleLogoUpload(file: File) {
    try {
      setUploadingLogo(true)
      const uploaded = await uploadSettingsImage("workspace-logo", file)
      setLogoPreviewUrl(uploaded.previewUrl)
      setLogoImageStorageId(uploaded.storageId)
      setClearLogoImage(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload logo"
      )
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      await syncUpdateWorkspaceBranding(
        currentWorkspace.id,
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
    if (!inviteToCancel) {
      return
    }

    try {
      setCancellingInviteId(inviteToCancel.id)
      const cancelled = await useAppStore.getState().cancelInvite(inviteToCancel.id)

      if (cancelled) {
        setInviteToCancel(null)
      }
    } finally {
      setCancellingInviteId(null)
    }
  }

  return (
    <SettingsScaffold
      title="Workspace settings"
      breadcrumb="Settings"
      hero={
        <SettingsHero
          leading={
            <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-2">
              {currentLogoImageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={currentWorkspace.name}
                  className="size-full object-cover"
                  src={currentLogoImageSrc}
                />
              ) : (
                <span className="text-[15px] font-semibold text-fg-2">
                  {currentWorkspace.logoUrl ||
                    getUserInitials(currentWorkspace.name)}
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
      }
      footer={
        activeTab === "workspace" ? (
          <Button
            disabled={!canManageWorkspace || saving || !canSaveWorkspace}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        ) : null
      }
    >
      <SettingsNav
        value={activeTab}
        onValueChange={setActiveTab}
        options={[
          { value: "workspace", label: "Workspace" },
          {
            value: "users",
            label: "Members",
            count: workspaceUsersCount,
          },
        ]}
      />

      {activeTab === "workspace" ? (
        <>
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
                    onClear={() => {
                      setLogoPreviewUrl(null)
                      setLogoImageStorageId(undefined)
                      setClearLogoImage(true)
                    }}
                    onSelect={handleLogoUpload}
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
                      onChange={(event) => setName(event.target.value)}
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
                      onChange={(event) => setLogoUrl(event.target.value)}
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
                      onChange={(event) => setDescription(event.target.value)}
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
                    onClick={() => setAccent(option.value)}
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full ring-1 ring-inset ring-foreground/10",
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
                onClick={() => setDeleteDialogOpen(true)}
              >
                {deletingWorkspace ? "Deleting..." : "Delete workspace"}
              </Button>
            }
          />
        </>
      ) : (
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
              onRemove={(member) =>
                setWorkspaceUserToRemove({
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
              canManage={canManageWorkspace}
              pendingInviteId={cancellingInviteId}
              onCancel={(invite) =>
                setInviteToCancel({
                  id: invite.id,
                  email: invite.email,
                })
              }
            />
          </SettingsSection>
        </>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete workspace"
        description="This will permanently remove the workspace, all teams, and all associated data. This can't be undone."
        confirmLabel="Delete workspace"
        variant="destructive"
        loading={deletingWorkspace}
        onConfirm={() => void handleDeleteWorkspace()}
      />
      <ConfirmDialog
        open={workspaceUserToRemove != null}
        onOpenChange={(open) => {
          if (!open && !removingWorkspaceUserId) {
            setWorkspaceUserToRemove(null)
          }
        }}
        title="Remove workspace user"
        description={
          workspaceUserToRemove
            ? `${workspaceUserToRemove.name} will lose access to this workspace immediately.`
            : "This user will lose access to this workspace."
        }
        confirmLabel="Remove user"
        variant="destructive"
        loading={removingWorkspaceUserId != null}
        onConfirm={() => void handleRemoveWorkspaceUser()}
      />
      <ConfirmDialog
        open={inviteToCancel != null}
        onOpenChange={(open) => {
          if (!open && cancellingInviteId == null) {
            setInviteToCancel(null)
          }
        }}
        title="Cancel pending invite"
        description={
          inviteToCancel
            ? `${inviteToCancel.email} will lose access to this invite immediately and the link will stop working.`
            : "This invite will be deleted immediately."
        }
        confirmLabel="Cancel invite"
        variant="destructive"
        loading={cancellingInviteId != null}
        onConfirm={() => void handleCancelInvite()}
      />
    </SettingsScaffold>
  )
}
