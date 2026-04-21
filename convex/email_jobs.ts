"use node"

import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalAction } from "./_generated/server"
import { DEFAULT_EMAIL_JOB_CLAIM_LIMIT } from "./app/email_job_handlers"
import {
  getRequiredEnv,
  processQueuedEmailJobsBatch,
} from "../lib/email/queued-email-worker"

export const processQueuedEmailJobs = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? DEFAULT_EMAIL_JOB_CLAIM_LIMIT
    const result = await processQueuedEmailJobsBatch({
      resendApiKey: getRequiredEnv("RESEND_API_KEY"),
      resendFromEmail: getRequiredEnv("RESEND_FROM_EMAIL"),
      resendFromName: process.env.RESEND_FROM_NAME,
      claimPendingEmailJobs: (payload) =>
        ctx.runMutation(
          internal.email_job_mutations.claimPendingEmailJobsInternal,
          payload
        ),
      markEmailJobsSent: (payload) =>
        ctx.runMutation(
          internal.email_job_mutations.markEmailJobsSentInternal,
          payload
        ),
      releaseEmailJobClaim: (payload) =>
        ctx.runMutation(
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

    const nextWakeDelayMs = await ctx.runQuery(
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
  },
})
