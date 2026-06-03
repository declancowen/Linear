import { handleParameterizedScopedReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  return handleParameterizedScopedReadModelGet(params, {
    failureLogLabel: "Failed to load document detail read model",
    failureMessage: "Failed to load document detail read model",
    failureCode: "DOCUMENT_READ_MODEL_LOAD_FAILED",
    notFoundMessage: "Document not found",
    notFoundCode: "DOCUMENT_READ_MODEL_NOT_FOUND",
    buildInstruction: ({ documentId }) => ({
      kind: "document-detail",
      documentId,
    }),
  })
}
