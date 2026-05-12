import { ConvexHttpClient } from "convex/browser"

export {
  getErrorDiagnostics,
  runConvexRequestWithRetry,
} from "@/lib/convex/retry"

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
let convexServerClient: ConvexHttpClient | null = null

export function getServerToken() {
  const serverToken = process.env.CONVEX_SERVER_TOKEN?.trim()

  if (!serverToken) {
    throw new Error("CONVEX_SERVER_TOKEN is not configured")
  }

  return serverToken
}

export function withServerToken<T extends Record<string, unknown>>(input: T) {
  return {
    ...input,
    serverToken: getServerToken(),
  }
}

export function getConvexServerClient() {
  if (!convexUrl) {
    throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")
  }

  if (!convexServerClient) {
    convexServerClient = new ConvexHttpClient(convexUrl)
  }

  return convexServerClient
}
