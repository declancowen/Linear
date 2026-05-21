import { parseAuthState } from "@/lib/auth-routing"
import { buildDesktopAuthCompleteUrl } from "@/lib/server/desktop-auth"
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

export async function GET(request: Request) {
  const url = new URL(request.url)
  const state = parseAuthState(url.searchParams.get("state") ?? undefined)
  const code = url.searchParams.get("code")
  const error = getDesktopCallbackError({
    code,
    error: url.searchParams.get("error"),
    errorDescription: url.searchParams.get("error_description"),
  })

  if (error) {
    return redirectToRoute(
      request,
      buildDesktopAuthCompleteUrl({
        nextPath: state?.nextPath,
        error,
      })
    )
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

    return redirectToRoute(
      request,
      buildDesktopAuthCompleteUrl({
        nextPath: state?.nextPath,
        ticket,
      })
    )
  } catch {
    return redirectToRoute(
      request,
      buildDesktopAuthCompleteUrl({
        nextPath: state?.nextPath,
        error: "We couldn't complete desktop authentication with that provider.",
      })
    )
  }
}
