import type { AppSnapshot } from "@/lib/domain/types"
import { getSnapshotServer } from "@/lib/server/convex"
import { getConvexErrorMessage, logProviderError } from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { selectProjectDetailReadModel } from "@/lib/scoped-sync/read-models"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { projectId } = await params
    const snapshot = (await getSnapshotServer({
      workosUserId: session.user.id,
      email: session.user.email ?? undefined,
    })) as AppSnapshot
    const data = selectProjectDetailReadModel(snapshot, projectId)

    if (!data) {
      return jsonError("Project not found", 404, {
        code: "PROJECT_READ_MODEL_NOT_FOUND",
      })
    }

    return jsonOk({
      data,
    })
  } catch (error) {
    logProviderError("Failed to load project detail read model", error)

    return jsonError(
      getConvexErrorMessage(error, "Failed to load project detail read model"),
      500,
      {
        code: "PROJECT_READ_MODEL_LOAD_FAILED",
      }
    )
  }
}
