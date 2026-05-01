import { handleSnapshotReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectNotificationInboxReadModel } from "@/lib/scoped-sync/read-models"

export async function GET() {
  return handleSnapshotReadModelGet({
    failureLogLabel: "Failed to load notification inbox read model",
    failureMessage: "Failed to load notification inbox read model",
    failureCode: "NOTIFICATION_INBOX_READ_MODEL_LOAD_FAILED",
    select: (snapshot) =>
      selectNotificationInboxReadModel(snapshot, snapshot.currentUserId),
  })
}
