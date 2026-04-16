import {
  cancelCurrentAccountDeletionServer,
  deleteCurrentAccountServer,
  prepareCurrentAccountDeletionServer,
  validateCurrentAccountDeletionServer,
} from "@/lib/server/convex"
import { sendAccessChangeEmails } from "@/lib/server/email"
import {
  getConvexErrorMessage,
  getWorkOSErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { deleteWorkOSUser } from "@/lib/server/workos"

export async function DELETE() {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const appContext = await requireAppContext(session)

  if (isRouteResponse(appContext)) {
    return appContext
  }

  try {
    await validateCurrentAccountDeletionServer({
      currentUserId: appContext.ensuredUser.userId,
    })
  } catch (error) {
    logProviderError("Failed to validate account deletion", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete account"),
      500
    )
  }

  try {
    await prepareCurrentAccountDeletionServer({
      currentUserId: appContext.ensuredUser.userId,
    })
  } catch (error) {
    logProviderError("Failed to prepare account deletion", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete account"),
      500
    )
  }

  try {
    await deleteWorkOSUser({
      workosUserId: appContext.authenticatedUser.workosUserId,
    })
  } catch (error) {
    try {
      await cancelCurrentAccountDeletionServer({
        currentUserId: appContext.ensuredUser.userId,
      })
    } catch (rollbackError) {
      logProviderError(
        "Failed to roll back pending account deletion after WorkOS error",
        rollbackError
      )
    }

    logProviderError("Failed to delete WorkOS user", error)
    return jsonError(
      getWorkOSErrorMessage(error, "Failed to delete account"),
      500
    )
  }

  try {
    const result = await deleteCurrentAccountServer({
      currentUserId: appContext.ensuredUser.userId,
    })

    if (result?.emailJobs?.length) {
      try {
        await sendAccessChangeEmails({
          emails: result.emailJobs,
        })
      } catch (emailError) {
        logProviderError(
          "Failed to send account-deletion access change emails",
          emailError
        )
      }
    }
  } catch (error) {
    logProviderError("Failed to delete account", error)
    return jsonError(
      "Your sign-in has been removed, but we couldn't finish deleting your account. Please contact support.",
      500
    )
  }

  return jsonOk({
    ok: true,
    logoutRequired: true,
    notice: "Your account has been deleted.",
  })
}
