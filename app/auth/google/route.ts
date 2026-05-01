import { getWorkOSClient } from "@/lib/server/workos"
import {
  buildAuthPageHref,
  normalizeAuthNextPath,
  parseAuthMode,
} from "@/lib/auth-routing"
import { redirectToRoute } from "@/lib/server/route-response"

function isLocalRedirectUri(redirectUri: string) {
  return (
    redirectUri.startsWith("http://localhost") ||
    redirectUri.startsWith("http://127.0.0.1")
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = parseAuthMode(url.searchParams.get("mode")) ?? "login"
  const nextPath = normalizeAuthNextPath(url.searchParams.get("next"))
  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI

  if (!redirectUri) {
    return redirectToRoute(
      request,
      buildAuthPageHref(mode, {
        nextPath,
        error: "WorkOS redirect URI is not configured.",
      })
    )
  }

  if (isLocalRedirectUri(redirectUri)) {
    return redirectToRoute(
      request,
      buildAuthPageHref(mode, {
        nextPath,
        error:
          "Google sign-in needs a public HTTPS callback. Use the deployed teams URL or a sandbox WorkOS client for local testing.",
      })
    )
  }

  const authorizationUrl = getWorkOSClient().userManagement.getAuthorizationUrl({
    clientId: process.env.WORKOS_CLIENT_ID,
    provider: "GoogleOAuth",
    redirectUri,
    state: JSON.stringify({
      mode,
      nextPath,
    }),
  })

  return redirectToRoute(request, authorizationUrl)
}
