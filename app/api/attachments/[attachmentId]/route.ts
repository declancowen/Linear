import { ApplicationError } from "@/lib/server/application-errors"
import { deleteAttachmentServer } from "@/lib/server/convex"
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

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      attachmentId: string
    }>
  }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { attachmentId } = await context.params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await deleteAttachmentServer({
      currentUserId: appContext.ensuredUser.userId,
      attachmentId,
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete attachment", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to delete attachment"),
      500,
      {
        code: "ATTACHMENT_DELETE_FAILED",
      }
    )
  }
}
