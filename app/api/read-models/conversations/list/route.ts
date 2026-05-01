import { handleSnapshotReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectConversationListReadModel } from "@/lib/scoped-sync/read-models"

export async function GET() {
  return handleSnapshotReadModelGet({
    failureLogLabel: "Failed to load conversation list read model",
    failureMessage: "Failed to load conversation list read model",
    failureCode: "CONVERSATION_LIST_READ_MODEL_LOAD_FAILED",
    select: (snapshot) =>
      selectConversationListReadModel(snapshot, snapshot.currentUserId),
  })
}
