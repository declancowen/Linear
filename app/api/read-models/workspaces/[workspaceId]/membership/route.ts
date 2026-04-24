import { getWorkspaceMembershipBootstrapServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { workspaceId } = await params
    const data = await getWorkspaceMembershipBootstrapServer({
      workosUserId: session.user.id,
      email: session.user.email ?? undefined,
      workspaceId,
    })

    return jsonOk({
      data,
    })
  } catch (error) {
    logProviderError("Failed to load workspace membership read model", error)

    return jsonError(
      getConvexErrorMessage(
        error,
        "Failed to load workspace membership read model"
      ),
      500,
      {
        code: "WORKSPACE_MEMBERSHIP_READ_MODEL_LOAD_FAILED",
      }
    )
  }
}
