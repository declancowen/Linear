import { saveSession } from "@workos-inc/authkit-nextjs"

import {
  pendingEmailVerificationCookieName,
  pendingEmailVerificationCookieOptions,
  serializePendingEmailVerificationState,
} from "@/lib/auth-email-verification"
import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  getWorkOSAuthErrorCode,
  getWorkOSClient,
  getWorkOSPendingAuthentication,
} from "@/lib/server/workos"
import {
  buildAuthPageHref,
  buildEmailVerificationPageHref,
  buildPostAuthPath,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"
import { getPasswordAuthFormFields } from "@/lib/auth-form"
import { listWorkspacesForSyncServer } from "@/lib/server/convex/auth"
import { getRequestMetadata } from "@/lib/server/auth-request"
import { redirectToRoute } from "@/lib/server/route-response"

const loginErrorMessages: Record<string, string> = {
  invalid_grant: "Invalid email or password.",
  invalid_credentials: "Invalid email or password.",
  mfa_enrollment:
    "This account requires MFA enrollment before sign in can continue.",
  mfa_challenge: "This account requires MFA to finish signing in.",
  organization_selection_required:
    "Choose an organization to continue signing in.",
  sso_required: "This account requires single sign-on.",
}

type LoginFormContext = {
  email: string
  password: string
  nextPath: string
}

type PendingLoginAuthentication = NonNullable<
  ReturnType<typeof getWorkOSPendingAuthentication>
>

type LoginWorkspace = Awaited<
  ReturnType<typeof listWorkspacesForSyncServer>
>[number]

function mapLoginError(error: unknown) {
  return (
    loginErrorMessages[getWorkOSAuthErrorCode(error) ?? ""] ??
    "We couldn't sign you in with those credentials."
  )
}

function normalizeLoginMatchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function getEmailDomainMatchValue(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1]

  if (!domain) {
    return null
  }

  return normalizeLoginMatchValue(domain.split(".")[0] ?? domain)
}

function getWorkspaceMatchValue(workspace: LoginWorkspace) {
  return [
    normalizeLoginMatchValue(workspace.slug),
    normalizeLoginMatchValue(workspace.name),
  ]
}

async function getLoginFormContext(request: Request): Promise<LoginFormContext> {
  const formData = await request.formData()

  return getPasswordAuthFormFields(formData)
}

function redirectToLoginError(
  request: Request,
  context: Pick<LoginFormContext, "email" | "nextPath">,
  error: string
) {
  return redirectToRoute(
    request,
    buildAuthPageHref("login", {
      nextPath: context.nextPath,
      email: context.email,
      error,
    })
  )
}

async function resolveLoginOrganizationId(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const workos = getWorkOSClient()
  const [users, workspaces] = await Promise.all([
    workos.userManagement.listUsers({ email: normalizedEmail }),
    listWorkspacesForSyncServer(),
  ])
  const matchingUsers = users.data.filter(
    (user) => user.email.toLowerCase() === normalizedEmail
  )

  if (matchingUsers.length !== 1) {
    return null
  }

  const memberships = await workos.userManagement.listOrganizationMemberships({
    userId: matchingUsers[0].id,
    statuses: ["active"],
  })
  const workspacesByOrganizationId = new Map(
    workspaces
      .filter((workspace) => workspace.workosOrganizationId)
      .map((workspace) => [workspace.workosOrganizationId, workspace])
  )
  const activeAppMemberships = memberships.data.flatMap((membership) => {
    if (membership.status !== "active") {
      return []
    }

    const workspace = workspacesByOrganizationId.get(membership.organizationId)

    return workspace ? [{ membership, workspace }] : []
  })
  const domainMatchValue = getEmailDomainMatchValue(normalizedEmail)

  if (domainMatchValue) {
    const domainMatchedMemberships = activeAppMemberships.filter((entry) =>
      getWorkspaceMatchValue(entry.workspace).includes(domainMatchValue)
    )

    if (domainMatchedMemberships.length === 1) {
      return domainMatchedMemberships[0].membership.organizationId
    }
  }

  if (activeAppMemberships.length === 1) {
    return activeAppMemberships[0].membership.organizationId
  }

  return null
}

async function authenticateLoginPassword(
  request: Request,
  context: Pick<LoginFormContext, "email" | "password">
) {
  const workos = getWorkOSClient()
  const requestMetadata = getRequestMetadata(request)
  let authenticationResponse

  try {
    authenticationResponse =
      await workos.userManagement.authenticateWithPassword({
        clientId: process.env.WORKOS_CLIENT_ID,
        email: context.email,
        password: context.password,
        ...requestMetadata,
      })
  } catch (error) {
    const pendingAuthentication = getWorkOSPendingAuthentication(error)

    if (
      getWorkOSAuthErrorCode(error) !== "organization_selection_required" ||
      !pendingAuthentication
    ) {
      throw error
    }

    const organizationId = await resolveLoginOrganizationId(context.email)

    if (!organizationId) {
      throw error
    }

    authenticationResponse =
      await workos.userManagement.authenticateWithOrganizationSelection({
        clientId: process.env.WORKOS_CLIENT_ID,
        pendingAuthenticationToken:
          pendingAuthentication.pendingAuthenticationToken,
        organizationId,
        ...requestMetadata,
      })
  }

  await saveSession(authenticationResponse, request.url)
  await reconcileAuthenticatedAppContext(
    authenticationResponse.user,
    authenticationResponse.organizationId
  )
}

function getPendingLoginEmailVerification(error: unknown) {
  const pendingAuthentication = getWorkOSPendingAuthentication(error)

  if (
    getWorkOSAuthErrorCode(error) !== "email_verification_required" ||
    !pendingAuthentication
  ) {
    return null
  }

  return pendingAuthentication
}

function redirectToLoginEmailVerification(
  request: Request,
  context: Pick<LoginFormContext, "email" | "nextPath">,
  pendingAuthentication: PendingLoginAuthentication
) {
  const email = pendingAuthentication.email ?? context.email
  const response = redirectToRoute(
    request,
    buildEmailVerificationPageHref({
      mode: "login",
      nextPath: context.nextPath,
      email,
      notice: "Enter the verification code WorkOS sent to continue.",
    })
  )

  response.cookies.set(
    pendingEmailVerificationCookieName,
    serializePendingEmailVerificationState({
      email,
      mode: "login",
      nextPath: context.nextPath,
      pendingAuthenticationToken:
        pendingAuthentication.pendingAuthenticationToken,
    }),
    pendingEmailVerificationCookieOptions
  )

  return response
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const nextPath = normalizeAuthNextPath(url.searchParams.get("next"))

  return redirectToRoute(
    request,
    buildAuthPageHref("login", {
      nextPath,
    })
  )
}

export async function POST(request: Request) {
  const context = await getLoginFormContext(request)

  if (!context.email || !context.password) {
    return redirectToLoginError(
      request,
      context,
      "Enter your email and password."
    )
  }

  try {
    await authenticateLoginPassword(request, context)
    return redirectToRoute(request, buildPostAuthPath(context.nextPath))
  } catch (error) {
    const pendingAuthentication = getPendingLoginEmailVerification(error)

    if (pendingAuthentication) {
      return redirectToLoginEmailVerification(
        request,
        context,
        pendingAuthentication
      )
    }

    return redirectToLoginError(request, context, mapLoginError(error))
  }
}
