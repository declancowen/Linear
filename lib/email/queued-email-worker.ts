import { randomUUID } from "node:crypto"

import { Resend } from "resend"

export type ClaimedQueuedEmailJob = {
  id: string
  notificationId?: string
  toEmail: string
  subject: string
  text: string
  html: string
}

type ClaimPendingEmailJobs = (payload: {
  claimId: string
  limit?: number
}) => Promise<ClaimedQueuedEmailJob[] | null | undefined>

type MarkEmailJobsSent = (payload: {
  claimId: string
  jobIds: string[]
}) => Promise<unknown>

type ReleaseEmailJobClaim = (payload: {
  claimId: string
  jobIds: string[]
  errorMessage?: string
}) => Promise<
  | Array<{
      jobId: string
      retryBackoffMs: number
    }>
  | null
  | undefined
  | unknown
>

type ProcessQueuedEmailJobsBatchInput = {
  resendApiKey: string
  resendFromEmail: string
  resendFromName?: string
  claimPendingEmailJobs: ClaimPendingEmailJobs
  markEmailJobsSent: MarkEmailJobsSent
  releaseEmailJobClaim: ReleaseEmailJobClaim
  claimId?: string
  limit?: number
}

export function normalizeResendFrom(fromEmail: string, fromName?: string) {
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

export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function getRequiredEnv(
  name: "CRON_SECRET" | "RESEND_API_KEY" | "RESEND_FROM_EMAIL"
) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

export function isConfigurationErrorMessage(message: string) {
  return message.endsWith("is not configured")
}

async function releaseEmailJobClaimSafely(input: {
  claimId: string
  jobId: string
  errorMessage: string
  context: "send" | "mark_sent"
  releaseEmailJobClaim: ReleaseEmailJobClaim
}) {
  try {
    const result = await input.releaseEmailJobClaim({
      claimId: input.claimId,
      jobIds: [input.jobId],
      errorMessage: input.errorMessage,
    })
    const releasedClaim = Array.isArray(result)
      ? result.find(
          (entry) =>
            typeof entry === "object" &&
            entry !== null &&
            "jobId" in entry &&
            entry.jobId === input.jobId &&
            "retryBackoffMs" in entry &&
            typeof entry.retryBackoffMs === "number"
        )
      : null

    return releasedClaim?.retryBackoffMs ?? null
  } catch (error) {
    console.error("Failed to release queued email job claim", {
      claimId: input.claimId,
      jobId: input.jobId,
      context: input.context,
      error: toErrorMessage(error),
    })
    return null
  }
}

export async function processQueuedEmailJobsBatch(
  input: ProcessQueuedEmailJobsBatchInput
) {
  const claimId = input.claimId ?? randomUUID()
  const resend = new Resend(input.resendApiKey)
  const resendFrom = normalizeResendFrom(
    input.resendFromEmail,
    input.resendFromName
  )
  const jobs =
    (await input.claimPendingEmailJobs({
      claimId,
      limit: input.limit,
    })) ?? []

  let sentCount = 0
  let failedCount = 0
  let nextRetryDelayMs: number | null = null

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
      const retryDelayMs = await releaseEmailJobClaimSafely({
        claimId,
        jobId: job.id,
        errorMessage: toErrorMessage(error),
        context: "send",
        releaseEmailJobClaim: input.releaseEmailJobClaim,
      })
      if (typeof retryDelayMs === "number") {
        nextRetryDelayMs =
          nextRetryDelayMs === null
            ? retryDelayMs
            : Math.min(nextRetryDelayMs, retryDelayMs)
      }
      failedCount += 1
      continue
    }

    if (sendResult.error) {
      const retryDelayMs = await releaseEmailJobClaimSafely({
        claimId,
        jobId: job.id,
        errorMessage: sendResult.error.message,
        context: "send",
        releaseEmailJobClaim: input.releaseEmailJobClaim,
      })
      if (typeof retryDelayMs === "number") {
        nextRetryDelayMs =
          nextRetryDelayMs === null
            ? retryDelayMs
            : Math.min(nextRetryDelayMs, retryDelayMs)
      }
      failedCount += 1
      continue
    }

    try {
      await input.markEmailJobsSent({
        claimId,
        jobIds: [job.id],
      })
    } catch (error) {
      console.error("Failed to mark queued email job as sent", {
        claimId,
        jobId: job.id,
        error: toErrorMessage(error),
      })
      const retryDelayMs = await releaseEmailJobClaimSafely({
        claimId,
        jobId: job.id,
        errorMessage: toErrorMessage(error),
        context: "mark_sent",
        releaseEmailJobClaim: input.releaseEmailJobClaim,
      })
      if (typeof retryDelayMs === "number") {
        nextRetryDelayMs =
          nextRetryDelayMs === null
            ? retryDelayMs
            : Math.min(nextRetryDelayMs, retryDelayMs)
      }
      failedCount += 1
      continue
    }

    sentCount += 1
  }

  return {
    claimId,
    processedCount: jobs.length,
    sentCount,
    failedCount,
    nextRetryDelayMs,
    claimedFullBatch:
      typeof input.limit === "number" && input.limit > 0
        ? jobs.length >= input.limit
        : false,
  }
}
