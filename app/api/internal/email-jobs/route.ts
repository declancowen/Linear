import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { api } from "@/convex/_generated/api"
import {
  getRequiredEnv,
  isConfigurationErrorMessage,
  processQueuedEmailJobsBatch,
  toErrorMessage,
} from "@/lib/email/queued-email-worker"
import {
  getConvexServerClient,
  withServerToken,
} from "@/lib/server/convex/core"

export const runtime = "nodejs"

async function processEmailJobsBatch() {
  const client = getConvexServerClient()
  return processQueuedEmailJobsBatch({
    resendApiKey: getRequiredEnv("RESEND_API_KEY"),
    resendFromEmail: getRequiredEnv("RESEND_FROM_EMAIL"),
    resendFromName: process.env.RESEND_FROM_NAME,
    claimPendingEmailJobs: (payload) =>
      client.mutation(
        api.app.claimPendingEmailJobs,
        withServerToken(payload)
      ),
    markEmailJobsSent: (payload) =>
      client.mutation(
        api.app.markEmailJobsSent,
        withServerToken(payload)
      ),
    releaseEmailJobClaim: (payload) =>
      client.mutation(
        api.app.releaseEmailJobClaim,
        withServerToken(payload)
      ),
  })
}

function hasValidCronAuthorization(
  authorization: string | null,
  cronSecret: string
) {
  if (!authorization) {
    return false
  }

  const expectedAuthorization = `Bearer ${cronSecret}`
  const providedBuffer = Buffer.from(authorization)
  const expectedBuffer = Buffer.from(expectedAuthorization)

  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization")
    const cronSecret = getRequiredEnv("CRON_SECRET")

    if (!hasValidCronAuthorization(authorization, cronSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await processEmailJobsBatch()

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    const message = toErrorMessage(error)
    const configurationError = isConfigurationErrorMessage(message)
    const status = configurationError ? 503 : 500
    const responseMessage = configurationError
      ? "Service unavailable"
      : "Failed to process queued email jobs"

    console.error("Failed to process queued email jobs", {
      error: message,
    })

    return NextResponse.json(
      {
        error: responseMessage,
      },
      { status }
    )
  }
}
