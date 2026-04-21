import { v } from "convex/values"

import { internalMutation } from "./_generated/server"
import {
  claimPendingEmailJobs,
  markEmailJobsSent,
  releaseEmailJobClaim,
} from "./app/email_job_handlers"

export const claimPendingEmailJobsInternal = internalMutation({
  args: {
    claimId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: (ctx, args) => claimPendingEmailJobs(ctx, args),
})

export const markEmailJobsSentInternal = internalMutation({
  args: {
    claimId: v.string(),
    jobIds: v.array(v.string()),
  },
  handler: (ctx, args) => markEmailJobsSent(ctx, args),
})

export const releaseEmailJobClaimInternal = internalMutation({
  args: {
    claimId: v.string(),
    jobIds: v.array(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: (ctx, args) => releaseEmailJobClaim(ctx, args),
})
