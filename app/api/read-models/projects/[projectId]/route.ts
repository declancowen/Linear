import { handleParameterizedSnapshotReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectProjectDetailReadModel } from "@/lib/scoped-sync/read-models"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  return handleParameterizedSnapshotReadModelGet(params, {
    failureLogLabel: "Failed to load project detail read model",
    failureMessage: "Failed to load project detail read model",
    failureCode: "PROJECT_READ_MODEL_LOAD_FAILED",
    notFoundMessage: "Project not found",
    notFoundCode: "PROJECT_READ_MODEL_NOT_FOUND",
    select: (snapshot, { projectId }) =>
      selectProjectDetailReadModel(snapshot, projectId),
  })
}
