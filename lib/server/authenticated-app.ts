import type { User } from "@workos-inc/node"

import {
  ensureConvexUserFromAuth,
  getAuthContextServer,
  setWorkspaceWorkosOrganizationServer,
} from "@/lib/server/convex"
import {
  ensureUserOrganizationMembership,
  ensureWorkspaceOrganization,
} from "@/lib/server/workos"
import { toAuthenticatedAppUser } from "@/lib/workos/auth"

export async function ensureAuthenticatedAppContext(
  sessionUser: User,
  organizationId?: string
) {
  const authenticatedUser = toAuthenticatedAppUser(sessionUser, organizationId)
  const ensuredUser = await ensureConvexUserFromAuth(authenticatedUser)
  const authContext = await getAuthContextServer(authenticatedUser.email)

  if (authContext?.currentWorkspace) {
    const organization = await ensureWorkspaceOrganization({
      workspaceId: authContext.currentWorkspace.id,
      slug: authContext.currentWorkspace.slug,
      name: authContext.currentWorkspace.name,
      existingOrganizationId: authContext.currentWorkspace.workosOrganizationId,
    })

    if (organization.id !== authContext.currentWorkspace.workosOrganizationId) {
      await setWorkspaceWorkosOrganizationServer({
        workspaceId: authContext.currentWorkspace.id,
        workosOrganizationId: organization.id,
      })
    }

    await ensureUserOrganizationMembership({
      organizationId: organization.id,
      workosUserId: authenticatedUser.workosUserId,
    })

    return {
      authenticatedUser,
      ensuredUser,
      authContext: {
        ...authContext,
        currentWorkspace: {
          ...authContext.currentWorkspace,
          workosOrganizationId: organization.id,
        },
      },
    }
  }

  return {
    authenticatedUser,
    ensuredUser,
    authContext,
  }
}
