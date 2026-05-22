import {
  buildDesktopAuthCompleteUrl,
  clearDesktopAuthStateCookie,
  validateDesktopAuthCallbackState,
} from "@/lib/server/desktop-auth"
import { createDesktopHandoffTicket } from "@/lib/server/desktop-session"
import { redirectToRoute } from "@/lib/server/route-response"
import { authenticateWorkOSCallbackCode } from "@/lib/server/workos-auth-callback"

function getDesktopCallbackError(input: {
  code: string | null
  error: string | null
  errorDescription: string | null
}) {
  if (input.error) {
    return (
      input.errorDescription ??
      "We couldn't complete desktop authentication with that provider."
    )
  }

  return input.code ? null : "Missing authorization code from WorkOS."
}

function redirectToDesktopAuthComplete(
  request: Request,
  input: Parameters<typeof buildDesktopAuthCompleteUrl>[0]
) {
  const response = redirectToRoute(request, buildDesktopAuthCompleteUrl(input))

  clearDesktopAuthStateCookie(response, request)

  return response
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const state = validateDesktopAuthCallbackState(
    request,
    url.searchParams.get("state")
  )
  const code = url.searchParams.get("code")
  const error = getDesktopCallbackError({
    code,
    error: url.searchParams.get("error"),
    errorDescription: url.searchParams.get("error_description"),
  })

  if (!state) {
    return redirectToDesktopAuthComplete(request, {
      error: "Desktop sign-in request expired. Start sign-in again.",
    })
  }

  if (error) {
    return redirectToDesktopAuthComplete(request, {
      mode: state.mode,
      nextPath: state.nextPath,
      error,
    })
  }

  try {
    const authenticationResponse = await authenticateWorkOSCallbackCode(
      request,
      code ?? ""
    )
    const { ticket } = createDesktopHandoffTicket({
      organizationId: authenticationResponse.organizationId,
      user: authenticationResponse.user,
    })

    return redirectToDesktopAuthComplete(request, {
      nextPath: state.nextPath,
      ticket,
    })
  } catch {
    return redirectToDesktopAuthComplete(request, {
      mode: state.mode,
      nextPath: state.nextPath,
      error: "We couldn't complete desktop authentication with that provider.",
    })
  }
}
