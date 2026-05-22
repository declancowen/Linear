import { normalizeAuthNextPath } from "@/lib/auth-routing"
import { buildDesktopAuthCompleteUrl } from "@/lib/server/desktop-auth"
import { createDesktopHandoffTicket } from "@/lib/server/desktop-session"
import {
  authenticateLoginPassword,
  getLoginFormContext,
  getPendingLoginEmailVerification,
  mapLoginError,
  type LoginFormContext,
} from "@/lib/server/password-login"
import { redirectToRoute } from "@/lib/server/route-response"

function redirectToDesktopLoginError(
  request: Request,
  context: Pick<LoginFormContext, "nextPath">,
  error: string
) {
  return redirectToRoute(
    request,
    buildDesktopAuthCompleteUrl({
      nextPath: context.nextPath,
      error,
    })
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  return redirectToRoute(
    request,
    buildDesktopAuthCompleteUrl({
      nextPath: normalizeAuthNextPath(url.searchParams.get("next")),
      error: "Enter your email and password.",
    })
  )
}

export async function POST(request: Request) {
  const context = await getLoginFormContext(request)

  if (!context.email || !context.password) {
    return redirectToDesktopLoginError(
      request,
      context,
      "Enter your email and password."
    )
  }

  try {
    const authenticationResponse = await authenticateLoginPassword(
      request,
      context
    )
    const { ticket } = createDesktopHandoffTicket({
      organizationId: authenticationResponse.organizationId,
      user: authenticationResponse.user,
    })

    return redirectToRoute(
      request,
      buildDesktopAuthCompleteUrl({
        nextPath: context.nextPath,
        ticket,
      })
    )
  } catch (error) {
    const pendingAuthentication = getPendingLoginEmailVerification(error)

    if (pendingAuthentication) {
      return redirectToDesktopLoginError(
        request,
        context,
        "Email verification is required before desktop sign-in. Verify your email on the web app, then sign in again."
      )
    }

    return redirectToDesktopLoginError(request, context, mapLoginError(error))
  }
}
