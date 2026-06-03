import { handleScopedReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"

export async function GET() {
  return handleScopedReadModelGet({
    instruction: { kind: "conversation-list" },
    failureLogLabel: "Failed to load conversation list read model",
    failureMessage: "Failed to load conversation list read model",
    failureCode: "CONVERSATION_LIST_READ_MODEL_LOAD_FAILED",
  })
}
