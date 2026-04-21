import { randomUUID, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

import { api } from "@/convex/_generated/api"
import {
  getConvexServerClient,
  withServerToken,
} from "@/lib/server/convex/core"

export const runtime = "nodejs"

function normalizeResendFrom(fromEmail: string, fromName?: string) {
  const trimmedFromEmail = fromEmail.trim()

  if (trimmedFromEmail.includes("<") && trimmedFromEmail.includes(">")) {
    return trimmedFromEmail
  }

  const trimmedFromName =
    typeof fromName === "string" ? fromName.trim().replaceAll('"', '\\"') : ""

  if (!trimmedFromName) {
    return trimmedFromEmail
  }

  return `${trimmedFromName} <${trimmedFromEmail}>`
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function getRequiredEnv(name: "CRON_SECRET" | "RESEND_API_KEY" | "RESEND_FROM_EMAIL") {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

function isConfigurationErrorMessage(message: string) {
  return message.endsWith("is not configured")
}

async function releaseEmailJobClaimSafely(input: {
  client: ReturnType<typeof getConvexServerClient>
  claimId: string
  jobId: string
  errorMessage: string
  context: "send" | "mark_sent"
}) {
  try {
    await input.client.mutation(
      api.app.releaseEmailJobClaim,
      withServerToken({
        claimId: input.claimId,
        jobIds: [input.jobId],
        errorMessage: input.errorMessage,
      })
    )
  } catch (error) {
    console.error("Failed to release queued email job claim", {
      claimId: input.claimId,
      jobId: input.jobId,
      context: input.context,
      error: toErrorMessage(error),
    })
  }
}

async function processEmailJobsBatch() {
  const client = getConvexServerClient()
  const claimId = randomUUID()
  const resend = new Resend(getRequiredEnv("RESEND_API_KEY"))
  const resendFrom = normalizeResendFrom(
    getRequiredEnv("RESEND_FROM_EMAIL"),
    process.env.RESEND_FROM_NAME
  )
  const jobs =
    (await client.mutation(
      api.app.claimPendingEmailJobs,
      withServerToken({ claimId })
    )) ?? []

  let sentCount = 0
  let failedCount = 0

  for (const job of jobs) {
    let sendResult

    try {
      sendResult = await resend.emails.send(
        {
          from: resendFrom,
          to: job.toEmail,
          subject: job.subject,
          text: job.text,
          html: job.html,
        },
        {
          idempotencyKey: job.id,
        }
      )
    } catch (error) {
      await releaseEmailJobClaimSafely({
        client,
        claimId,
        jobId: job.id,
        errorMessage: toErrorMessage(error),
        context: "send",
      })
      failedCount += 1
      continue
    }

    if (sendResult.error) {
      await releaseEmailJobClaimSafely({
        client,
        claimId,
        jobId: job.id,
        errorMessage: sendResult.error.message,
        context: "send",
      })
      failedCount += 1
      continue
    }

    try {
      await client.mutation(
        api.app.markEmailJobsSent,
        withServerToken({
          claimId,
          jobIds: [job.id],
        })
      )
    } catch (error) {
      console.error("Failed to mark queued email job as sent", {
        claimId,
        jobId: job.id,
        error: toErrorMessage(error),
      })
      await releaseEmailJobClaimSafely({
        client,
        claimId,
        jobId: job.id,
        errorMessage: toErrorMessage(error),
        context: "mark_sent",
      })
      failedCount += 1
      continue
    }

    sentCount += 1

    if (!job.notificationId) {
      continue
    }

    try {
      await client.mutation(
        api.app.markNotificationsEmailed,
        withServerToken({
          notificationIds: [job.notificationId],
        })
      )
    } catch (error) {
      console.error("Failed to mark notification emailed after queued email delivery", {
        notificationId: job.notificationId,
        jobId: job.id,
        error: toErrorMessage(error),
      })
    }
  }

  return {
    processedCount: jobs.length,
    sentCount,
    failedCount,
  }
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
