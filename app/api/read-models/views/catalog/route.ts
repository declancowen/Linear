import { handleCollectionReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectViewCatalogReadModel } from "@/lib/scoped-sync/read-models"

const VIEW_CATALOG_SCOPE_TYPES = new Set(["team", "workspace"] as const)

export async function GET(request: Request) {
  return handleCollectionReadModelGet(request, {
    allowedScopeTypes: VIEW_CATALOG_SCOPE_TYPES,
    invalidScopeMessage: "Invalid view catalog read model scope",
    invalidScopeCode: "VIEW_CATALOG_SCOPE_INVALID",
    failureLogLabel: "Failed to load view catalog read model",
    failureMessage: "Failed to load view catalog read model",
    failureCode: "VIEW_CATALOG_READ_MODEL_LOAD_FAILED",
    select: selectViewCatalogReadModel,
  })
}
