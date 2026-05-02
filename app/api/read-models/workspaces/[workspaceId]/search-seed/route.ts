import type { AppSnapshot } from "@/lib/domain/types"
import { getSnapshotServer } from "@/lib/server/convex"
import { handleWorkspaceReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"
import { selectSearchSeedReadModel } from "@/lib/scoped-sync/read-models"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  return handleWorkspaceReadModelGet(params, {
    failureLogLabel: "Failed to load search seed read model",
    failureMessage: "Failed to load search seed read model",
    failureCode: "SEARCH_SEED_READ_MODEL_LOAD_FAILED",
    async load(session, workspaceId) {
      const snapshot = (await getSnapshotServer({
        workosUserId: session.user.id,
        email: session.user.email ?? undefined,
      })) as AppSnapshot

      return selectSearchSeedReadModel(snapshot, workspaceId)
    },
  })
}
