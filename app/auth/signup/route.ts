import { saveSession } from "@workos-inc/authkit-nextjs"

import {
  pendingEmailVerificationCookieName,
  pendingEmailVerificationCookieOptions,
  serializePendingEmailVerificationState,
} from "@/lib/auth-email-verification"
import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  buildAuthPageHref,
  buildEmailVerificationPageHref,
  buildPostAuthPath,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"
import { logProviderError } from "@/lib/server/provider-errors"
import { getRequestMetadata } from "@/lib/server/auth-request"
import { redirectToRoute } from "@/lib/server/route-response"
import {
  getWorkOSAuthErrorCode,
  getWorkOSAuthErrorMessage,
  getWorkOSClient,
  getWorkOSPendingAuthentication,
} from "@/lib/server/workos"

function mapSignupError(error: unknown) {
  const code = getWorkOSAuthErrorCode(error)
  const message =
    getWorkOSAuthErrorMessage(error) ??
    (typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : null)

  if (code && /already|exists|duplicate|conflict/i.test(code)) {
    return "Account already created. Please sign in."
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 409
  ) {
    return "An account already exists for that email."
  }

  if (
    message &&
    /already exists|already in use|already associated/i.test(message)
  ) {
    return "An account already exists for that email."
  }

  if (message) {
    return message.replace(/\s+/g, " ").trim()
  }

  return "We couldn't create that account."
}

function isSignupConflict(error: unknown) {
  const code = getWorkOSAuthErrorCode(error)

  if (code && /already|exists|duplicate|conflict/i.test(code)) {
    return true
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 409
  ) {
    return true
  }

  const message =
    getWorkOSAuthErrorMessage(error) ??
    (typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : null)

  return Boolean(
    message && /already exists|already in use|already associated/i.test(message)
  )
}

function withSignupProfileParams(
  path: string,
  firstName: string,
  lastName: string
) {
  const [pathname, existingQuery = ""] = path.split("?", 2)
  const searchParams = new URLSearchParams(existingQuery)
  searchParams.set("firstName", firstName)
  searchParams.set("lastName", lastName)
  const query = searchParams.toString()

  return query ? `${pathname}?${query}` : pathname
}

type SignupFormFields = {
  email: string
  firstName: string
  lastName: string
  nextPath: string
  password: string
}

async function getSignupFormFields(
  request: Request
): Promise<SignupFormFields> {
  const formData = await request.formData()

  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    nextPath: normalizeAuthNextPath(String(formData.get("next") ?? "")),
  }
}

function isSignupFormComplete(fields: SignupFormFields) {
  return Boolean(
    fields.firstName && fields.lastName && fields.email && fields.password
  )
}

function redirectToSignupError(
  request: Request,
  fields: SignupFormFields,
  error: string
) {
  return redirectToRoute(
    request,
    withSignupProfileParams(
      buildAuthPageHref("signup", {
        nextPath: fields.nextPath,
        email: fields.email,
        error,
        notice: null,
      }),
      fields.firstName,
      fields.lastName
    )
  )
}

function redirectToSignupFailure(
  request: Request,
  fields: SignupFormFields,
  error: unknown
) {
  return redirectToRoute(
    request,
    withSignupProfileParams(
      buildAuthPageHref("signup", {
        nextPath: fields.nextPath,
        email: fields.email,
        error: mapSignupError(error),
      }),
      fields.firstName,
      fields.lastName
    )
  )
}

function redirectToExistingAccountLogin(
  request: Request,
  fields: SignupFormFields
) {
  return redirectToRoute(
    request,
    buildAuthPageHref("login", {
      nextPath: fields.nextPath,
      email: fields.email,
      notice: "Account already created. Please sign in.",
    })
  )
}

async function createSignupUser(fields: SignupFormFields) {
  await getWorkOSClient().userManagement.createUser({
    email: fields.email,
    password: fields.password,
    firstName: fields.firstName,
    lastName: fields.lastName,
  })
}

async function handleSignupUserCreation(
  request: Request,
  fields: SignupFormFields
) {
  try {
    await createSignupUser(fields)
    return null
  } catch (error) {
    if (isSignupConflict(error)) {
      return redirectToExistingAccountLogin(request, fields)
    }

    logProviderError("WorkOS signup failed", error)
    return redirectToSignupFailure(request, fields, error)
  }
}

function redirectToSignupEmailVerification(
  request: Request,
  fields: SignupFormFields,
  pendingAuthentication: NonNullable<
    ReturnType<typeof getWorkOSPendingAuthentication>
  >
) {
  const email = pendingAuthentication.email ?? fields.email
  const response = redirectToRoute(
    request,
    buildEmailVerificationPageHref({
      mode: "signup",
      nextPath: fields.nextPath,
      email,
      notice: "Account created. Enter the WorkOS code to continue.",
    })
  )

  response.cookies.set(
    pendingEmailVerificationCookieName,
    serializePendingEmailVerificationState({
      email,
      mode: "signup",
      nextPath: fields.nextPath,
      pendingAuthenticationToken:
        pendingAuthentication.pendingAuthenticationToken,
    }),
    pendingEmailVerificationCookieOptions
  )

  return response
}

function getSignupAuthenticationErrorMessage(error: unknown) {
  return getWorkOSAuthErrorCode(error) === "invalid_password"
    ? "That password does not meet the current requirements."
    : mapSignupError(error)
}

async function authenticateCreatedSignupUser(
  request: Request,
  fields: SignupFormFields
) {
  try {
    const authenticationResponse =
      await getWorkOSClient().userManagement.authenticateWithPassword({
        clientId: process.env.WORKOS_CLIENT_ID,
        email: fields.email,
        password: fields.password,
        ...getRequestMetadata(request),
      })

    await saveSession(authenticationResponse, request.url)
    await reconcileAuthenticatedAppContext(
      authenticationResponse.user,
      authenticationResponse.organizationId
    )

    return redirectToRoute(request, buildPostAuthPath(fields.nextPath))
  } catch (error) {
    const pendingAuthentication = getWorkOSPendingAuthentication(error)

    if (
      getWorkOSAuthErrorCode(error) === "email_verification_required" &&
      pendingAuthentication
    ) {
      return redirectToSignupEmailVerification(
        request,
        fields,
        pendingAuthentication
      )
    }

    logProviderError("WorkOS signup authentication failed", error)
    return redirectToSignupError(
      request,
      fields,
      getSignupAuthenticationErrorMessage(error)
    )
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const nextPath = normalizeAuthNextPath(url.searchParams.get("next"))

  return redirectToRoute(
    request,
    buildAuthPageHref("signup", {
      nextPath,
    })
  )
}

export async function POST(request: Request) {
  const fields = await getSignupFormFields(request)

  if (!isSignupFormComplete(fields)) {
    return redirectToSignupError(
      request,
      fields,
      "Complete every field to create your account."
    )
  }

  const creationResponse = await handleSignupUserCreation(request, fields)

  if (creationResponse) {
    return creationResponse
  }

  return authenticateCreatedSignupUser(request, fields)
}
