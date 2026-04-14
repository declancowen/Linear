import { createWorkOS, type Organization } from "@workos-inc/node"

import { splitName } from "@/lib/workos/auth"

type WorkOSAuthErrorPayload = {
  code?: string
  error?: string
  message?: string
  errorDescription?: string
  error_description?: string
  pendingAuthenticationToken?: string
  pending_authentication_token?: string
  email?: string
  user?: {
    email?: string
  }
}

export function getWorkOSClient() {
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

export function getWorkOSAuthErrorPayload(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null
  }

  const topLevelPayload = error as WorkOSAuthErrorPayload
  const rawDataPayload =
    "rawData" in error &&
    typeof error.rawData === "object" &&
    error.rawData !== null
      ? (error.rawData as WorkOSAuthErrorPayload)
      : null

  return {
    ...(rawDataPayload ?? {}),
    ...topLevelPayload,
    user: rawDataPayload?.user ?? topLevelPayload.user,
  }
}

export function getWorkOSAuthErrorCode(error: unknown) {
  const payload = getWorkOSAuthErrorPayload(error)
  return payload?.code ?? payload?.error ?? null
}

export function getWorkOSAuthErrorMessage(error: unknown) {
  const payload = getWorkOSAuthErrorPayload(error)
  return (
    payload?.message ??
    payload?.errorDescription ??
    payload?.error_description ??
    null
  )
}

export function getWorkOSPendingAuthentication(error: unknown) {
  const payload = getWorkOSAuthErrorPayload(error)
  const pendingAuthenticationToken =
    payload?.pendingAuthenticationToken ??
    payload?.pending_authentication_token

  if (!pendingAuthenticationToken) {
    return null
  }

  return {
    email:
      payload?.email ??
      (typeof payload?.user?.email === "string" ? payload.user.email : null),
    pendingAuthenticationToken,
  }
}

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  )
}

function getWorkOSErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "rawData" in error &&
    typeof error.rawData === "object" &&
    error.rawData !== null &&
    "error" in error.rawData &&
    typeof error.rawData.error === "string"
  ) {
    return error.rawData.error
  }

  return null
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

export async function requestWorkOSPasswordReset(email: string) {
  return getWorkOSClient().userManagement.createPasswordReset({
    email,
  })
}

export async function updateWorkOSUserEmail(input: {
  workosUserId: string | null
  email: string
}) {
  if (!input.workosUserId) {
    throw new Error("This account is not linked to WorkOS")
  }

  await getWorkOSClient().userManagement.updateUser({
    userId: input.workosUserId,
    email: input.email,
    emailVerified: false,
  })

  await getWorkOSClient().userManagement.sendVerificationEmail({
    userId: input.workosUserId,
  })
}

export async function resetWorkOSPassword(input: {
  token: string
  newPassword: string
}) {
  return getWorkOSClient().userManagement.resetPassword({
    token: input.token,
    newPassword: input.newPassword,
  })
}

export function mapWorkOSAccountError(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 409
  ) {
    return "That email address is already in use."
  }

  switch (getWorkOSErrorCode(error)) {
    case "user_not_found":
      return "We couldn't find an account for that email."
    case "invalid_password":
      return "The new password does not meet the current requirements."
    case "invalid_token":
      return "That password reset link is no longer valid."
    default:
      return fallback
  }
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
