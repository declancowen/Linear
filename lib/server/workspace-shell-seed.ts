import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import type { AppSnapshot } from "@/lib/domain/types"
import {
  defaultUserPreferences,
  defaultUserStatus,
  defaultUserStatusMessage,
} from "@/lib/domain/user-defaults"
import type { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

function getHandleFromEmail(email: string) {
  const handle = email.trim().split("@")[0]?.trim()
  return handle && handle.length > 0 ? handle : "user"
}

export function createMinimalWorkspaceShellSeed(input: {
  authContext: Awaited<ReturnType<typeof ensureAuthenticatedAppContext>>["authContext"]
}): ReadModelFetchResult<Partial<AppSnapshot>> {
  const currentUser = input.authContext?.currentUser
  const currentWorkspace = input.authContext?.currentWorkspace

  if (!currentUser || !currentWorkspace) {
    throw new Error("Workspace shell seed requires a current user and workspace")
  }

  return {
    data: {
      currentUserId: currentUser.id,
      currentWorkspaceId: currentWorkspace.id,
      users: [
        {
          id: currentUser.id,
          handle: getHandleFromEmail(currentUser.email),
          email: currentUser.email,
          name: currentUser.name,
          avatarUrl: currentUser.avatarUrl,
          avatarImageUrl: currentUser.avatarImageUrl ?? null,
          workosUserId: currentUser.workosUserId ?? null,
          title: "",
          status: defaultUserStatus,
          statusMessage: defaultUserStatusMessage,
          hasExplicitStatus: false,
          accountDeletionPendingAt: null,
          accountDeletedAt: null,
          preferences: defaultUserPreferences,
        },
      ],
      workspaces: [
        {
          id: currentWorkspace.id,
          slug: currentWorkspace.slug,
          name: currentWorkspace.name,
          logoUrl: currentWorkspace.logoUrl,
          logoImageUrl: null,
          createdBy: null,
          workosOrganizationId: currentWorkspace.workosOrganizationId ?? null,
          settings: {
            accent: "#000000",
            description: "",
          },
        },
      ],
    },
    replace: [
      {
        kind: "workspace-membership",
        workspaceId: currentWorkspace.id,
      },
    ],
  }
}
