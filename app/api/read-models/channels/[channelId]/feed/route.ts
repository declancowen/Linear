import { handleParameterizedSnapshotReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectChannelFeedReadModel } from "@/lib/scoped-sync/read-models"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  return handleParameterizedSnapshotReadModelGet(params, {
    failureLogLabel: "Failed to load channel feed read model",
    failureMessage: "Failed to load channel feed read model",
    failureCode: "CHANNEL_FEED_READ_MODEL_LOAD_FAILED",
    notFoundMessage: "Channel not found",
    notFoundCode: "CHANNEL_FEED_READ_MODEL_NOT_FOUND",
    select: (snapshot, { channelId }) =>
      selectChannelFeedReadModel(snapshot, channelId),
  })
}
