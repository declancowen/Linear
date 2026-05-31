import { handleParameterizedSnapshotReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectWorkspacePeopleReadModel } from "@/lib/scoped-sync/read-models"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  return handleParameterizedSnapshotReadModelGet(params, {
    failureLogLabel: "Failed to load workspace people read model",
    failureMessage: "Failed to load workspace people read model",
    failureCode: "WORKSPACE_PEOPLE_READ_MODEL_LOAD_FAILED",
    notFoundMessage: "Workspace people read model not found",
    notFoundCode: "WORKSPACE_PEOPLE_READ_MODEL_NOT_FOUND",
    select(snapshot, { workspaceId }) {
      return selectWorkspacePeopleReadModel(snapshot, workspaceId)
    },
  })
}
