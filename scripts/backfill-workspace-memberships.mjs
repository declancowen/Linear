import { ConvexHttpClient } from "convex/browser"

import { api } from "../convex/_generated/api.js"

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
const serverToken = process.env.CONVEX_SERVER_TOKEN
const batchLimit = Number(process.env.BACKFILL_BATCH_LIMIT ?? "250")

if (!convexUrl) {
  throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")
}

if (!serverToken) {
  throw new Error("CONVEX_SERVER_TOKEN is not configured")
}

if (!Number.isFinite(batchLimit) || batchLimit <= 0) {
  throw new Error("BACKFILL_BATCH_LIMIT must be a positive number")
}

const client = new ConvexHttpClient(convexUrl)

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

const before = await getStatus()
console.log(formatStatus("Workspace membership backfill status before", before))

let iterations = 0
let totalPatched = 0

while (true) {
  const result = await backfill()
  iterations += 1
  totalPatched += result.patched.total

  console.log(
    [
      `Batch ${iterations}:`,
      `  inserted memberships: ${result.patched.inserted}`,
      `  updated memberships: ${result.patched.updated}`,
      `  patched total: ${result.patched.total}`,
      `  remaining total: ${result.remaining.total}`,
    ].join("\n")
  )

  if (result.remaining.total === 0 || result.patched.total === 0) {
    break
  }
}

const after = await getStatus()
console.log(formatStatus("Workspace membership backfill status after", after))
console.log(`Total memberships patched: ${totalPatched}`)

if (after.remaining.total > 0) {
  process.exitCode = 1
}
