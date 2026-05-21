import { redirectToRoute } from "@/lib/server/route-response"
import { authenticateWorkOSCallbackCode } from "@/lib/server/workos-auth-callback"
import {
  buildAuthPageHref,
  type AuthMode,
  buildPostAuthPath,
  parseAuthState,
} from "@/lib/auth-routing"

type ParsedAuthState = ReturnType<typeof parseAuthState>

function redirectToCallbackAuthPage(
  request: Request,
  input: {
    mode: AuthMode
    nextPath?: string
    error: string
  }
) {
  return redirectToRoute(
    request,
    buildAuthPageHref(input.mode, {
      nextPath: input.nextPath,
      error: input.error,
    })
  )
}

function getCallbackAuthFailure(input: {
  code: string | null
  error: string | null
  errorDescription: string | null
  state: ParsedAuthState
}) {
  if (input.error) {
    return buildCallbackAuthFailure(input.state, {
      error:
        input.errorDescription ??
        "We couldn't complete authentication with that provider.",
    })
  }

  if (!input.code) {
    return buildCallbackAuthFailure(input.state, {
      error: "Missing authorization code from WorkOS.",
    })
  }

  return null
}

function buildCallbackAuthFailure(
  state: ParsedAuthState,
  input: {
    error: string
  }
) {
  return {
    mode: state?.mode ?? "login",
    nextPath: state?.nextPath,
    error: input.error,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = parseAuthState(url.searchParams.get("state") ?? undefined)
  const error = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_description")
  const callbackFailure = getCallbackAuthFailure({
    code,
    error,
    errorDescription,
    state,
  })

  if (callbackFailure) {
    return redirectToCallbackAuthPage(request, callbackFailure)
  }

  try {
    await authenticateWorkOSCallbackCode(request, code ?? "")
    return redirectToRoute(request, buildPostAuthPath(state?.nextPath))
  } catch {
    return redirectToCallbackAuthPage(request, {
      mode: state?.mode ?? "login",
      nextPath: state?.nextPath,
      error: "We couldn't complete authentication with that provider.",
    })
  }
}
