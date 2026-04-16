"use client"

import type {
  AppSnapshot,
  DocumentPresenceViewer,
  UserStatus,
} from "@/lib/domain/types"

import { RouteMutationError, runRouteMutation } from "./shared"

export type SnapshotRoutePayload = {
  snapshot: AppSnapshot
  version: number
}

function isSnapshotRecord(value: unknown): value is AppSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    "currentUserId" in value &&
    "teams" in value &&
    "users" in value
  )
}

export async function fetchSnapshotState() {
  const payload = await runRouteMutation<SnapshotRoutePayload | AppSnapshot>(
    "/api/snapshot",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )

  if ("snapshot" in payload && isSnapshotRecord(payload.snapshot)) {
    return payload
  }

  if (isSnapshotRecord(payload)) {
    return {
      snapshot: payload,
      version: 0,
    }
  }

  throw new RouteMutationError("Invalid snapshot payload", 500)
}

export async function fetchSnapshot() {
  const payload = await fetchSnapshotState()

  return payload.snapshot
}

export async function fetchSnapshotVersion() {
  return runRouteMutation<{
    version: number
    currentUserId: string
  }>("/api/snapshot/version", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
}

export function syncRequestAccountEmailChange(email: string) {
  return runRouteMutation<{
    ok: true
    logoutRequired?: boolean
    notice?: string
  }>("/api/account/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
    }),
  })
}

export function syncRequestCurrentAccountPasswordReset() {
  return runRouteMutation<{ ok: true }>("/api/account/password-reset", {
    method: "POST",
  })
}

export function syncAcceptInvite(token: string) {
  return runRouteMutation<{
    ok: true
    teamSlug?: string | null
    role?: string
  }>("/api/invites/accept", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
    }),
  })
}

export function syncDeclineInvite(token: string) {
  return runRouteMutation<{ ok: true }>("/api/invites/decline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
    }),
  })
}

export function syncGenerateSettingsImageUploadUrl(
  kind: "user-avatar" | "workspace-logo"
) {
  return runRouteMutation<{
    uploadUrl: string
  }>("/api/settings-images/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind,
    }),
  })
}

export function syncCreateWorkspace(input: {
  name: string
  description: string
}) {
  return runRouteMutation<{
    ok: true
    workspaceId: string
    workspaceSlug: string
  }>("/api/workspaces", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export async function syncHeartbeatDocumentPresence(
  documentId: string,
  sessionId: string
) {
  const payload = await runRouteMutation<{
    viewers: DocumentPresenceViewer[]
  }>(`/api/documents/${documentId}/presence`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "heartbeat",
      sessionId,
    }),
  })

  return payload?.viewers ?? []
}

export function syncClearDocumentPresence(
  documentId: string,
  sessionId: string,
  options?: {
    keepalive?: boolean
  }
) {
  return runRouteMutation<{ ok: true }>(
    `/api/documents/${documentId}/presence`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "leave",
        sessionId,
      }),
      keepalive: options?.keepalive,
    }
  )
}

export function syncUpdateWorkspaceBranding(
  _workspaceId: string,
  name: string,
  logoUrl: string,
  accent: string,
  description: string,
  options?: {
    logoImageStorageId?: string
    clearLogoImage?: boolean
  }
) {
  return runRouteMutation("/api/workspace/current", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      logoUrl,
      ...(options?.logoImageStorageId
        ? { logoImageStorageId: options.logoImageStorageId }
        : {}),
      ...(options?.clearLogoImage ? { clearLogoImage: true } : {}),
      accent,
      description,
    }),
  })
}

export function syncDeleteCurrentWorkspace() {
  return runRouteMutation<{
    workspaceId: string
    deletedTeamIds: string[]
    deletedUserIds: string[]
  }>("/api/workspace/current", {
    method: "DELETE",
  })
}

export function syncRemoveWorkspaceUser(userId: string) {
  return runRouteMutation(`/api/workspace/current/users/${userId}`, {
    method: "DELETE",
  })
}

export function syncLeaveWorkspace() {
  return runRouteMutation<{
    workspaceId: string
    removedTeamIds: string[]
  }>("/api/workspace/current/leave", {
    method: "DELETE",
  })
}

export function syncDeleteCurrentAccount() {
  return runRouteMutation<{
    ok: true
    logoutRequired: true
    notice: string
  }>("/api/account", {
    method: "DELETE",
  })
}

export function syncUpdateCurrentUserProfile(
  _userId: string,
  name: string,
  title: string,
  avatarUrl: string,
  preferences: {
    emailMentions: boolean
    emailAssignments: boolean
    emailDigest: boolean
    theme: "light" | "dark" | "system"
  },
  options?: {
    avatarImageStorageId?: string
    clearAvatarImage?: boolean
    clearStatus?: boolean
    status?: UserStatus
    statusMessage?: string
  }
) {
  return runRouteMutation("/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      title,
      avatarUrl,
      ...(options?.avatarImageStorageId
        ? { avatarImageStorageId: options.avatarImageStorageId }
        : {}),
      ...(options?.clearAvatarImage ? { clearAvatarImage: true } : {}),
      ...(options?.clearStatus ? { clearStatus: true } : {}),
      ...(options?.status !== undefined ? { status: options.status } : {}),
      ...(options?.statusMessage !== undefined
        ? { statusMessage: options.statusMessage }
        : {}),
      preferences,
    }),
  })
}
