import {
  pendingEmailVerificationCookieName,
  pendingEmailVerificationCookieOptions,
  serializePendingEmailVerificationState,
} from "@/lib/auth-email-verification"
import {
  buildAuthPageHref,
  buildEmailVerificationPageHref,
  buildPostAuthPath,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"
import { logProviderError } from "@/lib/server/provider-errors"
import {
  authenticateSignupPassword,
  createSignupUser,
  getPendingSignupEmailVerification,
  getSignupAuthenticationErrorMessage,
  getSignupFormFields,
  isSignupConflict,
  isSignupFormComplete,
  mapSignupError,
  type PendingSignupAuthentication,
  type SignupFormFields,
} from "@/lib/server/password-signup"
import { redirectToRoute } from "@/lib/server/route-response"

function redirectToSignupError(
  request: Request,
  fields: SignupFormFields,
  error: string
) {
  return redirectToRoute(
    request,
    buildAuthPageHref("signup", {
      nextPath: fields.nextPath,
      email: fields.email,
      firstName: fields.firstName,
      lastName: fields.lastName,
      error,
      notice: null,
    })
  )
}

function redirectToSignupFailure(
  request: Request,
  fields: SignupFormFields,
  error: unknown
) {
  return redirectToRoute(
    request,
    buildAuthPageHref("signup", {
      nextPath: fields.nextPath,
      email: fields.email,
      firstName: fields.firstName,
      lastName: fields.lastName,
      error: mapSignupError(error),
    })
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
  pendingAuthentication: PendingSignupAuthentication
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

async function authenticateCreatedSignupUser(
  request: Request,
  fields: SignupFormFields
) {
  try {
    await authenticateSignupPassword(request, fields)
    return redirectToRoute(request, buildPostAuthPath(fields.nextPath))
  } catch (error) {
    const pendingAuthentication = getPendingSignupEmailVerification(error)

    if (pendingAuthentication) {
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
