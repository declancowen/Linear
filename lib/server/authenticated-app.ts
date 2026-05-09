import type { User } from "@workos-inc/node"

import {
  ensureConvexUserFromAuth,
  ensureWorkspaceScaffoldingServer,
  getAuthContextServer,
  getWorkspaceMembershipBootstrapServer,
  setWorkspaceWorkosOrganizationServer,
} from "@/lib/server/convex"
import {
  ensureUserOrganizationMembership,
  ensureWorkspaceOrganization,
} from "@/lib/server/workos"
import { getSelectedWorkspaceIdFromCookies } from "@/lib/server/workspace-selection"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

function enrichOrganizationId<
  T extends {
    authenticatedUser: ReturnType<typeof toAuthenticatedAppUser>
    ensuredUser: { userId: string; bootstrapped: boolean }
    authContext: Awaited<ReturnType<typeof getAuthContextServer>>
  },
>(context: T, organizationId: string) {
  if (!context.authContext?.currentWorkspace) {
    return context
  }

  return {
    ...context,
    authContext: {
      ...context.authContext,
      currentWorkspace: {
        ...context.authContext.currentWorkspace,
        workosOrganizationId: organizationId,
      },
    },
  }
}

type AuthenticatedAppContext = {
  authenticatedUser: ReturnType<typeof toAuthenticatedAppUser>
  ensuredUser: { userId: string; bootstrapped: boolean } | null
  authContext: Awaited<ReturnType<typeof getAuthContextServer>>
}

type WorkspaceMembershipBootstrap = Awaited<
  ReturnType<typeof getWorkspaceMembershipBootstrapServer>
>

function getWorkspaceFromBootstrap(
  data: WorkspaceMembershipBootstrap,
  workspaceId: string
) {
  return (
    data.workspaces.find((workspace) => workspace.id === workspaceId) ?? null
  )
}

function getWorkspaceAdminState(input: {
  data: WorkspaceMembershipBootstrap
  userId: string
  workspaceId: string
}) {
  const workspace = getWorkspaceFromBootstrap(input.data, input.workspaceId)
  const workspaceTeamIds = new Set(
    input.data.teams
      .filter((team) => team.workspaceId === input.workspaceId)
      .map((team) => team.id)
  )
  const isWorkspaceOwner = workspace?.createdBy === input.userId
  const hasWorkspaceAdminMembership = input.data.workspaceMemberships.some(
    (membership) =>
      membership.workspaceId === input.workspaceId &&
      membership.userId === input.userId &&
      membership.role === "admin"
  )
  const hasTeamAdminMembership = input.data.teamMemberships.some(
    (membership) =>
      membership.userId === input.userId &&
      membership.role === "admin" &&
      workspaceTeamIds.has(membership.teamId)
  )

  return {
    isWorkspaceOwner,
    isWorkspaceAdmin:
      isWorkspaceOwner || hasWorkspaceAdminMembership || hasTeamAdminMembership,
  }
}

async function applySelectedWorkspaceOverride<
  T extends AuthenticatedAppContext,
>(context: T) {
  const selectedWorkspaceId = await getSelectedWorkspaceIdFromCookies()

  if (
    !selectedWorkspaceId ||
    !context.authContext?.currentUser ||
    selectedWorkspaceId === context.authContext.currentWorkspace?.id
  ) {
    return context
  }

  try {
    const data = await getWorkspaceMembershipBootstrapServer({
      workosUserId: context.authenticatedUser.workosUserId,
      email: context.authenticatedUser.email,
      workspaceId: selectedWorkspaceId,
    })

    if (data.currentWorkspaceId !== selectedWorkspaceId) {
      return context
    }

    const selectedWorkspace = getWorkspaceFromBootstrap(
      data,
      selectedWorkspaceId
    )

    if (!selectedWorkspace) {
      return context
    }

    const workspaceAdminState = getWorkspaceAdminState({
      data,
      userId: context.authContext.currentUser.id,
      workspaceId: selectedWorkspaceId,
    })

    return {
      ...context,
      authContext: {
        ...context.authContext,
        currentWorkspace: {
          id: selectedWorkspace.id,
          slug: selectedWorkspace.slug,
          name: selectedWorkspace.name,
          logoUrl: selectedWorkspace.logoUrl,
          workosOrganizationId: selectedWorkspace.workosOrganizationId ?? null,
        },
        ...workspaceAdminState,
      },
    }
  } catch (error) {
    console.warn("Failed to apply selected workspace override", error)
    return context
  }
}

async function loadAuthenticatedAppContext(
  sessionUser: User,
  organizationId?: string,
  options?: {
    syncUserFromAuth?: boolean
  }
) {
  const authenticatedUser = toAuthenticatedAppUser(sessionUser, organizationId)

  if (options?.syncUserFromAuth) {
    const ensuredUser = await ensureConvexUserFromAuth(authenticatedUser)
    const authContext = await getAuthContextServer({
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
    })

    return applySelectedWorkspaceOverride({
      authenticatedUser,
      ensuredUser,
      authContext,
    })
  }

  let authContext = await getAuthContextServer({
    workosUserId: authenticatedUser.workosUserId,
    email: authenticatedUser.email,
  })
  let ensuredUser = authContext?.currentUser
    ? {
        userId: authContext.currentUser.id,
        bootstrapped: false,
      }
    : null

  if (!ensuredUser) {
    ensuredUser = await ensureConvexUserFromAuth(authenticatedUser)
    authContext = await getAuthContextServer({
      workosUserId: authenticatedUser.workosUserId,
      email: authenticatedUser.email,
    })
  }

  return applySelectedWorkspaceOverride({
    authenticatedUser,
    ensuredUser,
    authContext,
  })
}

export async function ensureAuthenticatedAppContext(
  sessionUser: User,
  organizationId?: string
) {
  return loadAuthenticatedAppContext(sessionUser, organizationId)
}

export async function getWorkspaceEntryJoinState(
  sessionUser: User,
  organizationId?: string
) {
  const { authContext } = await ensureAuthenticatedAppContext(
    sessionUser,
    organizationId
  )

  return {
    authContext,
    pendingInvites: authContext?.pendingInvites ?? [],
    joinedTeamIds: authContext?.memberships.map((entry) => entry.teamId) ?? [],
    currentWorkspace: authContext?.currentWorkspace ?? null,
  }
}

export async function reconcileAuthenticatedAppContext(
  sessionUser: User,
  organizationId?: string
) {
  const context = await loadAuthenticatedAppContext(
    sessionUser,
    organizationId,
    {
      syncUserFromAuth: true,
    }
  )

  if (!context.authContext?.currentWorkspace) {
    return context
  }

  const organization = await ensureWorkspaceOrganization({
    workspaceId: context.authContext.currentWorkspace.id,
    slug: context.authContext.currentWorkspace.slug,
    name: context.authContext.currentWorkspace.name,
    existingOrganizationId:
      context.authContext.currentWorkspace.workosOrganizationId,
  })

  if (
    organization.id !==
    context.authContext.currentWorkspace.workosOrganizationId
  ) {
    await setWorkspaceWorkosOrganizationServer({
      workspaceId: context.authContext.currentWorkspace.id,
      workosOrganizationId: organization.id,
    })
  }

  await ensureUserOrganizationMembership({
    organizationId: organization.id,
    workosUserId: context.authenticatedUser.workosUserId,
  })
  await ensureWorkspaceScaffoldingServer({
    currentUserId: context.ensuredUser.userId,
    workspaceId: context.authContext.currentWorkspace.id,
  })

  return enrichOrganizationId(context, organization.id)
}
