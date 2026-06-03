import { handleParameterizedScopedReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  return handleParameterizedScopedReadModelGet(params, {
    failureLogLabel: "Failed to load work item detail read model",
    failureMessage: "Failed to load work item detail read model",
    failureCode: "WORK_ITEM_READ_MODEL_LOAD_FAILED",
    notFoundMessage: "Work item not found",
    notFoundCode: "WORK_ITEM_READ_MODEL_NOT_FOUND",
    buildInstruction: ({ itemId }) => ({
      kind: "work-item-detail",
      itemId,
    }),
  })
}
