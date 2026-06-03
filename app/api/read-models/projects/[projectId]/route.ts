import { handleParameterizedScopedReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  return handleParameterizedScopedReadModelGet(params, {
    failureLogLabel: "Failed to load project detail read model",
    failureMessage: "Failed to load project detail read model",
    failureCode: "PROJECT_READ_MODEL_LOAD_FAILED",
    notFoundMessage: "Project not found",
    notFoundCode: "PROJECT_READ_MODEL_NOT_FOUND",
    buildInstruction: ({ projectId }) => ({
      kind: "project-detail",
      projectId,
    }),
  })
}
