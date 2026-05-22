import { normalizeAuthNextPath } from "@/lib/auth-routing"
import { buildDesktopAuthCompleteUrl } from "@/lib/server/desktop-auth"
import { createDesktopHandoffTicket } from "@/lib/server/desktop-session"
import {
  authenticateSignupPassword,
  createSignupUser,
  getPendingSignupEmailVerification,
  getSignupAuthenticationErrorMessage,
  getSignupFormFields,
  isSignupConflict,
  isSignupFormComplete,
  mapSignupError,
  type SignupFormFields,
} from "@/lib/server/password-signup"
import { logProviderError } from "@/lib/server/provider-errors"
import { redirectToRoute } from "@/lib/server/route-response"

function redirectToDesktopSignupError(
  request: Request,
  fields: SignupFormFields,
  error: string
) {
  return redirectToRoute(
    request,
    buildDesktopAuthCompleteUrl({
      mode: "signup",
      nextPath: fields.nextPath,
      email: fields.email,
      firstName: fields.firstName,
      lastName: fields.lastName,
      error,
    })
  )
}

function redirectToDesktopExistingAccountLogin(
  request: Request,
  fields: SignupFormFields
) {
  return redirectToRoute(
    request,
    buildDesktopAuthCompleteUrl({
      mode: "login",
      nextPath: fields.nextPath,
      email: fields.email,
      notice: "Account already created. Please sign in.",
    })
  )
}

function redirectToDesktopSignupEmailVerification(
  request: Request,
  fields: SignupFormFields
) {
  return redirectToRoute(
    request,
    buildDesktopAuthCompleteUrl({
      mode: "login",
      nextPath: fields.nextPath,
      email: fields.email,
      error:
        "Email verification is required before desktop sign-in. Verify your email on the web app, then sign in again.",
    })
  )
}

async function handleDesktopSignupUserCreation(
  request: Request,
  fields: SignupFormFields
) {
  try {
    await createSignupUser(fields)
    return null
  } catch (error) {
    if (isSignupConflict(error)) {
      return redirectToDesktopExistingAccountLogin(request, fields)
    }

    logProviderError("WorkOS desktop signup failed", error)
    return redirectToDesktopSignupError(request, fields, mapSignupError(error))
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  return redirectToRoute(
    request,
    buildDesktopAuthCompleteUrl({
      mode: "signup",
      nextPath: normalizeAuthNextPath(url.searchParams.get("next")),
      error: "Complete every field to create your account.",
    })
  )
}

export async function POST(request: Request) {
  const fields = await getSignupFormFields(request)

  if (!isSignupFormComplete(fields)) {
    return redirectToDesktopSignupError(
      request,
      fields,
      "Complete every field to create your account."
    )
  }

  const creationResponse = await handleDesktopSignupUserCreation(
    request,
    fields
  )

  if (creationResponse) {
    return creationResponse
  }

  try {
    const authenticationResponse = await authenticateSignupPassword(
      request,
      fields
    )
    const { ticket } = createDesktopHandoffTicket({
      organizationId: authenticationResponse.organizationId,
      user: authenticationResponse.user,
    })

    return redirectToRoute(
      request,
      buildDesktopAuthCompleteUrl({
        nextPath: fields.nextPath,
        ticket,
      })
    )
  } catch (error) {
    if (getPendingSignupEmailVerification(error)) {
      return redirectToDesktopSignupEmailVerification(request, fields)
    }

    logProviderError("WorkOS desktop signup authentication failed", error)
    return redirectToDesktopSignupError(
      request,
      fields,
      getSignupAuthenticationErrorMessage(error)
    )
  }
}
