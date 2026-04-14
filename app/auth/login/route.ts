import { saveSession } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

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

function getRequestMetadata(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || undefined
  const userAgent = request.headers.get("user-agent") || undefined

  return {
    ipAddress,
    userAgent,
  }
}

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), {
    status: request.method === "POST" ? 303 : 307,
  })
}

function mapLoginError(error: unknown) {
  switch (getWorkOSAuthErrorCode(error)) {
    case "invalid_grant":
    case "invalid_credentials":
      return "Invalid email or password."
    case "mfa_enrollment":
      return "This account requires MFA enrollment before sign in can continue."
    case "mfa_challenge":
      return "This account requires MFA to finish signing in."
    case "organization_selection_required":
      return "Choose an organization to continue signing in."
    case "sso_required":
      return "This account requires single sign-on."
    default:
      return "We couldn't sign you in with those credentials."
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const nextPath = normalizeAuthNextPath(url.searchParams.get("next"))

  return redirectTo(
    request,
    buildAuthPageHref("login", {
      nextPath,
    })
  )
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const nextPath = normalizeAuthNextPath(String(formData.get("next") ?? ""))

  if (!email || !password) {
    return redirectTo(
      request,
      buildAuthPageHref("login", {
        nextPath,
        email,
        error: "Enter your email and password.",
      })
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
          mode: "login",
          nextPath,
          email: pendingAuthentication.email ?? email,
          notice: "Enter the verification code WorkOS sent to continue.",
        })
      )

      response.cookies.set(
        pendingEmailVerificationCookieName,
        serializePendingEmailVerificationState({
          email: pendingAuthentication.email ?? email,
          mode: "login",
          nextPath,
          pendingAuthenticationToken:
            pendingAuthentication.pendingAuthenticationToken,
        }),
        pendingEmailVerificationCookieOptions
      )

      return response
    }

    return redirectTo(
      request,
      buildAuthPageHref("login", {
        nextPath,
        email,
        error: mapLoginError(error),
      })
    )
  }
}
