import type { MutationCtx, QueryCtx } from "../_generated/server"
import type { QueuedEmailJob } from "../../lib/email/builders"

import { internal } from "../_generated/api"
import { assertServerToken, createId, getNow } from "./core"
import { isActiveDigestClaim } from "./claim_utils"

type ServerAccessArgs = {
  serverToken: string
}

type EmailJobInput = {
  kind: "mention" | "assignment" | "invite" | "access-change"
  notificationId?: string
  toEmail: string
  subject: string
  text: string
  html: string
}

type EnqueueEmailJobsArgs = ServerAccessArgs & {
  jobs: EmailJobInput[]
}

type ClaimPendingEmailJobsArgs = ServerAccessArgs & {
  claimId: string
  limit?: number
}

type ListPendingEmailJobsArgs = ServerAccessArgs & {
  limit?: number
}

type MarkEmailJobsSentArgs = ServerAccessArgs & {
  claimId: string
  jobIds: string[]
}

type ReleaseEmailJobClaimArgs = ServerAccessArgs & {
  claimId: string
  jobIds: string[]
  errorMessage?: string
}

export const EMAIL_JOB_CLAIM_TTL_MS = 15 * 60 * 1000
export const DEFAULT_EMAIL_JOB_CLAIM_LIMIT = 25
export const EMAIL_JOB_RETRY_BACKOFF_BASE_MS = 60 * 1000
const EMAIL_JOB_RETRY_BACKOFF_MAX_MS = 60 * 60 * 1000

type ClaimPendingEmailJobsInput = {
  claimId: string
  limit?: number
}

type MarkEmailJobsSentInput = {
  claimId: string
  jobIds: string[]
}

type ReleaseEmailJobClaimInput = {
  claimId: string
  jobIds: string[]
  errorMessage?: string
}

export type ClaimedEmailJob = {
  id: string
  kind: "mention" | "assignment" | "invite" | "access-change"
  notificationId?: string
  toEmail: string
  subject: string
  text: string
  html: string
}

export type ReleasedEmailJobClaim = {
  jobId: string
  retryBackoffMs: number
}

function isActiveClaim(
  job: {
    claimId?: string | null
    claimedAt?: string | null
  },
  nowMs: number
) {
  if (!job.claimId || !job.claimedAt) {
    return false
  }

  const claimedAtMs = Date.parse(job.claimedAt)

  if (Number.isNaN(claimedAtMs)) {
    return false
  }

  return nowMs - claimedAtMs < EMAIL_JOB_CLAIM_TTL_MS
}

function getRetryBackoffMs(attemptCount: number) {
  if (attemptCount <= 0) {
    return 0
  }

  return Math.min(
    EMAIL_JOB_RETRY_BACKOFF_BASE_MS * 2 ** (attemptCount - 1),
    EMAIL_JOB_RETRY_BACKOFF_MAX_MS
  )
}

function getRetryCooldownRemainingMs(
  job: {
    attemptCount?: number | null
    lastAttemptAt?: string | null
    sentAt?: string | null
  },
  nowMs: number
) {
  if (job.sentAt) {
    return null
  }

  const attemptCount = job.attemptCount ?? 0

  if (attemptCount <= 0 || !job.lastAttemptAt) {
    return null
  }

  const lastAttemptAtMs = Date.parse(job.lastAttemptAt)

  if (Number.isNaN(lastAttemptAtMs)) {
    return null
  }

  const retryBackoffMs = getRetryBackoffMs(attemptCount)
  const remainingMs = retryBackoffMs - (nowMs - lastAttemptAtMs)

  return remainingMs > 0 ? remainingMs : null
}

function isRetryCoolingDown(
  job: {
    attemptCount?: number | null
    lastAttemptAt?: string | null
    sentAt?: string | null
  },
  nowMs: number
) {
  return getRetryCooldownRemainingMs(job, nowMs) !== null
}

function getRetiredNotificationTimestamp(
  notification:
    | {
        readAt?: string | null
        archivedAt?: string | null
        emailedAt?: string | null
      }
    | null,
  fallbackNow: string
) {
  return (
    notification?.emailedAt ??
    notification?.readAt ??
    notification?.archivedAt ??
    fallbackNow
  )
}

export async function enqueueEmailJobsHandler(
  ctx: MutationCtx,
  args: EnqueueEmailJobsArgs
) {
  assertServerToken(args.serverToken)
  const queued = await queueEmailJobs(ctx, args.jobs)

  return {
    queued,
  }
}

export async function queueEmailJobs(
  ctx: MutationCtx,
  jobs: QueuedEmailJob[]
) {
  const now = getNow()

  for (const job of jobs) {
    await ctx.db.insert("emailJobs", {
      id: createId("email_job"),
      kind: job.kind,
      notificationId: job.notificationId,
      toEmail: job.toEmail,
      subject: job.subject,
      text: job.text,
      html: job.html,
      sentAt: null,
      claimId: null,
      claimedAt: null,
      lastError: null,
      attemptCount: 0,
      lastAttemptAt: null,
      createdAt: now,
    })
  }

  if (jobs.length > 0) {
    await ctx.scheduler.runAfter(0, internal.email_jobs.processQueuedEmailJobs, {})
  }

  return jobs.length
}

export async function claimPendingEmailJobs(
  ctx: MutationCtx,
  args: ClaimPendingEmailJobsInput
) {
  const now = getNow()
  const nowMs = Date.parse(now)
  const claimLimit = args.limit ?? DEFAULT_EMAIL_JOB_CLAIM_LIMIT
  const claimedJobs: ClaimedEmailJob[] = []

  const pendingJobs = ctx.db
    .query("emailJobs")
    .withIndex("by_sent_at", (q) => q.eq("sentAt", null))

  for await (const job of pendingJobs) {
    if (claimedJobs.length >= claimLimit) {
      break
    }

    if (isActiveClaim(job, nowMs)) {
      continue
    }

    if (isRetryCoolingDown(job, nowMs)) {
      continue
    }

    const notificationId = job.notificationId

    if (notificationId) {
      const notification = await ctx.db
        .query("notifications")
        .withIndex("by_domain_id", (q) => q.eq("id", notificationId))
        .unique()

      if (
        !notification ||
        notification.emailedAt ||
        notification.readAt ||
        notification.archivedAt
      ) {
        await ctx.db.patch(job._id, {
          sentAt: getRetiredNotificationTimestamp(notification, now),
          claimId: null,
          claimedAt: null,
          lastError: null,
        })
        continue
      }

      if (isActiveDigestClaim(notification, nowMs)) {
        continue
      }
    }

    await ctx.db.patch(job._id, {
      claimId: args.claimId,
      claimedAt: now,
      lastError: null,
    })

    claimedJobs.push({
      id: job.id,
      kind: job.kind,
      notificationId: job.notificationId,
      toEmail: job.toEmail,
      subject: job.subject,
      text: job.text,
      html: job.html,
    })
  }

  return claimedJobs
}

export async function claimPendingEmailJobsHandler(
  ctx: MutationCtx,
  args: ClaimPendingEmailJobsArgs
) {
  assertServerToken(args.serverToken)
  return claimPendingEmailJobs(ctx, args)
}

export async function markEmailJobsSent(
  ctx: MutationCtx,
  args: MarkEmailJobsSentInput
) {
  const now = getNow()

  for (const jobId of args.jobIds) {
    const job = await ctx.db
      .query("emailJobs")
      .withIndex("by_domain_id", (q) => q.eq("id", jobId))
      .unique()

    if (!job || job.claimId !== args.claimId || job.sentAt) {
      continue
    }

    await ctx.db.patch(job._id, {
      sentAt: now,
      claimId: null,
      claimedAt: null,
      lastError: null,
      attemptCount: (job.attemptCount ?? 0) + 1,
      lastAttemptAt: now,
    })

    const notificationId = job.notificationId

    if (notificationId) {
      const notification = await ctx.db
        .query("notifications")
        .withIndex("by_domain_id", (q) => q.eq("id", notificationId))
        .unique()

      if (notification && !notification.emailedAt) {
        await ctx.db.patch(notification._id, {
          emailedAt: now,
        })
      }
    }
  }
}

export async function markEmailJobsSentHandler(
  ctx: MutationCtx,
  args: MarkEmailJobsSentArgs
) {
  assertServerToken(args.serverToken)
  return markEmailJobsSent(ctx, args)
}

export async function releaseEmailJobClaim(
  ctx: MutationCtx,
  args: ReleaseEmailJobClaimInput
) {
  const now = getNow()
  const releasedClaims: ReleasedEmailJobClaim[] = []

  for (const jobId of args.jobIds) {
    const job = await ctx.db
      .query("emailJobs")
      .withIndex("by_domain_id", (q) => q.eq("id", jobId))
      .unique()

    if (!job || job.claimId !== args.claimId || job.sentAt) {
      continue
    }

    const attemptCount = (job.attemptCount ?? 0) + 1

    await ctx.db.patch(job._id, {
      claimId: null,
      claimedAt: null,
      lastError: args.errorMessage ?? job.lastError ?? null,
      attemptCount,
      lastAttemptAt: now,
    })

    releasedClaims.push({
      jobId: job.id,
      retryBackoffMs: getRetryBackoffMs(attemptCount),
    })
  }

  return releasedClaims
}

export async function getNextEmailJobWakeDelayMs(ctx: QueryCtx) {
  const nowMs = Date.now()
  let nextWakeDelayMs: number | null = null

  const pendingJobs = ctx.db
    .query("emailJobs")
    .withIndex("by_sent_at", (q) => q.eq("sentAt", null))

  for await (const job of pendingJobs) {
    if (job.sentAt) {
      continue
    }

    if (!job.claimId || !job.claimedAt) {
      const retryCooldownRemainingMs = getRetryCooldownRemainingMs(job, nowMs)

      if (retryCooldownRemainingMs === null) {
        return 0
      }

      nextWakeDelayMs =
        nextWakeDelayMs === null
          ? retryCooldownRemainingMs
          : Math.min(nextWakeDelayMs, retryCooldownRemainingMs)
      continue
    }

    const claimedAtMs = Date.parse(job.claimedAt)

    if (Number.isNaN(claimedAtMs)) {
      return 0
    }

    const activeClaimRemainingMs =
      EMAIL_JOB_CLAIM_TTL_MS - (nowMs - claimedAtMs)

    if (activeClaimRemainingMs <= 0) {
      return 0
    }

    nextWakeDelayMs =
      nextWakeDelayMs === null
        ? activeClaimRemainingMs
        : Math.min(nextWakeDelayMs, activeClaimRemainingMs)
  }

  return nextWakeDelayMs
}

export async function releaseEmailJobClaimHandler(
  ctx: MutationCtx,
  args: ReleaseEmailJobClaimArgs
) {
  assertServerToken(args.serverToken)
  return releaseEmailJobClaim(ctx, args)
}

export async function listPendingEmailJobsHandler(
  ctx: QueryCtx,
  args: ListPendingEmailJobsArgs
) {
  assertServerToken(args.serverToken)

  return ctx.db
    .query("emailJobs")
    .withIndex("by_sent_at", (q) => q.eq("sentAt", null))
    .take(args.limit ?? DEFAULT_EMAIL_JOB_CLAIM_LIMIT)
}
