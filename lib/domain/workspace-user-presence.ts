import type { UserStatus } from "@/lib/domain/types"

export type WorkspaceUserMembershipState = "active" | "former" | "unknown"

export type WorkspaceUserPresenceData = {
  name?: string | null
  email?: string | null
  title?: string | null
  avatarUrl?: string | null
  avatarImageUrl?: string | null
  status?: UserStatus | null
  statusMessage?: string | null
  hasExplicitStatus?: boolean | null
  accountDeletedAt?: string | null
}

export type WorkspaceUserPresenceView = {
  name: string | null
  email: string
  title: string
  avatarUrl: string | null
  avatarImageUrl: string | null
  status: UserStatus | null
  statusMessage: string
  hasExplicitStatus: boolean
  badgeLabel: "Deleted account" | "Left workspace" | null
  secondaryText: string
  isDeletedAccount: boolean
  hasLeftWorkspace: boolean
  isFormerMember: boolean
  showPresenceDetails: boolean
}

function trimUserField(value: string | null | undefined) {
  return value?.trim() ?? ""
}

function buildFormerMemberView(
  user: WorkspaceUserPresenceData,
  badgeLabel: "Deleted account" | "Left workspace"
): WorkspaceUserPresenceView {
  return {
    name: user.name?.trim() ?? null,
    email: "",
    title: badgeLabel,
    avatarUrl: null,
    avatarImageUrl: null,
    status: null,
    statusMessage: "",
    hasExplicitStatus: false,
    badgeLabel,
    secondaryText: badgeLabel,
    isDeletedAccount: badgeLabel === "Deleted account",
    hasLeftWorkspace: badgeLabel === "Left workspace",
    isFormerMember: true,
    showPresenceDetails: false,
  }
}

export function buildWorkspaceUserPresenceView(
  user: WorkspaceUserPresenceData | null | undefined,
  membershipState: WorkspaceUserMembershipState
): WorkspaceUserPresenceView | null {
  if (!user) {
    return null
  }

  if (user.accountDeletedAt) {
    return buildFormerMemberView(user, "Deleted account")
  }

  if (membershipState === "former") {
    return buildFormerMemberView(user, "Left workspace")
  }

  return {
    name: user.name?.trim() ?? null,
    email: trimUserField(user.email),
    title: trimUserField(user.title),
    avatarUrl: user.avatarUrl ?? null,
    avatarImageUrl: user.avatarImageUrl ?? null,
    status: user.status ?? null,
    statusMessage: trimUserField(user.statusMessage),
    hasExplicitStatus: user.hasExplicitStatus ?? user.status != null,
    badgeLabel: null,
    secondaryText: trimUserField(user.title),
    isDeletedAccount: false,
    hasLeftWorkspace: false,
    isFormerMember: false,
    showPresenceDetails: true,
  }
}
