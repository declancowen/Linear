import { saveSession } from "@workos-inc/authkit-nextjs"
import { NextRequest } from "next/server"

import {
  clearPendingEmailVerificationCookieOptions,
  parsePendingEmailVerificationState,
  pendingEmailVerificationCookieName,
  pendingEmailVerificationCookieOptions,
  serializePendingEmailVerificationState,
} from "@/lib/auth-email-verification"
import {
  buildAuthPageHref,
  buildEmailVerificationPageHref,
  buildPostAuthPath,
  normalizeAuthNextPath,
  parseAuthMode,
} from "@/lib/auth-routing"
import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { getRequestMetadata } from "@/lib/server/auth-request"
import { redirectToRoute } from "@/lib/server/route-response"
import {
  getWorkOSAuthErrorCode,
  getWorkOSClient,
  getWorkOSPendingAuthentication,
} from "@/lib/server/workos"

function mapVerificationError(error: unknown) {
  switch (getWorkOSAuthErrorCode(error)) {
    case "invalid_grant":
      return "That verification code was not accepted."
    default:
      return "We couldn't verify that code."
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)

  return redirectToRoute(
    request,
    buildEmailVerificationPageHref({
      mode: parseAuthMode(url.searchParams.get("mode")) ?? "login",
      nextPath: url.searchParams.get("next"),
      email: url.searchParams.get("email"),
      error: url.searchParams.get("error"),
      notice: url.searchParams.get("notice"),
    })
  )
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const code = String(formData.get("code") ?? "").trim()
  const fallbackMode = parseAuthMode(String(formData.get("mode") ?? "")) ?? "login"
  const fallbackNextPath = normalizeAuthNextPath(
    String(formData.get("next") ?? "")
  )
  const fallbackEmail = String(formData.get("email") ?? "").trim()
  const verificationState = parsePendingEmailVerificationState(
    request.cookies.get(pendingEmailVerificationCookieName)?.value
  )

  if (!verificationState) {
    return redirectToRoute(
      request,
      buildAuthPageHref(fallbackMode, {
        nextPath: fallbackNextPath,
        email: fallbackEmail,
        error: "Your verification session expired. Sign in again.",
      })
    )
  }

  if (!code) {
    return redirectToRoute(
      request,
      buildEmailVerificationPageHref({
        mode: verificationState.mode,
        nextPath: verificationState.nextPath,
        email: verificationState.email,
        error: "Enter the verification code from WorkOS.",
      })
    )
  }

  try {
    const authenticationResponse =
      await getWorkOSClient().userManagement.authenticateWithEmailVerification({
        clientId: process.env.WORKOS_CLIENT_ID,
        code,
        pendingAuthenticationToken:
          verificationState.pendingAuthenticationToken,
        ...getRequestMetadata(request),
      })

    await saveSession(authenticationResponse, request.url)
    await reconcileAuthenticatedAppContext(
      authenticationResponse.user,
      authenticationResponse.organizationId
    )

    const response = redirectToRoute(
      request,
      buildPostAuthPath(verificationState.nextPath)
    )
    response.cookies.set(
      pendingEmailVerificationCookieName,
      "",
      clearPendingEmailVerificationCookieOptions
    )

    return response
  } catch (error) {
    const pendingAuthentication = getWorkOSPendingAuthentication(error)
    const response = redirectToRoute(
      request,
      buildEmailVerificationPageHref({
        mode: verificationState.mode,
        nextPath: verificationState.nextPath,
        email: pendingAuthentication?.email ?? verificationState.email,
        error: mapVerificationError(error),
      })
    )

    if (pendingAuthentication) {
      response.cookies.set(
        pendingEmailVerificationCookieName,
        serializePendingEmailVerificationState({
          email: pendingAuthentication.email ?? verificationState.email,
          mode: verificationState.mode,
          nextPath: verificationState.nextPath,
          pendingAuthenticationToken:
            pendingAuthentication.pendingAuthenticationToken,
        }),
        pendingEmailVerificationCookieOptions
      )
    }

    return response
  }
}
