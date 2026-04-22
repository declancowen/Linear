import type { AppSnapshot } from "@/lib/domain/types"
import { getSnapshotServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { selectChannelFeedReadModel } from "@/lib/scoped-sync/read-models"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { channelId } = await params
    const snapshot = (await getSnapshotServer({
      workosUserId: session.user.id,
      email: session.user.email ?? undefined,
    })) as AppSnapshot
    const data = selectChannelFeedReadModel(snapshot, channelId)

    if (!data) {
      return jsonError("Channel not found", 404, {
        code: "CHANNEL_FEED_READ_MODEL_NOT_FOUND",
      })
    }

    return jsonOk({ data })
  } catch (error) {
    logProviderError("Failed to load channel feed read model", error)

    return jsonError(
      getConvexErrorMessage(error, "Failed to load channel feed read model"),
      500,
      {
        code: "CHANNEL_FEED_READ_MODEL_LOAD_FAILED",
      }
    )
  }
}
