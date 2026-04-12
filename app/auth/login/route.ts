import { saveSession } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { getWorkOSClient } from "@/lib/server/workos"
import {
  buildPortalPageHref,
  buildPortalPostAuthPath,
  getPortalOrigin,
  normalizePortalAuthNextPath,
  parsePortalAppId,
} from "@/lib/portal"

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
  return NextResponse.redirect(new URL(path, getPortalOrigin()), {
    status: request.method === "POST" ? 303 : 307,
  })
}

function mapLoginError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "rawData" in error &&
    typeof error.rawData === "object" &&
    error.rawData !== null &&
    "error" in error.rawData &&
    typeof error.rawData.error === "string"
  ) {
    switch (error.rawData.error) {
      case "invalid_grant":
      case "invalid_credentials":
        return "Invalid email or password."
      case "mfa_enrollment":
        return "This account requires MFA enrollment before sign in can continue."
      case "sso_required":
        return "This account requires single sign-on."
      default:
        return "We couldn't sign you in with those credentials."
    }
  }

  return "We couldn't sign you in with those credentials."
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const appId = parsePortalAppId(url.searchParams.get("app"))
  const nextPath = normalizePortalAuthNextPath(url.searchParams.get("next"), appId)

  return redirectTo(
    request,
    buildPortalPageHref("login", {
      appId,
      nextPath,
    })
  )
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const appId = parsePortalAppId(String(formData.get("app") ?? ""))
  const nextPath = normalizePortalAuthNextPath(
    String(formData.get("next") ?? ""),
    appId
  )

  if (!email || !password) {
    return redirectTo(
      request,
      buildPortalPageHref("login", {
        appId,
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
    await ensureAuthenticatedAppContext(
      authenticationResponse.user,
      authenticationResponse.organizationId
    )

    return redirectTo(request, buildPortalPostAuthPath(appId, nextPath))
  } catch (error) {
    return redirectTo(
      request,
      buildPortalPageHref("login", {
        appId,
        nextPath,
        email,
        error: mapLoginError(error),
      })
    )
  }
}
