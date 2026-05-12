import { handleParameterizedSnapshotReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectWorkItemDetailReadModel } from "@/lib/scoped-sync/read-models"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  return handleParameterizedSnapshotReadModelGet(params, {
    failureLogLabel: "Failed to load work item detail read model",
    failureMessage: "Failed to load work item detail read model",
    failureCode: "WORK_ITEM_READ_MODEL_LOAD_FAILED",
    notFoundMessage: "Work item not found",
    notFoundCode: "WORK_ITEM_READ_MODEL_NOT_FOUND",
    select: (snapshot, { itemId }) =>
      selectWorkItemDetailReadModel(snapshot, itemId),
  })
}
