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
import {
  authenticateLoginPassword,
  getLoginFormContext,
  getPendingLoginEmailVerification,
  mapLoginError,
  type LoginFormContext,
  type PendingLoginAuthentication,
} from "@/lib/server/password-login"
import { redirectToRoute } from "@/lib/server/route-response"

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
