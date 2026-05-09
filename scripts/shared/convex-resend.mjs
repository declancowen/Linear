import { ConvexHttpClient } from "convex/browser"
import { Resend } from "resend"

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function readConvexResendConfig(env = process.env) {
  const convexUrl = env.CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL
  const serverToken = env.CONVEX_SERVER_TOKEN
  const resendApiKey = env.RESEND_API_KEY
  const resendFromEmail = env.RESEND_FROM_EMAIL
  const resendFromName = env.RESEND_FROM_NAME

  if (!convexUrl) {
    throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")
  }

  if (!serverToken) {
    throw new Error("CONVEX_SERVER_TOKEN is not configured")
  }

  if (!resendApiKey || !resendFromEmail) {
    throw new Error("Resend is not configured")
  }

  return {
    client: new ConvexHttpClient(convexUrl),
    resend: new Resend(resendApiKey),
    resendFromEmail,
    resendFromName,
    serverToken,
  }
}
