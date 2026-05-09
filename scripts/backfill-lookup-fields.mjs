import { api } from "../convex/_generated/api.js"
import {
  readBackfillConfig,
  runBackfillLoop,
} from "./shared/backfill.mjs"

const { batchLimit, client, serverToken } = readBackfillConfig()

function formatStatus(label, status) {
  return [
    `${label}:`,
    `  teams remaining: ${status.teams.remaining}/${status.teams.total}`,
    `  users remaining: ${status.users.remaining}/${status.users.total}`,
    `  invites remaining: ${status.invites.remaining}/${status.invites.total}`,
    `  labels remaining: ${status.labels.remaining}/${status.labels.total}`,
    `  labels unresolved: ${status.labels.unresolved}`,
    `  total remaining: ${status.remaining.total}`,
  ].join("\n")
}

async function getStatus() {
  return client.query(api.app.getLegacyLookupBackfillStatus, {
    serverToken,
  })
}

async function backfill() {
  return client.mutation(api.app.backfillLegacyLookupFields, {
    serverToken,
    limit: batchLimit,
  })
}

await runBackfillLoop({
  afterLabel: "Lookup backfill status after",
  backfill,
  beforeLabel: "Lookup backfill status before",
  formatBatch: (iterations, result) =>
    [
      `Batch ${iterations}:`,
      `  patched teams: ${result.patched.teams}`,
      `  patched users: ${result.patched.users}`,
      `  patched invites: ${result.patched.invites}`,
      `  patched labels: ${result.patched.labels}`,
      `  patched total: ${result.patched.total}`,
      `  remaining total: ${result.remaining.total}`,
    ].join("\n"),
  formatStatus,
  getStatus,
  totalLabel: "Total records patched",
})
