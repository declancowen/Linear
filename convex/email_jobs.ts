"use node"

import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalAction } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"
import { DEFAULT_EMAIL_JOB_CLAIM_LIMIT } from "./app/email_job_handlers"
import {
  getRequiredEnv,
  processQueuedEmailJobsBatch,
} from "../lib/email/queued-email-worker"

type ProcessQueuedEmailJobsCtx =
  | ActionCtx
  | {
      runMutation: (mutation: unknown, payload: unknown) => Promise<unknown>
      runQuery: (
        query: unknown,
        payload: Record<string, never>
      ) => Promise<number | null>
      scheduler: {
        runAfter: (
          delayMs: number,
          action: unknown,
          payload: { limit: number }
        ) => Promise<unknown> | unknown
      }
    }

function runEmailJobMutation(
  ctx: ProcessQueuedEmailJobsCtx,
  mutation: unknown,
  payload: unknown
) {
  return (
    ctx.runMutation as (
      mutation: unknown,
      payload: unknown
    ) => Promise<unknown>
  )(mutation, payload)
}

function runEmailJobQuery(
  ctx: ProcessQueuedEmailJobsCtx,
  query: unknown,
  payload: Record<string, never>
) {
  return (
    ctx.runQuery as (
      query: unknown,
      payload: Record<string, never>
    ) => Promise<number | null>
  )(query, payload)
}

export async function processQueuedEmailJobsHandler(
  ctx: ProcessQueuedEmailJobsCtx,
  args: { limit?: number }
) {
  const limit = args.limit ?? DEFAULT_EMAIL_JOB_CLAIM_LIMIT
  const result = await processQueuedEmailJobsBatch({
    resendApiKey: getRequiredEnv("RESEND_API_KEY"),
    resendFromEmail: getRequiredEnv("RESEND_FROM_EMAIL"),
    resendFromName: process.env.RESEND_FROM_NAME,
    claimPendingEmailJobs: (payload) =>
      runEmailJobMutation(
        ctx,
        internal.email_job_mutations.claimPendingEmailJobsInternal,
        payload
      ) as never,
    markEmailJobsSent: (payload) =>
      runEmailJobMutation(
        ctx,
        internal.email_job_mutations.markEmailJobsSentInternal,
        payload
      ),
    releaseEmailJobClaim: (payload) =>
      runEmailJobMutation(
        ctx,
        internal.email_job_mutations.releaseEmailJobClaimInternal,
        payload
      ),
    limit,
  })

  if (result.claimedFullBatch) {
    await ctx.scheduler.runAfter(0, internal.email_jobs.processQueuedEmailJobs, {
      limit,
    })
  }

  const nextWakeDelayMs = await runEmailJobQuery(
    ctx,
    internal.email_job_mutations.getNextEmailJobWakeDelayInternal,
    {}
  )

  if (nextWakeDelayMs !== null && !result.claimedFullBatch) {
    await ctx.scheduler.runAfter(
      nextWakeDelayMs,
      internal.email_jobs.processQueuedEmailJobs,
      {
        limit,
      }
    )
  }

  return result
}

export const processQueuedEmailJobs = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: processQueuedEmailJobsHandler,
})
