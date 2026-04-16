import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

import { getConvexServerClient, withServerToken } from "./core"

export async function createWorkspaceServer(input: {
  currentUserId: string
  name: string
  logoUrl: string
  accent: string
  description: string
}) {
  return getConvexServerClient().mutation(
    api.app.createWorkspace,
    withServerToken(input)
  )
}

export async function updateWorkspaceBrandingServer(input: {
  currentUserId: string
  workspaceId: string
  name: string
  logoUrl: string
  logoImageStorageId?: string
  clearLogoImage?: boolean
  accent: string
  description: string
}) {
  return getConvexServerClient().mutation(
    api.app.updateWorkspaceBranding,
    withServerToken({
      ...input,
      logoImageStorageId: input.logoImageStorageId as
        | Id<"_storage">
        | undefined,
    })
  )
}

export async function deleteWorkspaceServer(input: {
  currentUserId: string
  workspaceId: string
}) {
  return getConvexServerClient().mutation(
    api.app.deleteWorkspace,
    withServerToken(input)
  )
}

export async function removeWorkspaceUserServer(input: {
  currentUserId: string
  workspaceId: string
  userId: string
}) {
  return getConvexServerClient().mutation(
    api.app.removeWorkspaceUser,
    withServerToken(input)
  )
}

export async function leaveWorkspaceServer(input: {
  currentUserId: string
  workspaceId: string
}) {
  return getConvexServerClient().mutation(
    api.app.leaveWorkspace,
    withServerToken(input)
  )
}

export async function deleteCurrentAccountServer(input: {
  currentUserId: string
}) {
  return getConvexServerClient().mutation(
    api.app.deleteCurrentAccount,
    withServerToken(input)
  )
}

export async function validateCurrentAccountDeletionServer(input: {
  currentUserId: string
}) {
  return getConvexServerClient().query(
    api.app.validateCurrentAccountDeletion,
    withServerToken(input)
  )
}

export async function setWorkspaceWorkosOrganizationServer(input: {
  workspaceId: string
  workosOrganizationId: string
}) {
  return getConvexServerClient().mutation(
    api.app.setWorkspaceWorkosOrganization,
    withServerToken(input)
  )
}

export async function updateCurrentUserProfileServer(input: {
  currentUserId: string
  userId: string
  name: string
  title: string
  avatarUrl: string
  avatarImageStorageId?: string
  clearAvatarImage?: boolean
  clearStatus?: boolean
  status?: "active" | "away" | "busy" | "out-of-office"
  statusMessage?: string
  preferences: {
    emailMentions: boolean
    emailAssignments: boolean
    emailDigest: boolean
    theme: "light" | "dark" | "system"
  }
}) {
  return getConvexServerClient().mutation(
    api.app.updateCurrentUserProfile,
    withServerToken({
      ...input,
      avatarImageStorageId: input.avatarImageStorageId as
        | Id<"_storage">
        | undefined,
    })
  )
}

export async function ensureWorkspaceScaffoldingServer(input: {
  currentUserId: string
  workspaceId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.ensureWorkspaceScaffolding,
      withServerToken(input)
    )
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes(
        "Could not find public function for 'app:ensureWorkspaceScaffolding'"
      )
    ) {
      return null
    }

    throw error
  }
}

export async function generateSettingsImageUploadUrlServer(input: {
  currentUserId: string
  kind: "user-avatar" | "workspace-logo"
  workspaceId?: string
}) {
  return getConvexServerClient().mutation(
    api.app.generateSettingsImageUploadUrl,
    withServerToken(input)
  )
}
