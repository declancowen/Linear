import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { coerceApplicationError } from "@/lib/server/application-errors"

import {
  getConvexServerClient,
  runConvexRequestWithRetry,
  withServerToken,
} from "./core"
import { resolveServerOrigin } from "../request-origin"

const REMOVE_WORKSPACE_USER_ERROR_MAPPINGS = [
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: "Only the workspace owner can remove workspace users",
    status: 403,
    code: "WORKSPACE_OWNER_REQUIRED",
  },
  {
    match: "You can't remove the workspace owner",
    status: 409,
    code: "WORKSPACE_USER_REMOVE_OWNER_FORBIDDEN",
  },
  {
    match: "You can't remove yourself from the workspace here",
    status: 409,
    code: "WORKSPACE_USER_REMOVE_SELF_FORBIDDEN",
  },
  {
    match: "Workspace user not found",
    status: 404,
    code: "WORKSPACE_USER_NOT_FOUND",
  },
  {
    match: "Workspace admins can't be removed from the workspace",
    status: 409,
    code: "WORKSPACE_USER_REMOVE_ADMIN_FORBIDDEN",
  },
] as const

const LEAVE_WORKSPACE_ERROR_MAPPINGS = [
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: "Workspace owners can't leave the workspace",
    status: 409,
    code: "WORKSPACE_LEAVE_OWNER_FORBIDDEN",
  },
  {
    match: "You are not a member of this workspace",
    status: 404,
    code: "WORKSPACE_MEMBERSHIP_NOT_FOUND",
  },
  {
    match: "Workspace admins can't leave the workspace",
    status: 409,
    code: "WORKSPACE_LEAVE_ADMIN_FORBIDDEN",
  },
] as const

const CURRENT_ACCOUNT_DELETION_ERROR_MAPPINGS = [
  {
    match: "User not found",
    status: 404,
    code: "ACCOUNT_NOT_FOUND",
  },
  {
    match: "This account has already been deleted",
    status: 409,
    code: "ACCOUNT_ALREADY_DELETED",
  },
  {
    match: "Transfer or delete your owned workspace before deleting your account",
    status: 409,
    code: "ACCOUNT_DELETE_WORKSPACE_TRANSFER_REQUIRED",
  },
  {
    match: "Leave or transfer your team admin access before deleting your account",
    status: 409,
    code: "ACCOUNT_DELETE_TEAM_ADMIN_TRANSFER_REQUIRED",
  },
] as const

const WORKSPACE_LOGO_UPLOAD_ERROR_MAPPINGS = [
  {
    match: "Uploaded image not found",
    status: 400,
    code: "WORKSPACE_LOGO_UPLOAD_NOT_FOUND",
  },
  {
    match: "Uploads must be image files",
    status: 400,
    code: "WORKSPACE_LOGO_UPLOAD_INVALID_TYPE",
  },
  {
    match: "Uploaded image is empty",
    status: 400,
    code: "WORKSPACE_LOGO_UPLOAD_EMPTY",
  },
  {
    match: "Images must be 10 MB or smaller",
    status: 400,
    code: "WORKSPACE_LOGO_UPLOAD_TOO_LARGE",
  },
] as const

const UPDATE_WORKSPACE_BRANDING_ERROR_MAPPINGS = [
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: "Only the workspace owner can update workspace details",
    status: 403,
    code: "WORKSPACE_UPDATE_OWNER_REQUIRED",
  },
  ...WORKSPACE_LOGO_UPLOAD_ERROR_MAPPINGS,
] as const

const DELETE_WORKSPACE_ERROR_MAPPINGS = [
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: "Only the workspace owner can delete the workspace",
    status: 403,
    code: "WORKSPACE_DELETE_OWNER_REQUIRED",
  },
] as const

const SET_WORKSPACE_WORKOS_ORGANIZATION_ERROR_MAPPINGS = [
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
] as const

const PROFILE_AVATAR_UPLOAD_ERROR_MAPPINGS = [
  {
    match: "Uploaded image not found",
    status: 400,
    code: "PROFILE_AVATAR_UPLOAD_NOT_FOUND",
  },
  {
    match: "Uploads must be image files",
    status: 400,
    code: "PROFILE_AVATAR_UPLOAD_INVALID_TYPE",
  },
  {
    match: "Uploaded image is empty",
    status: 400,
    code: "PROFILE_AVATAR_UPLOAD_EMPTY",
  },
  {
    match: "Images must be 10 MB or smaller",
    status: 400,
    code: "PROFILE_AVATAR_UPLOAD_TOO_LARGE",
  },
] as const

const UPDATE_CURRENT_USER_PROFILE_ERROR_MAPPINGS = [
  {
    match: "You can only update your own profile",
    status: 403,
    code: "PROFILE_UPDATE_FORBIDDEN",
  },
  {
    match: "User not found",
    status: 404,
    code: "PROFILE_NOT_FOUND",
  },
  ...PROFILE_AVATAR_UPLOAD_ERROR_MAPPINGS,
] as const

const GENERATE_SETTINGS_IMAGE_UPLOAD_URL_ERROR_MAPPINGS = [
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: "Only workspace admins can perform this action",
    status: 403,
    code: "WORKSPACE_SETTINGS_ADMIN_REQUIRED",
  },
  {
    match: "User not found",
    status: 404,
    code: "PROFILE_NOT_FOUND",
  },
] as const

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
  try {
    return await getConvexServerClient().mutation(
      api.app.updateWorkspaceBranding,
      withServerToken({
        ...input,
        logoImageStorageId: input.logoImageStorageId as
          | Id<"_storage">
          | undefined,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...UPDATE_WORKSPACE_BRANDING_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function deleteWorkspaceServer(input: {
  currentUserId: string
  workspaceId: string
}) {
  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.deleteWorkspace,
      withServerToken({
        ...input,
        origin,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...DELETE_WORKSPACE_ERROR_MAPPINGS]) ?? error
    )
  }
}

export async function removeWorkspaceUserServer(input: {
  currentUserId: string
  workspaceId: string
  userId: string
}) {
  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.removeWorkspaceUser,
      withServerToken({
        ...input,
        origin,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...REMOVE_WORKSPACE_USER_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function leaveWorkspaceServer(input: {
  currentUserId: string
  workspaceId: string
}) {
  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.leaveWorkspace,
      withServerToken({
        ...input,
        origin,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...LEAVE_WORKSPACE_ERROR_MAPPINGS]) ?? error
    )
  }
}

export async function deleteCurrentAccountServer(input: {
  currentUserId: string
}) {
  try {
    const origin = await resolveServerOrigin()

    return await runConvexRequestWithRetry("deleteCurrentAccountServer", () =>
      getConvexServerClient().mutation(
        api.app.deleteCurrentAccount,
        withServerToken({
          ...input,
          origin,
        })
      )
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...CURRENT_ACCOUNT_DELETION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function prepareCurrentAccountDeletionServer(input: {
  currentUserId: string
}) {
  try {
    return await runConvexRequestWithRetry(
      "prepareCurrentAccountDeletionServer",
      () =>
        getConvexServerClient().mutation(
          api.app.prepareCurrentAccountDeletion,
          withServerToken(input)
        )
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...CURRENT_ACCOUNT_DELETION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function cancelCurrentAccountDeletionServer(input: {
  currentUserId: string
}) {
  return runConvexRequestWithRetry("cancelCurrentAccountDeletionServer", () =>
    getConvexServerClient().mutation(
      api.app.cancelCurrentAccountDeletion,
      withServerToken(input)
    )
  )
}

export async function validateCurrentAccountDeletionServer(input: {
  currentUserId: string
}) {
  try {
    return await runConvexRequestWithRetry(
      "validateCurrentAccountDeletionServer",
      () =>
        getConvexServerClient().query(
          api.app.validateCurrentAccountDeletion,
          withServerToken(input)
        )
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...CURRENT_ACCOUNT_DELETION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function setWorkspaceWorkosOrganizationServer(input: {
  workspaceId: string
  workosOrganizationId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.setWorkspaceWorkosOrganization,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [
        ...SET_WORKSPACE_WORKOS_ORGANIZATION_ERROR_MAPPINGS,
      ]) ?? error
    )
  }
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
  try {
    return await getConvexServerClient().mutation(
      api.app.updateCurrentUserProfile,
      withServerToken({
        ...input,
        avatarImageStorageId: input.avatarImageStorageId as
          | Id<"_storage">
          | undefined,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [
        ...UPDATE_CURRENT_USER_PROFILE_ERROR_MAPPINGS,
      ]) ?? error
    )
  }
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
  try {
    return await getConvexServerClient().mutation(
      api.app.generateSettingsImageUploadUrl,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [
        ...GENERATE_SETTINGS_IMAGE_UPLOAD_URL_ERROR_MAPPINGS,
      ]) ?? error
    )
  }
}
