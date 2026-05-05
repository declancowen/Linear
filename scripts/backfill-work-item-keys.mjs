import { api } from "../convex/_generated/api.js"
import {
  readBackfillConfig,
  runBackfillLoop,
} from "./shared/backfill.mjs"

const { batchLimit, client, serverToken } = readBackfillConfig()

function formatStatus(label, status) {
  return [
    `${label}:`,
    `  work items remaining: ${status.workItems.remaining}/${status.workItems.total}`,
    `  total remaining: ${status.remaining.total}`,
  ].join("\n")
}

async function getStatus() {
  return client.query(api.app.getWorkItemKeyBackfillStatus, {
    serverToken,
  })
}

async function backfill() {
  return client.mutation(api.app.backfillWorkItemKeys, {
    serverToken,
    limit: batchLimit,
  })
}

await runBackfillLoop({
  afterLabel: "Work item key backfill status after",
  backfill,
  beforeLabel: "Work item key backfill status before",
  formatBatch: (iterations, result) =>
    [
      `Batch ${iterations}:`,
      `  patched work items: ${result.patched.workItems}`,
      `  patched total: ${result.patched.total}`,
      `  remaining total: ${result.remaining.total}`,
    ].join("\n"),
  formatStatus,
  getStatus,
  totalLabel: "Total work item keys patched",
})
