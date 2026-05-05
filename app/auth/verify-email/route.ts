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

const verificationErrorMessages: Record<string, string> = {
  invalid_grant: "That verification code was not accepted.",
}

function mapVerificationError(error: unknown) {
  return (
    verificationErrorMessages[getWorkOSAuthErrorCode(error) ?? ""] ??
    "We couldn't verify that code."
  )
}

function getVerificationFormContext(formData: FormData) {
  return {
    code: String(formData.get("code") ?? "").trim(),
    fallbackMode:
      parseAuthMode(String(formData.get("mode") ?? "")) ?? "login",
    fallbackNextPath: normalizeAuthNextPath(String(formData.get("next") ?? "")),
    fallbackEmail: String(formData.get("email") ?? "").trim(),
  }
}

function redirectExpiredVerificationSession(
  request: NextRequest,
  input: ReturnType<typeof getVerificationFormContext>
) {
  return redirectToRoute(
    request,
    buildAuthPageHref(input.fallbackMode, {
      nextPath: input.fallbackNextPath,
      email: input.fallbackEmail,
      error: "Your verification session expired. Sign in again.",
    })
  )
}

function redirectMissingVerificationCode(
  request: NextRequest,
  verificationState: NonNullable<
    ReturnType<typeof parsePendingEmailVerificationState>
  >
) {
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

async function authenticateEmailVerification(input: {
  code: string
  request: NextRequest
  verificationState: NonNullable<
    ReturnType<typeof parsePendingEmailVerificationState>
  >
}) {
  const authenticationResponse =
    await getWorkOSClient().userManagement.authenticateWithEmailVerification({
      clientId: process.env.WORKOS_CLIENT_ID,
      code: input.code,
      pendingAuthenticationToken:
        input.verificationState.pendingAuthenticationToken,
      ...getRequestMetadata(input.request),
    })

  await saveSession(authenticationResponse, input.request.url)
  await reconcileAuthenticatedAppContext(
    authenticationResponse.user,
    authenticationResponse.organizationId
  )
}

function redirectVerifiedEmail(
  request: NextRequest,
  verificationState: NonNullable<
    ReturnType<typeof parsePendingEmailVerificationState>
  >
) {
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
}

function redirectFailedEmailVerification(input: {
  error: unknown
  request: NextRequest
  verificationState: NonNullable<
    ReturnType<typeof parsePendingEmailVerificationState>
  >
}) {
  const pendingAuthentication = getWorkOSPendingAuthentication(input.error)
  const response = redirectToRoute(
    input.request,
    buildEmailVerificationPageHref({
      mode: input.verificationState.mode,
      nextPath: input.verificationState.nextPath,
      email: pendingAuthentication?.email ?? input.verificationState.email,
      error: mapVerificationError(input.error),
    })
  )

  if (pendingAuthentication) {
    response.cookies.set(
      pendingEmailVerificationCookieName,
      serializePendingEmailVerificationState({
        email: pendingAuthentication.email ?? input.verificationState.email,
        mode: input.verificationState.mode,
        nextPath: input.verificationState.nextPath,
        pendingAuthenticationToken:
          pendingAuthentication.pendingAuthenticationToken,
      }),
      pendingEmailVerificationCookieOptions
    )
  }

  return response
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
  const formContext = getVerificationFormContext(await request.formData())
  const verificationState = parsePendingEmailVerificationState(
    request.cookies.get(pendingEmailVerificationCookieName)?.value
  )

  if (!verificationState) {
    return redirectExpiredVerificationSession(request, formContext)
  }

  if (!formContext.code) {
    return redirectMissingVerificationCode(request, verificationState)
  }

  try {
    await authenticateEmailVerification({
      code: formContext.code,
      request,
      verificationState,
    })
    return redirectVerifiedEmail(request, verificationState)
  } catch (error) {
    return redirectFailedEmailVerification({
      error,
      request,
      verificationState,
    })
  }
}
