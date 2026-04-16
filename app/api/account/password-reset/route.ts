import {
  getWorkOSErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { requestWorkOSPasswordReset } from "@/lib/server/workos"

export async function POST() {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    await requestWorkOSPasswordReset(session.user.email)

    return jsonOk({ ok: true })
  } catch (error) {
    logProviderError("Failed to start password reset", error)
    return jsonError(
      getWorkOSErrorMessage(error, "Failed to start password reset"),
      500
    )
  }
}
