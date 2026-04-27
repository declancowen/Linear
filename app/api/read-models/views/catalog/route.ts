import type { AppSnapshot } from "@/lib/domain/types"
import { getSnapshotServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { selectViewCatalogReadModel } from "@/lib/scoped-sync/read-models"

function parseScope(searchParams: URLSearchParams) {
  const scopeType = searchParams.get("scopeType")
  const scopeId = searchParams.get("scopeId")

  if ((scopeType !== "team" && scopeType !== "workspace") || !scopeId?.trim()) {
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
    return jsonError("Invalid view catalog read model scope", 400, {
      code: "VIEW_CATALOG_SCOPE_INVALID",
    })
  }

  try {
    const snapshot = (await getSnapshotServer({
      workosUserId: session.user.id,
      email: session.user.email ?? undefined,
    })) as AppSnapshot

    return jsonOk({
      data: selectViewCatalogReadModel(
        snapshot,
        scope.scopeType,
        scope.scopeId
      ),
    })
  } catch (error) {
    logProviderError("Failed to load view catalog read model", error)

    return jsonError(
      getConvexErrorMessage(error, "Failed to load view catalog read model"),
      500,
      {
        code: "VIEW_CATALOG_READ_MODEL_LOAD_FAILED",
      }
    )
  }
}
