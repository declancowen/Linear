import type { AppSnapshot } from "@/lib/domain/types"
import { getSnapshotServer } from "@/lib/server/convex"
import { getConvexErrorMessage, logProviderError } from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { selectDocumentDetailReadModel } from "@/lib/scoped-sync/read-models"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { documentId } = await params
    const snapshot = (await getSnapshotServer({
      workosUserId: session.user.id,
      email: session.user.email ?? undefined,
    })) as AppSnapshot
    const data = selectDocumentDetailReadModel(snapshot, documentId)

    if (!data) {
      return jsonError("Document not found", 404, {
        code: "DOCUMENT_READ_MODEL_NOT_FOUND",
      })
    }

    return jsonOk({
      data,
    })
  } catch (error) {
    logProviderError("Failed to load document detail read model", error)

    return jsonError(
      getConvexErrorMessage(error, "Failed to load document detail read model"),
      500,
      {
        code: "DOCUMENT_READ_MODEL_LOAD_FAILED",
      }
    )
  }
}
