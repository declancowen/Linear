import { handleCollectionReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectDocumentIndexReadModel } from "@/lib/scoped-sync/read-models"

const DOCUMENT_INDEX_SCOPE_TYPES = new Set(["team", "workspace"] as const)

export async function GET(request: Request) {
  return handleCollectionReadModelGet(request, {
    allowedScopeTypes: DOCUMENT_INDEX_SCOPE_TYPES,
    invalidScopeMessage: "Invalid document read model scope",
    invalidScopeCode: "DOCUMENT_INDEX_SCOPE_INVALID",
    failureLogLabel: "Failed to load document index read model",
    failureMessage: "Failed to load document index read model",
    failureCode: "DOCUMENT_INDEX_READ_MODEL_LOAD_FAILED",
    select: selectDocumentIndexReadModel,
  })
}
