import { getWorkspaceMembershipBootstrapServer } from "@/lib/server/convex"
import { handleWorkspaceReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  return handleWorkspaceReadModelGet(params, {
    failureLogLabel: "Failed to load workspace membership read model",
    failureMessage: "Failed to load workspace membership read model",
    failureCode: "WORKSPACE_MEMBERSHIP_READ_MODEL_LOAD_FAILED",
    load(session, workspaceId) {
      return getWorkspaceMembershipBootstrapServer({
        workosUserId: session.user.id,
        email: session.user.email ?? undefined,
        workspaceId,
      })
    },
  })
}
