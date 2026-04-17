import type { MutationCtx, QueryCtx } from "../_generated/server"
import type { QueuedEmailJob } from "../../lib/email/builders"

import { assertServerToken, createId, getNow } from "./core"

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

const EMAIL_JOB_CLAIM_TTL_MS = 15 * 60 * 1000
const DEFAULT_EMAIL_JOB_CLAIM_LIMIT = 25

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

  return jobs.length
}

export async function claimPendingEmailJobsHandler(
  ctx: MutationCtx,
  args: ClaimPendingEmailJobsArgs
) {
  assertServerToken(args.serverToken)
  const now = getNow()
  const nowMs = Date.parse(now)
  const claimLimit = args.limit ?? DEFAULT_EMAIL_JOB_CLAIM_LIMIT
  const claimedJobs: Array<{
    id: string
    kind: "mention" | "assignment" | "invite" | "access-change"
    notificationId?: string
    toEmail: string
    subject: string
    text: string
    html: string
  }> = []

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

export async function markEmailJobsSentHandler(
  ctx: MutationCtx,
  args: MarkEmailJobsSentArgs
) {
  assertServerToken(args.serverToken)
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

export async function releaseEmailJobClaimHandler(
  ctx: MutationCtx,
  args: ReleaseEmailJobClaimArgs
) {
  assertServerToken(args.serverToken)
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
      claimId: null,
      claimedAt: null,
      lastError: args.errorMessage ?? job.lastError ?? null,
      attemptCount: (job.attemptCount ?? 0) + 1,
      lastAttemptAt: now,
    })
  }
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
