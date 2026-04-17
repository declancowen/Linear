import { saveSession } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

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
import {
  getWorkOSAuthErrorCode,
  getWorkOSAuthErrorMessage,
  getWorkOSClient,
  getWorkOSPendingAuthentication,
} from "@/lib/server/workos"

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), {
    status: request.method === "POST" ? 303 : 307,
  })
}

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

  if (
    code &&
    /already|exists|duplicate|conflict/i.test(code)
  ) {
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

function withSignupProfileParams(path: string, firstName: string, lastName: string) {
  const [pathname, existingQuery = ""] = path.split("?", 2)
  const searchParams = new URLSearchParams(existingQuery)
  searchParams.set("firstName", firstName)
  searchParams.set("lastName", lastName)
  const query = searchParams.toString()

  return query ? `${pathname}?${query}` : pathname
}

function getRequestMetadata(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || undefined
  const userAgent = request.headers.get("user-agent") || undefined

  return {
    ipAddress,
    userAgent,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const nextPath = normalizeAuthNextPath(url.searchParams.get("next"))

  return redirectTo(
    request,
    buildAuthPageHref("signup", {
      nextPath,
    })
  )
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const firstName = String(formData.get("firstName") ?? "").trim()
  const lastName = String(formData.get("lastName") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const nextPath = normalizeAuthNextPath(String(formData.get("next") ?? ""))

  if (!firstName || !lastName || !email || !password) {
    return redirectTo(
      request,
      withSignupProfileParams(
        buildAuthPageHref("signup", {
          nextPath,
          email,
          error: "Complete every field to create your account.",
          notice: null,
        }),
        firstName,
        lastName
      )
    )
  }

  try {
    await getWorkOSClient().userManagement.createUser({
      email,
      password,
      firstName,
      lastName,
    })
  } catch (error) {
    if (isSignupConflict(error)) {
      return redirectTo(
        request,
        buildAuthPageHref("login", {
          nextPath,
          email,
          notice: "Account already created. Please sign in.",
        })
      )
    }

    logProviderError("WorkOS signup failed", error)
    return redirectTo(
      request,
      withSignupProfileParams(
        buildAuthPageHref("signup", {
          nextPath,
          email,
          error: mapSignupError(error),
        }),
        firstName,
        lastName
      )
    )
  }

  try {
    const authenticationResponse =
      await getWorkOSClient().userManagement.authenticateWithPassword({
        clientId: process.env.WORKOS_CLIENT_ID,
        email,
        password,
        ...getRequestMetadata(request),
      })

    await saveSession(authenticationResponse, request.url)
    await reconcileAuthenticatedAppContext(
      authenticationResponse.user,
      authenticationResponse.organizationId
    )

    return redirectTo(request, buildPostAuthPath(nextPath))
  } catch (error) {
    const pendingAuthentication = getWorkOSPendingAuthentication(error)

    if (
      getWorkOSAuthErrorCode(error) === "email_verification_required" &&
      pendingAuthentication
    ) {
      const response = redirectTo(
        request,
        buildEmailVerificationPageHref({
          mode: "signup",
          nextPath,
          email: pendingAuthentication.email ?? email,
          notice: "Account created. Enter the WorkOS code to continue.",
        })
      )

      response.cookies.set(
        pendingEmailVerificationCookieName,
        serializePendingEmailVerificationState({
          email: pendingAuthentication.email ?? email,
          mode: "signup",
          nextPath,
          pendingAuthenticationToken:
            pendingAuthentication.pendingAuthenticationToken,
        }),
        pendingEmailVerificationCookieOptions
      )

      return response
    }

    logProviderError("WorkOS signup authentication failed", error)

    return redirectTo(
      request,
      withSignupProfileParams(
        buildAuthPageHref("signup", {
          nextPath,
          email,
          error:
            getWorkOSAuthErrorCode(error) === "invalid_password"
              ? "That password does not meet the current requirements."
              : mapSignupError(error),
        }),
        firstName,
        lastName
      )
    )
  }
}
