import type { User } from "@workos-inc/node"

import {
  ensureConvexUserFromAuth,
  ensureWorkspaceScaffoldingServer,
  getAuthContextServer,
  setWorkspaceWorkosOrganizationServer,
} from "@/lib/server/convex"
import {
  ensureUserOrganizationMembership,
  ensureWorkspaceOrganization,
} from "@/lib/server/workos"
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

    return {
      authenticatedUser,
      ensuredUser,
      authContext,
    }
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

  return {
    authenticatedUser,
    ensuredUser,
    authContext,
  }
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
  const context = await loadAuthenticatedAppContext(sessionUser, organizationId, {
    syncUserFromAuth: true,
  })

  if (!context.authContext?.currentWorkspace) {
    return context
  }

  const organization = await ensureWorkspaceOrganization({
    workspaceId: context.authContext.currentWorkspace.id,
    slug: context.authContext.currentWorkspace.slug,
    name: context.authContext.currentWorkspace.name,
    existingOrganizationId: context.authContext.currentWorkspace.workosOrganizationId,
  })

  if (organization.id !== context.authContext.currentWorkspace.workosOrganizationId) {
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
