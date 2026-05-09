import { ConvexHttpClient } from "convex/browser"
import { createWorkOS } from "@workos-inc/node"

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function readWorkosConvexConfig(env = process.env) {
  const convexUrl = env.CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL
  const serverToken = env.CONVEX_SERVER_TOKEN
  const apiKey = env.WORKOS_API_KEY
  const clientId = env.WORKOS_CLIENT_ID

  if (!convexUrl) {
    throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")
  }

  if (!serverToken) {
    throw new Error("CONVEX_SERVER_TOKEN is not configured")
  }

  if (!apiKey || !clientId) {
    throw new Error("WorkOS is not configured")
  }

  return {
    convex: new ConvexHttpClient(convexUrl),
    serverToken,
    workos: createWorkOS({
      apiKey,
      clientId,
    }),
  }
}
