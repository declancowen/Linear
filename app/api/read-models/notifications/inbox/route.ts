import type { AppSnapshot } from "@/lib/domain/types"
import { getSnapshotServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { selectNotificationInboxReadModel } from "@/lib/scoped-sync/read-models"

export async function GET() {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const snapshot = (await getSnapshotServer({
      workosUserId: session.user.id,
      email: session.user.email ?? undefined,
    })) as AppSnapshot

    return jsonOk({
      data: selectNotificationInboxReadModel(snapshot, snapshot.currentUserId),
    })
  } catch (error) {
    logProviderError("Failed to load notification inbox read model", error)

    return jsonError(
      getConvexErrorMessage(
        error,
        "Failed to load notification inbox read model"
      ),
      500,
      {
        code: "NOTIFICATION_INBOX_READ_MODEL_LOAD_FAILED",
      }
    )
  }
}
