import { NextRequest } from "next/server"
import { z } from "zod"

import {
  coerceWorkOSAccountApplicationError,
  mapWorkOSAccountError,
  updateWorkOSUserEmail,
} from "@/lib/server/workos"
import {
  getWorkOSErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const emailChangeSchema = z.object({
  email: z.string().trim().email(),
})

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    emailChangeSchema,
    "Invalid email"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  if (parsed.email.toLowerCase() === session.user.email.toLowerCase()) {
    return jsonError("Enter a different email address", 400)
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await updateWorkOSUserEmail({
      workosUserId: appContext.authenticatedUser.workosUserId,
      email: parsed.email,
    })

    return jsonOk({
      ok: true,
      logoutRequired: true,
      notice:
        "Email updated. Verify the new address from WorkOS and then sign back in.",
    })
  } catch (error) {
    logProviderError("Failed to update account email", error)

    const applicationError = coerceWorkOSAccountApplicationError(
      error,
      "Failed to update your email address."
    )

    if (applicationError) {
      return jsonApplicationError(applicationError)
    }

    return jsonError(
      mapWorkOSAccountError(
        error,
        getWorkOSErrorMessage(error, "Failed to update your email address.")
      ),
      500
    )
  }
}
