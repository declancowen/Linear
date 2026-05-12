import { api } from "../convex/_generated/api.js"
import {
  readBackfillConfig,
  runBackfillLoop,
} from "./shared/backfill.mjs"

const { batchLimit, client, serverToken } = readBackfillConfig()

function formatStatus(label, status) {
  return [
    `${label}:`,
    `  expected memberships: ${status.memberships.expected}`,
    `  existing memberships: ${status.memberships.existing}`,
    `  missing memberships: ${status.memberships.missing}`,
    `  stale roles: ${status.memberships.staleRole}`,
    `  remaining total: ${status.remaining.total}`,
  ].join("\n")
}

async function getStatus() {
  return client.query(api.app.getWorkspaceMembershipBackfillStatus, {
    serverToken,
  })
}

async function backfill() {
  return client.mutation(api.app.backfillWorkspaceMemberships, {
    serverToken,
    limit: batchLimit,
  })
}

await runBackfillLoop({
  afterLabel: "Workspace membership backfill status after",
  backfill,
  beforeLabel: "Workspace membership backfill status before",
  formatBatch: (iterations, result) =>
    [
      `Batch ${iterations}:`,
      `  inserted memberships: ${result.patched.inserted}`,
      `  updated memberships: ${result.patched.updated}`,
      `  patched total: ${result.patched.total}`,
      `  remaining total: ${result.remaining.total}`,
    ].join("\n"),
  formatStatus,
  getStatus,
  totalLabel: "Total memberships patched",
})
