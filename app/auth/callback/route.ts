import { saveSession } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { getWorkOSClient } from "@/lib/server/workos"
import {
  buildAuthPageHref,
  buildPostAuthPath,
  getAppOrigin,
  parseAuthState,
} from "@/lib/auth-routing"

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, getAppOrigin()))
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
  const code = url.searchParams.get("code")
  const state = parseAuthState(url.searchParams.get("state") ?? undefined)
  const error = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_description")

  if (error) {
    return redirectTo(
      request,
      buildAuthPageHref(state?.mode ?? "login", {
        nextPath: state?.nextPath,
        error:
          errorDescription ??
          "We couldn't complete authentication with that provider.",
      })
    )
  }

  if (!code) {
    return redirectTo(
      request,
      buildAuthPageHref(state?.mode ?? "login", {
        nextPath: state?.nextPath,
        error: "Missing authorization code from WorkOS.",
      })
    )
  }

  try {
    const authenticationResponse =
      await getWorkOSClient().userManagement.authenticateWithCode({
        clientId: process.env.WORKOS_CLIENT_ID,
        code,
        ...getRequestMetadata(request),
      })

    await saveSession(authenticationResponse, request.url)
    await reconcileAuthenticatedAppContext(
      authenticationResponse.user,
      authenticationResponse.organizationId
    )

    return redirectTo(
      request,
      buildPostAuthPath(state?.nextPath)
    )
  } catch {
    return redirectTo(
      request,
      buildAuthPageHref(state?.mode ?? "login", {
        nextPath: state?.nextPath,
        error: "We couldn't complete authentication with that provider.",
      })
    )
  }
}
