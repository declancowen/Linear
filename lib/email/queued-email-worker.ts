import { randomUUID } from "node:crypto"

import { Resend } from "resend"

type ClaimedQueuedEmailJob = {
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

function getEarlierRetryDelay(
  currentDelayMs: number | null,
  retryDelayMs: number | null
) {
  if (typeof retryDelayMs !== "number") {
    return currentDelayMs
  }

  return currentDelayMs === null
    ? retryDelayMs
    : Math.min(currentDelayMs, retryDelayMs)
}

async function sendQueuedEmailJob(input: {
  job: ClaimedQueuedEmailJob
  resend: Resend
  resendFrom: string
}) {
  return input.resend.emails.send(
    {
      from: input.resendFrom,
      to: input.job.toEmail,
      subject: input.job.subject,
      text: input.job.text,
      html: input.job.html,
    },
    {
      idempotencyKey: input.job.id,
    }
  )
}

async function releaseFailedQueuedEmailJob(input: {
  claimId: string
  context: "send" | "mark_sent"
  errorMessage: string
  job: ClaimedQueuedEmailJob
  releaseEmailJobClaim: ReleaseEmailJobClaim
}) {
  return releaseEmailJobClaimSafely({
    claimId: input.claimId,
    jobId: input.job.id,
    errorMessage: input.errorMessage,
    context: input.context,
    releaseEmailJobClaim: input.releaseEmailJobClaim,
  })
}

async function processQueuedEmailJob(input: {
  claimId: string
  job: ClaimedQueuedEmailJob
  markEmailJobsSent: MarkEmailJobsSent
  releaseEmailJobClaim: ReleaseEmailJobClaim
  resend: Resend
  resendFrom: string
}) {
  try {
    const sendResult = await sendQueuedEmailJob(input)

    if (sendResult.error) {
      return {
        sent: false,
        nextRetryDelayMs: await releaseFailedQueuedEmailJob({
          ...input,
          context: "send",
          errorMessage: sendResult.error.message,
        }),
      }
    }
  } catch (error) {
    return {
      sent: false,
      nextRetryDelayMs: await releaseFailedQueuedEmailJob({
        ...input,
        context: "send",
        errorMessage: toErrorMessage(error),
      }),
    }
  }

  try {
    await input.markEmailJobsSent({
      claimId: input.claimId,
      jobIds: [input.job.id],
    })
  } catch (error) {
    console.error("Failed to mark queued email job as sent", {
      claimId: input.claimId,
      jobId: input.job.id,
      error: toErrorMessage(error),
    })

    return {
      sent: false,
      nextRetryDelayMs: await releaseFailedQueuedEmailJob({
        ...input,
        context: "mark_sent",
        errorMessage: toErrorMessage(error),
      }),
    }
  }

  return {
    sent: true,
    nextRetryDelayMs: null,
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
    const result = await processQueuedEmailJob({
      claimId,
      job,
      markEmailJobsSent: input.markEmailJobsSent,
      releaseEmailJobClaim: input.releaseEmailJobClaim,
      resend,
      resendFrom,
    })

    nextRetryDelayMs = getEarlierRetryDelay(
      nextRetryDelayMs,
      result.nextRetryDelayMs
    )

    if (result.sent) {
      sentCount += 1
    } else {
      failedCount += 1
    }
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
