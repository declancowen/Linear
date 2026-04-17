import { ApplicationError } from "@/lib/server/application-errors"
import {
  cancelCurrentAccountDeletionServer,
  deleteCurrentAccountServer,
  enqueueEmailJobsServer,
  prepareCurrentAccountDeletionServer,
  validateCurrentAccountDeletionServer,
} from "@/lib/server/convex"
import { buildAccessChangeEmailJobs } from "@/lib/server/email"
import { reconcileDeletedAccountProviderCleanup } from "@/lib/server/lifecycle"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

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
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to validate account deletion", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete account"),
      500,
      {
        code: "ACCOUNT_DELETE_VALIDATION_FAILED",
      }
    )
  }

  try {
    await prepareCurrentAccountDeletionServer({
      currentUserId: appContext.ensuredUser.userId,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to prepare account deletion", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete account"),
      500,
      {
        code: "ACCOUNT_DELETE_PREPARE_FAILED",
      }
    )
  }

  let result:
    | Awaited<ReturnType<typeof deleteCurrentAccountServer>>
    | undefined
  try {
    result = await deleteCurrentAccountServer({
      currentUserId: appContext.ensuredUser.userId,
    })
  } catch (error) {
    try {
      await cancelCurrentAccountDeletionServer({
        currentUserId: appContext.ensuredUser.userId,
      })
    } catch (rollbackError) {
      logProviderError(
        "Failed to roll back pending account deletion after finalize error",
        rollbackError
      )
    }

    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete account", error)
    return jsonError(
      "We couldn't finish deleting your account. Please try again or contact support.",
      500,
      {
        code: "ACCOUNT_DELETE_FINALIZE_FAILED",
      }
    )
  }

  await reconcileDeletedAccountProviderCleanup({
    workosUserId: appContext.authenticatedUser.workosUserId,
    memberships: result?.providerMemberships ?? [],
  })

  if (result?.emailJobs?.length) {
    try {
      await enqueueEmailJobsServer(
        buildAccessChangeEmailJobs({
          emails: result.emailJobs,
        })
      )
    } catch (emailError) {
      logProviderError(
        "Failed to send account-deletion access change emails",
        emailError
      )
    }
  }

  return jsonOk({
    ok: true,
    logoutRequired: true,
    notice: "Your account has been deleted.",
  })
}
