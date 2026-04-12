import { NextResponse } from "next/server"

import { getWorkOSClient } from "@/lib/server/workos"
import {
  buildPortalPageHref,
  getPortalOrigin,
  normalizePortalAuthNextPath,
  parsePortalAppId,
  parsePortalAuthMode,
} from "@/lib/portal"

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, getPortalOrigin()))
}

function isLocalRedirectUri(redirectUri: string) {
  return (
    redirectUri.startsWith("http://localhost") ||
    redirectUri.startsWith("http://127.0.0.1")
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const appId = parsePortalAppId(url.searchParams.get("app"))
  const mode = parsePortalAuthMode(url.searchParams.get("mode")) ?? "login"
  const nextPath = normalizePortalAuthNextPath(url.searchParams.get("next"), appId)
  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI

  if (!redirectUri) {
    return redirectTo(
      request,
      buildPortalPageHref(mode, {
        appId,
        nextPath,
        error: "WorkOS redirect URI is not configured.",
      })
    )
  }

  if (isLocalRedirectUri(redirectUri)) {
    return redirectTo(
      request,
      buildPortalPageHref(mode, {
        appId,
        nextPath,
        error:
          "Google sign-in needs a public HTTPS callback. Use the deployed portal URL or a sandbox WorkOS client for local testing.",
      })
    )
  }

  const authorizationUrl = getWorkOSClient().userManagement.getAuthorizationUrl({
    clientId: process.env.WORKOS_CLIENT_ID,
    provider: "GoogleOAuth",
    redirectUri,
    state: JSON.stringify({
      appId,
      mode,
      nextPath,
    }),
  })

  return NextResponse.redirect(authorizationUrl)
}
