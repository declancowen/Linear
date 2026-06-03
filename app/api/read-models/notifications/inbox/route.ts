import { handleScopedReadModelGet } from "@/lib/server/scoped-read-model-route-handlers"

export async function GET() {
  return handleScopedReadModelGet({
    instruction: { kind: "notification-inbox" },
    failureLogLabel: "Failed to load notification inbox read model",
    failureMessage: "Failed to load notification inbox read model",
    failureCode: "NOTIFICATION_INBOX_READ_MODEL_LOAD_FAILED",
  })
}
