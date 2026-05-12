import type { getCurrentWorkspace } from "@/lib/domain/selectors"
import type { AppStore } from "@/lib/store/app-store"
import { resolveImageAssetSource } from "@/lib/utils"
import type { SettingsPendingInvite } from "./member-management"

type WorkspaceSettingsInvite = AppStore["invites"][number]
type WorkspaceSettingsStoreUser = AppStore["users"][number]
type GroupedPendingInvite = Omit<SettingsPendingInvite, "teamNames"> & {
  teamNames: Set<string>
}

export type WorkspaceBrandingSnapshot = {
  workspaceId: string | null
  name: string
  logoUrl: string
  logoImageSrc: string | null
  accent: string
  description: string
}

type WorkspaceSettingsWorkspace = ReturnType<typeof getCurrentWorkspace>

function addPendingInviteTeamName(
  invite: GroupedPendingInvite,
  teamName: string | undefined
) {
  if (teamName) {
    invite.teamNames.add(teamName)
  }
}

function createGroupedPendingInvite(input: {
  invite: WorkspaceSettingsInvite
  invitedByName: string
  teamName: string | undefined
}): GroupedPendingInvite {
  return {
    id: input.invite.id,
    email: input.invite.email,
    role: input.invite.role,
    invitedByName: input.invitedByName,
    teamNames: new Set(input.teamName ? [input.teamName] : []),
  }
}

export function upsertGroupedPendingInvite(input: {
  groupedInvites: Map<string, GroupedPendingInvite>
  invite: WorkspaceSettingsInvite
  teamName: string | undefined
  users: WorkspaceSettingsStoreUser[]
}) {
  const groupKey = input.invite.batchId ?? input.invite.id
  const existingInvite = input.groupedInvites.get(groupKey)

  if (existingInvite) {
    addPendingInviteTeamName(existingInvite, input.teamName)
    return
  }

  const inviter = input.users.find((entry) => entry.id === input.invite.invitedBy)
  input.groupedInvites.set(
    groupKey,
    createGroupedPendingInvite({
      invite: input.invite,
      invitedByName: inviter?.name ?? "Unknown sender",
      teamName: input.teamName,
    })
  )
}

export function getWorkspaceBrandingSnapshot(
  workspace: WorkspaceSettingsWorkspace
): WorkspaceBrandingSnapshot {
  if (!workspace) {
    return {
      workspaceId: null,
      name: "",
      logoUrl: "",
      logoImageSrc: null,
      accent: "emerald",
      description: "",
    }
  }

  const logoImageSrc = resolveImageAssetSource(
    workspace.logoImageUrl,
    workspace.logoUrl
  )

  return {
    workspaceId: workspace.id,
    name: workspace.name,
    logoUrl: workspace.logoUrl ?? "",
    logoImageSrc,
    accent: workspace.settings.accent ?? "emerald",
    description: workspace.settings.description ?? "",
  }
}
