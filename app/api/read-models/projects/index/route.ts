import type { AppSnapshot } from "@/lib/domain/types"
import { getSnapshotServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { selectProjectIndexReadModel } from "@/lib/scoped-sync/read-models"

function parseScope(searchParams: URLSearchParams) {
  const scopeType = searchParams.get("scopeType")
  const scopeId = searchParams.get("scopeId")

  if (
    (scopeType !== "team" && scopeType !== "workspace") ||
    !scopeId?.trim()
  ) {
    return null
  }

  return {
    scopeType,
    scopeId: scopeId.trim(),
  } as const
}

export async function GET(request: Request) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const scope = parseScope(new URL(request.url).searchParams)

  if (!scope) {
    return jsonError("Invalid project read model scope", 400, {
      code: "PROJECT_INDEX_SCOPE_INVALID",
    })
  }

  try {
    const snapshot = (await getSnapshotServer({
      workosUserId: session.user.id,
      email: session.user.email ?? undefined,
    })) as AppSnapshot
    const data = selectProjectIndexReadModel(
      snapshot,
      scope.scopeType,
      scope.scopeId
    )

    return jsonOk({
      data,
    })
  } catch (error) {
    logProviderError("Failed to load project index read model", error)

    return jsonError(
      getConvexErrorMessage(error, "Failed to load project index read model"),
      500,
      {
        code: "PROJECT_INDEX_READ_MODEL_LOAD_FAILED",
      }
    )
  }
}
