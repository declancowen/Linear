import { ConvexHttpClient } from "convex/browser"

function readConvexUrl(env) {
  const convexUrl = env.CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL

  if (!convexUrl) {
    throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")
  }

  return convexUrl
}

function readConvexServerToken(env) {
  const serverToken = env.CONVEX_SERVER_TOKEN

  if (!serverToken) {
    throw new Error("CONVEX_SERVER_TOKEN is not configured")
  }

  return serverToken
}

function readPositiveNumberEnv(env, name, fallback) {
  const batchLimit = Number(env[name] ?? fallback)

  if (!Number.isFinite(batchLimit) || batchLimit <= 0) {
    throw new Error(`${name} must be a positive number`)
  }

  return batchLimit
}

export function readBackfillConfig(env = process.env) {
  const convexUrl = readConvexUrl(env)
  const serverToken = readConvexServerToken(env)
  const batchLimit = readPositiveNumberEnv(env, "BACKFILL_BATCH_LIMIT", "250")

  return {
    batchLimit,
    client: new ConvexHttpClient(convexUrl),
    serverToken,
  }
}

export async function runBackfillLoop(input) {
  const before = await input.getStatus()
  console.log(input.formatStatus(input.beforeLabel, before))

  let iterations = 0
  let totalPatched = 0

  while (true) {
    const result = await input.backfill()
    iterations += 1
    totalPatched += result.patched.total

    console.log(input.formatBatch(iterations, result))

    if (result.remaining.total === 0 || result.patched.total === 0) {
      break
    }
  }

  const after = await input.getStatus()
  console.log(input.formatStatus(input.afterLabel, after))
  console.log(`${input.totalLabel}: ${totalPatched}`)

  if (after.remaining.total > 0) {
    process.exitCode = 1
  }
}
