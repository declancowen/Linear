import { handleParameterizedSnapshotReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectDocumentDetailReadModel } from "@/lib/scoped-sync/read-models"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  return handleParameterizedSnapshotReadModelGet(params, {
    failureLogLabel: "Failed to load document detail read model",
    failureMessage: "Failed to load document detail read model",
    failureCode: "DOCUMENT_READ_MODEL_LOAD_FAILED",
    notFoundMessage: "Document not found",
    notFoundCode: "DOCUMENT_READ_MODEL_NOT_FOUND",
    select: (snapshot, { documentId }) =>
      selectDocumentDetailReadModel(snapshot, documentId),
  })
}
