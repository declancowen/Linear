import { handleCollectionReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectProjectIndexReadModel } from "@/lib/scoped-sync/read-models"

const PROJECT_INDEX_SCOPE_TYPES = new Set(["team", "workspace"] as const)

export async function GET(request: Request) {
  return handleCollectionReadModelGet(request, {
    allowedScopeTypes: PROJECT_INDEX_SCOPE_TYPES,
    invalidScopeMessage: "Invalid project read model scope",
    invalidScopeCode: "PROJECT_INDEX_SCOPE_INVALID",
    failureLogLabel: "Failed to load project index read model",
    failureMessage: "Failed to load project index read model",
    failureCode: "PROJECT_INDEX_READ_MODEL_LOAD_FAILED",
    select: selectProjectIndexReadModel,
  })
}
