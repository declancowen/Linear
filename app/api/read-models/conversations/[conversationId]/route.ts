import { handleParameterizedSnapshotReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectConversationThreadReadModel } from "@/lib/scoped-sync/read-models"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  return handleParameterizedSnapshotReadModelGet(params, {
    failureLogLabel: "Failed to load conversation thread read model",
    failureMessage: "Failed to load conversation thread read model",
    failureCode: "CONVERSATION_THREAD_READ_MODEL_LOAD_FAILED",
    notFoundMessage: "Conversation not found",
    notFoundCode: "CONVERSATION_READ_MODEL_NOT_FOUND",
    select: (snapshot, { conversationId }) =>
      selectConversationThreadReadModel(snapshot, conversationId),
  })
}
