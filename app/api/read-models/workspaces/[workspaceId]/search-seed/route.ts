import {
  handleWorkspaceReadModelGet,
  loadScopedReadModelForSession,
} from "@/lib/server/scoped-read-model-route-handlers"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  return handleWorkspaceReadModelGet(params, {
    failureLogLabel: "Failed to load search seed read model",
    failureMessage: "Failed to load search seed read model",
    failureCode: "SEARCH_SEED_READ_MODEL_LOAD_FAILED",
    load(session, workspaceId) {
      return loadScopedReadModelForSession(session, {
        kind: "search-seed",
        workspaceId,
      })
    },
  })
}
