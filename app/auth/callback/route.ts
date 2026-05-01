import { saveSession } from "@workos-inc/authkit-nextjs"

import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { getRequestMetadata } from "@/lib/server/auth-request"
import { redirectToRoute } from "@/lib/server/route-response"
import { getWorkOSClient } from "@/lib/server/workos"
import {
  buildAuthPageHref,
  buildPostAuthPath,
  parseAuthState,
} from "@/lib/auth-routing"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = parseAuthState(url.searchParams.get("state") ?? undefined)
  const error = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_description")

  if (error) {
    return redirectToRoute(
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
    return redirectToRoute(
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

    return redirectToRoute(
      request,
      buildPostAuthPath(state?.nextPath)
    )
  } catch {
    return redirectToRoute(
      request,
      buildAuthPageHref(state?.mode ?? "login", {
        nextPath: state?.nextPath,
        error: "We couldn't complete authentication with that provider.",
      })
    )
  }
}
