import { handleParameterizedScopedReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  return handleParameterizedScopedReadModelGet(params, {
    failureLogLabel: "Failed to load channel feed read model",
    failureMessage: "Failed to load channel feed read model",
    failureCode: "CHANNEL_FEED_READ_MODEL_LOAD_FAILED",
    notFoundMessage: "Channel not found",
    notFoundCode: "CHANNEL_FEED_READ_MODEL_NOT_FOUND",
    buildInstruction: ({ channelId }) => ({
      kind: "channel-feed",
      conversationId: channelId,
    }),
  })
}
