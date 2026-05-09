import { beforeEach, describe, expect, it, vi } from "vitest"

const processQueuedEmailJobsBatchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/email/queued-email-worker", () => ({
  getRequiredEnv: (name: string) => `env:${name}`,
  processQueuedEmailJobsBatch: processQueuedEmailJobsBatchMock,
}))

describe("processQueuedEmailJobsHandler", () => {
  beforeEach(() => {
    processQueuedEmailJobsBatchMock.mockReset()
    process.env.RESEND_FROM_NAME = "Linear"
  })

  it("claims jobs through Convex mutations and reschedules full batches", async () => {
    const { internal } = await import("@/convex/_generated/api")
    const { processQueuedEmailJobsHandler } = await import("@/convex/email_jobs")
    const ctx = {
      runMutation: vi.fn().mockResolvedValue([]),
      runQuery: vi.fn().mockResolvedValue(null),
      scheduler: {
        runAfter: vi.fn().mockResolvedValue(undefined),
      },
    }

    processQueuedEmailJobsBatchMock.mockResolvedValue({
      claimId: "claim_1",
      claimedFullBatch: true,
      failedCount: 0,
      nextRetryDelayMs: null,
      processedCount: 3,
      sentCount: 3,
    })

    await processQueuedEmailJobsHandler(ctx, { limit: 3 })
    const batchInput = processQueuedEmailJobsBatchMock.mock.calls[0][0]

    await batchInput.claimPendingEmailJobs({ claimId: "claim_1", limit: 3 })
    await batchInput.markEmailJobsSent({
      claimId: "claim_1",
      jobIds: ["job_1"],
    })
    await batchInput.releaseEmailJobClaim({
      claimId: "claim_1",
      jobIds: ["job_2"],
      errorMessage: "failed",
    })

    expect(processQueuedEmailJobsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 3,
        resendApiKey: "env:RESEND_API_KEY",
        resendFromEmail: "env:RESEND_FROM_EMAIL",
        resendFromName: "Linear",
      })
    )
    expect(ctx.runMutation).toHaveBeenCalledWith(
      internal.email_job_mutations.claimPendingEmailJobsInternal,
      { claimId: "claim_1", limit: 3 }
    )
    expect(ctx.runMutation).toHaveBeenCalledWith(
      internal.email_job_mutations.markEmailJobsSentInternal,
      { claimId: "claim_1", jobIds: ["job_1"] }
    )
    expect(ctx.runMutation).toHaveBeenCalledWith(
      internal.email_job_mutations.releaseEmailJobClaimInternal,
      {
        claimId: "claim_1",
        jobIds: ["job_2"],
        errorMessage: "failed",
      }
    )
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      internal.email_jobs.processQueuedEmailJobs,
      { limit: 3 }
    )
  })

  it("uses the default limit and schedules the next wakeup for partial batches", async () => {
    const { internal } = await import("@/convex/_generated/api")
    const { DEFAULT_EMAIL_JOB_CLAIM_LIMIT } = await import(
      "@/convex/app/email_job_handlers"
    )
    const { processQueuedEmailJobsHandler } = await import("@/convex/email_jobs")
    const ctx = {
      runMutation: vi.fn(),
      runQuery: vi.fn().mockResolvedValue(1500),
      scheduler: {
        runAfter: vi.fn().mockResolvedValue(undefined),
      },
    }

    processQueuedEmailJobsBatchMock.mockResolvedValue({
      claimId: "claim_2",
      claimedFullBatch: false,
      failedCount: 0,
      nextRetryDelayMs: null,
      processedCount: 1,
      sentCount: 1,
    })

    await processQueuedEmailJobsHandler(ctx, {})

    expect(processQueuedEmailJobsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: DEFAULT_EMAIL_JOB_CLAIM_LIMIT,
      })
    )
    expect(ctx.runQuery).toHaveBeenCalledWith(
      internal.email_job_mutations.getNextEmailJobWakeDelayInternal,
      {}
    )
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
      1500,
      internal.email_jobs.processQueuedEmailJobs,
      { limit: DEFAULT_EMAIL_JOB_CLAIM_LIMIT }
    )
  })
})
