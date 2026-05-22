import { getWorkOSClient } from "@/lib/server/workos"
import {
  createDesktopAuthState,
  getDesktopWorkOSRedirectUri,
  setDesktopAuthStateCookie,
} from "@/lib/server/desktop-auth"
import { getAuthStartContext } from "@/lib/server/auth-start"
import { redirectToRoute } from "@/lib/server/route-response"

export async function GET(request: Request) {
  const { mode, nextPath, url } = getAuthStartContext(request)
  const provider =
    url.searchParams.get("provider") === "google" ? "GoogleOAuth" : "authkit"
  const redirectUri = getDesktopWorkOSRedirectUri()
  const authState = createDesktopAuthState({
    mode,
    nextPath,
  })
  const authorizationUrl = getWorkOSClient().userManagement.getAuthorizationUrl({
    clientId: process.env.WORKOS_CLIENT_ID,
    provider,
    redirectUri,
    screenHint:
      provider === "authkit" && mode === "signup" ? "sign-up" : undefined,
    state: authState.state,
  })
  const response = redirectToRoute(request, authorizationUrl)

  setDesktopAuthStateCookie(response, request, authState.nonce)

  return response
}
