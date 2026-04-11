import { createWorkOS, type Organization } from "@workos-inc/node"

import { splitName } from "@/lib/workos/auth"

function getWorkOSClient() {
  const apiKey = process.env.WORKOS_API_KEY
  const clientId = process.env.WORKOS_CLIENT_ID

  if (!apiKey || !clientId) {
    throw new Error("WorkOS is not configured")
  }

  return createWorkOS({
    apiKey,
    clientId,
  })
}

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  )
}

async function getOrganizationByWorkspaceExternalId(workspaceId: string) {
  try {
    return await getWorkOSClient().organizations.getOrganizationByExternalId(
      workspaceId
    )
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throw error
  }
}

export async function ensureWorkspaceOrganization(input: {
  workspaceId: string
  slug: string
  name: string
  existingOrganizationId: string | null
}) {
  const workos = getWorkOSClient()
  const metadata = {
    slug: input.slug,
    workspaceId: input.workspaceId,
  }

  let organization: Organization | null = null

  if (input.existingOrganizationId) {
    organization = await workos.organizations.updateOrganization({
      organization: input.existingOrganizationId,
      name: input.name,
      externalId: input.workspaceId,
      metadata,
    })

    return organization
  }

  organization = await getOrganizationByWorkspaceExternalId(input.workspaceId)

  if (organization) {
    return workos.organizations.updateOrganization({
      organization: organization.id,
      name: input.name,
      externalId: input.workspaceId,
      metadata,
    })
  }

  return workos.organizations.createOrganization({
    name: input.name,
    externalId: input.workspaceId,
    metadata,
  })
}

export async function syncUserProfileToWorkOS(input: {
  workosUserId: string | null
  name: string
}) {
  if (!input.workosUserId) {
    return null
  }

  const { firstName, lastName } = splitName(input.name)

  return getWorkOSClient().userManagement.updateUser({
    userId: input.workosUserId,
    firstName,
    lastName,
  })
}

export async function ensureUserOrganizationMembership(input: {
  organizationId: string
  workosUserId: string
}) {
  const workos = getWorkOSClient()
  const memberships = await workos.userManagement.listOrganizationMemberships({
    organizationId: input.organizationId,
    userId: input.workosUserId,
  })
  const existingMembership = memberships.data[0]

  if (existingMembership) {
    if (existingMembership.status === "inactive") {
      return workos.userManagement.reactivateOrganizationMembership(
        existingMembership.id
      )
    }

    return existingMembership
  }

  return workos.userManagement.createOrganizationMembership({
    organizationId: input.organizationId,
    userId: input.workosUserId,
  })
}
