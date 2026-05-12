import { handleCollectionReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectWorkIndexReadModel } from "@/lib/scoped-sync/read-models"

const WORK_INDEX_SCOPE_TYPES = new Set([
  "personal",
  "team",
  "workspace",
] as const)

export async function GET(request: Request) {
  return handleCollectionReadModelGet(request, {
    allowedScopeTypes: WORK_INDEX_SCOPE_TYPES,
    invalidScopeMessage: "Invalid work index read model scope",
    invalidScopeCode: "WORK_INDEX_SCOPE_INVALID",
    failureLogLabel: "Failed to load work index read model",
    failureMessage: "Failed to load work index read model",
    failureCode: "WORK_INDEX_READ_MODEL_LOAD_FAILED",
    select: selectWorkIndexReadModel,
  })
}
