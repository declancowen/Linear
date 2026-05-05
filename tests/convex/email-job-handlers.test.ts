import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createMutableConvexTestCtx,
  type ConvexTestRecord,
} from "@/tests/lib/convex/test-db"

const assertServerTokenMock = vi.fn()
const getNowMock = vi.fn()
const createIdMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  getNow: getNowMock,
  createId: createIdMock,
}))

type RecordWithId = ConvexTestRecord

function createCtx(input?: {
  emailJobs?: RecordWithId[]
  notifications?: RecordWithId[]
}) {
  const ctx = createMutableConvexTestCtx({
    emailJobs: input?.emailJobs ?? [],
    notifications: input?.notifications ?? [],
  })

  return {
    ...ctx,
    scheduler: {
      runAfter: vi.fn(async () => undefined),
    },
  }
}

function createEmailJobRecord(
  id: string,
  overrides: Partial<RecordWithId> = {}
): RecordWithId {
  const suffix = id.replace("job_", "")

  return {
    _id: `${id}_doc`,
    id,
    kind: "mention",
    notificationId: `notification_${suffix}`,
    toEmail: `${suffix}@example.com`,
    subject: `Job ${suffix}`,
    text: `job ${suffix}`,
    html: `<p>job ${suffix}</p>`,
    sentAt: null,
    claimId: null,
    claimedAt: null,
    lastError: null,
    attemptCount: 0,
    lastAttemptAt: null,
    createdAt: "2026-04-17T10:00:00.000Z",
    ...overrides,
  }
}

function createEmailNotificationRecord(
  id: string,
  overrides: Partial<RecordWithId> = {}
): RecordWithId {
  return {
    _id: `${id}_doc`,
    id,
    emailedAt: null,
    readAt: null,
    archivedAt: null,
    ...overrides,
  }
}

async function claimPendingJobs(ctx: ReturnType<typeof createCtx>) {
  const { claimPendingEmailJobsHandler } = await import(
    "@/convex/app/email_job_handlers"
  )

  return claimPendingEmailJobsHandler(ctx as never, {
    serverToken: "server_token",
    claimId: "claim_1",
  })
}

async function markSingleEmailJobSent(ctx: ReturnType<typeof createCtx>) {
  const { markEmailJobsSentHandler } = await import(
    "@/convex/app/email_job_handlers"
  )

  await markEmailJobsSentHandler(ctx as never, {
    serverToken: "server_token",
    claimId: "claim_1",
    jobIds: ["job_1"],
  })
}

function expectOnlySecondJobClaimed(
  result: Array<{ id: string }>,
  ctx: ReturnType<typeof createCtx>,
  firstJobExpectedState: Record<string, unknown>
) {
  expect(result.map((job) => job.id)).toEqual(["job_2"])
  expect(ctx.tables.emailJobs[0]).toMatchObject(firstJobExpectedState)
  expect(ctx.tables.emailJobs[1]).toMatchObject({
    claimId: "claim_1",
    claimedAt: "2026-04-17T11:00:00.000Z",
  })
}

function expectSingleEmailJobMarkedSent(ctx: ReturnType<typeof createCtx>) {
  expect(ctx.tables.emailJobs[0]).toMatchObject({
    sentAt: "2026-04-17T11:00:00.000Z",
    claimId: null,
    claimedAt: null,
    attemptCount: 1,
    lastAttemptAt: "2026-04-17T11:00:00.000Z",
  })
}

describe("email job handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    getNowMock.mockReset()
    createIdMock.mockReset()

    getNowMock.mockReturnValue("2026-04-17T11:00:00.000Z")
    createIdMock
      .mockReturnValueOnce("email_job_1")
      .mockReturnValueOnce("email_job_2")
      .mockReturnValue("email_job_x")
  })

  it("enqueues email jobs as unsent outbox records", async () => {
    const { enqueueEmailJobsHandler } = await import(
      "@/convex/app/email_job_handlers"
    )
    const { internal } = await import("@/convex/_generated/api")
    const ctx = createCtx()

    await enqueueEmailJobsHandler(
      ctx as never,
      {
        serverToken: "server_token",
        jobs: [
          {
            kind: "mention",
            notificationId: "notification_1",
            toEmail: "alex@example.com",
            subject: "Mentioned in launch",
            text: "text",
            html: "<p>html</p>",
          },
          {
            kind: "invite",
            toEmail: "jamie@example.com",
            subject: "Join Launch in Recipe Room",
            text: "text 2",
            html: "<p>html 2</p>",
          },
        ],
      }
    )

    expect(ctx.tables.emailJobs).toHaveLength(2)
    expect(ctx.tables.emailJobs[0]).toMatchObject({
      id: "email_job_1",
      kind: "mention",
      notificationId: "notification_1",
      sentAt: null,
      claimId: null,
      claimedAt: null,
      attemptCount: 0,
      lastError: null,
    })
    expect(ctx.tables.emailJobs[1]).toMatchObject({
      id: "email_job_2",
      kind: "invite",
      notificationId: undefined,
      sentAt: null,
      claimId: null,
      claimedAt: null,
      attemptCount: 0,
      lastError: null,
    })
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      internal.email_jobs.processQueuedEmailJobs,
      {}
    )
  })

  it("requires the server token before triggering queued email processing", async () => {
    const { triggerEmailJobProcessingHandler } = await import(
      "@/convex/app/email_job_handlers"
    )
    const { internal } = await import("@/convex/_generated/api")
    const ctx = createCtx()

    await expect(
      triggerEmailJobProcessingHandler(ctx as never, {
        serverToken: "server_token",
      })
    ).resolves.toEqual({
      scheduled: true,
    })

    expect(assertServerTokenMock).toHaveBeenCalledWith("server_token")
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      internal.email_jobs.processQueuedEmailJobs,
      {}
    )
  })

  it("claims only unclaimed or stale pending jobs", async () => {
    const ctx = createCtx({
      emailJobs: [
        createEmailJobRecord("job_1", {
          toEmail: "alex@example.com",
          subject: "One",
          text: "one",
          html: "<p>one</p>",
        }),
        createEmailJobRecord("job_2", {
          toEmail: "jamie@example.com",
          subject: "Two",
          text: "two",
          html: "<p>two</p>",
          claimId: "other_claim",
          claimedAt: "2026-04-17T10:55:00.000Z",
        }),
        createEmailJobRecord("job_3", {
          toEmail: "morgan@example.com",
          subject: "Three",
          text: "three",
          html: "<p>three</p>",
          claimId: "stale_claim",
          claimedAt: "2026-04-17T10:00:00.000Z",
          attemptCount: 1,
          lastAttemptAt: "2026-04-17T10:00:00.000Z",
        }),
      ],
      notifications: [
        createEmailNotificationRecord("notification_1"),
        createEmailNotificationRecord("notification_2"),
        createEmailNotificationRecord("notification_3"),
      ],
    })

    const result = await claimPendingJobs(ctx)

    expect(result.map((job) => job.id)).toEqual(["job_1", "job_3"])
    expect(ctx.tables.emailJobs[0]).toMatchObject({
      claimId: "claim_1",
      claimedAt: "2026-04-17T11:00:00.000Z",
    })
    expect(ctx.tables.emailJobs[2]).toMatchObject({
      claimId: "claim_1",
      claimedAt: "2026-04-17T11:00:00.000Z",
    })
  })

  it("retires notification-linked jobs that were already covered by a digest", async () => {
    const ctx = createCtx({
      emailJobs: [
        createEmailJobRecord("job_1", {
          toEmail: "alex@example.com",
          subject: "One",
          text: "one",
          html: "<p>one</p>",
        }),
        createEmailJobRecord("job_2", {
          toEmail: "jamie@example.com",
          subject: "Two",
          text: "two",
          html: "<p>two</p>",
        }),
      ],
      notifications: [
        createEmailNotificationRecord("notification_1", {
          emailedAt: "2026-04-17T10:30:00.000Z",
        }),
        createEmailNotificationRecord("notification_2"),
      ],
    })

    const result = await claimPendingJobs(ctx)
    expectOnlySecondJobClaimed(result, ctx, {
      sentAt: "2026-04-17T10:30:00.000Z",
      claimId: null,
      claimedAt: null,
      lastError: null,
    })
  })

  it("retires notification-linked jobs when the notification is no longer pending", async () => {
    const ctx = createCtx({
      emailJobs: [
        createEmailJobRecord("job_1", {
          notificationId: "notification_read",
          toEmail: "alex@example.com",
          subject: "Read",
          text: "read",
          html: "<p>read</p>",
        }),
        createEmailJobRecord("job_2", {
          notificationId: "notification_archived",
          toEmail: "jamie@example.com",
          subject: "Archived",
          text: "archived",
          html: "<p>archived</p>",
        }),
        createEmailJobRecord("job_3", {
          notificationId: "notification_missing",
          toEmail: "morgan@example.com",
          subject: "Missing",
          text: "missing",
          html: "<p>missing</p>",
        }),
        createEmailJobRecord("job_4", {
          notificationId: "notification_pending",
          toEmail: "riley@example.com",
          subject: "Pending",
          text: "pending",
          html: "<p>pending</p>",
        }),
      ],
      notifications: [
        createEmailNotificationRecord("notification_read", {
          readAt: "2026-04-17T10:15:00.000Z",
        }),
        createEmailNotificationRecord("notification_archived", {
          archivedAt: "2026-04-17T10:20:00.000Z",
        }),
        createEmailNotificationRecord("notification_pending"),
      ],
    })

    const result = await claimPendingJobs(ctx)

    expect(result.map((job) => job.id)).toEqual(["job_4"])
    expect(ctx.tables.emailJobs[0]).toMatchObject({
      sentAt: "2026-04-17T10:15:00.000Z",
      claimId: null,
      claimedAt: null,
    })
    expect(ctx.tables.emailJobs[1]).toMatchObject({
      sentAt: "2026-04-17T10:20:00.000Z",
      claimId: null,
      claimedAt: null,
    })
    expect(ctx.tables.emailJobs[2]).toMatchObject({
      sentAt: "2026-04-17T11:00:00.000Z",
      claimId: null,
      claimedAt: null,
    })
    expect(ctx.tables.emailJobs[3]).toMatchObject({
      claimId: "claim_1",
      claimedAt: "2026-04-17T11:00:00.000Z",
    })
  })

  it("leaves jobs pending while the linked notification is actively claimed for a digest", async () => {
    const { claimPendingEmailJobsHandler } = await import(
      "@/convex/app/email_job_handlers"
    )
    const ctx = createCtx({
      emailJobs: [
        createEmailJobRecord("job_1", {
          toEmail: "alex@example.com",
          subject: "One",
          text: "one",
          html: "<p>one</p>",
        }),
      ],
      notifications: [
        createEmailNotificationRecord("notification_1", {
          digestClaimId: "digest_claim_1",
          digestClaimedAt: "2026-04-17T10:55:00.000Z",
        }),
      ],
    })

    const result = await claimPendingEmailJobsHandler(
      ctx as never,
      {
        serverToken: "server_token",
        claimId: "claim_1",
      }
    )

    expect(result).toEqual([])
    expect(ctx.tables.emailJobs[0]).toMatchObject({
      sentAt: null,
      claimId: null,
      claimedAt: null,
    })
  })

  it("does not immediately reclaim failed jobs before retry backoff expires", async () => {
    const ctx = createCtx({
      emailJobs: [
        createEmailJobRecord("job_1", {
          kind: "invite",
          toEmail: "alex@example.com",
          subject: "Cooling down",
          text: "cooling down",
          html: "<p>cooling down</p>",
          notificationId: undefined,
          lastError: "Mailbox unavailable",
          attemptCount: 1,
          lastAttemptAt: "2026-04-17T10:59:30.000Z",
        }),
        createEmailJobRecord("job_2", {
          kind: "invite",
          toEmail: "jamie@example.com",
          subject: "Ready",
          text: "ready",
          html: "<p>ready</p>",
          notificationId: undefined,
          lastError: "Mailbox unavailable",
          attemptCount: 1,
          lastAttemptAt: "2026-04-17T10:58:00.000Z",
        }),
      ],
    })

    const result = await claimPendingJobs(ctx)
    expectOnlySecondJobClaimed(result, ctx, {
      claimId: null,
      claimedAt: null,
    })
  })

  it("reports the next wake delay for cooling-down and claimed jobs", async () => {
    const { getNextEmailJobWakeDelayMs } = await import(
      "@/convex/app/email_job_handlers"
    )
    const ctx = createCtx({
      emailJobs: [
        createEmailJobRecord("job_1", {
          kind: "invite",
          toEmail: "alex@example.com",
          subject: "Cooling down",
          text: "cooling down",
          html: "<p>cooling down</p>",
          notificationId: undefined,
          lastError: "Mailbox unavailable",
          attemptCount: 5,
          lastAttemptAt: "2026-04-17T10:59:30.000Z",
        }),
        createEmailJobRecord("job_2", {
          kind: "invite",
          toEmail: "jamie@example.com",
          subject: "Claimed",
          text: "claimed",
          html: "<p>claimed</p>",
          notificationId: undefined,
          claimId: "claim_2",
          claimedAt: "2026-04-17T10:58:00.000Z",
        }),
      ],
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-17T11:00:00.000Z"))

    await expect(getNextEmailJobWakeDelayMs(ctx as never)).resolves.toBe(
      13 * 60 * 1000
    )

    vi.useRealTimers()
  })

  it("accounts for active digest claims when computing the next wake delay", async () => {
    const { getNextEmailJobWakeDelayMs } = await import(
      "@/convex/app/email_job_handlers"
    )
    const ctx = createCtx({
      emailJobs: [
        createEmailJobRecord("job_1", {
          toEmail: "alex@example.com",
          subject: "Digest blocked",
          text: "digest blocked",
          html: "<p>digest blocked</p>",
        }),
      ],
      notifications: [
        createEmailNotificationRecord("notification_1", {
          digestClaimId: "digest_1",
          digestClaimedAt: "2026-04-17T10:55:00.000Z",
        }),
      ],
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-17T11:00:00.000Z"))

    await expect(getNextEmailJobWakeDelayMs(ctx as never)).resolves.toBe(
      10 * 60 * 1000
    )

    vi.useRealTimers()
  })

  it("marks sent jobs and their notifications as emailed", async () => {
    const ctx = createCtx({
      emailJobs: [
        createEmailJobRecord("job_1", {
          toEmail: "alex@example.com",
          subject: "One",
          text: "one",
          html: "<p>one</p>",
          claimId: "claim_1",
          claimedAt: "2026-04-17T10:59:00.000Z",
        }),
      ],
      notifications: [
        createEmailNotificationRecord("notification_1"),
      ],
    })

    await markSingleEmailJobSent(ctx)

    expectSingleEmailJobMarkedSent(ctx)
    expect(ctx.tables.notifications[0]).toMatchObject({
      emailedAt: "2026-04-17T11:00:00.000Z",
    })
  })

  it("marks sent non-notification jobs without touching notifications", async () => {
    const ctx = createCtx({
      emailJobs: [
        createEmailJobRecord("job_1", {
          kind: "invite",
          notificationId: undefined,
          toEmail: "alex@example.com",
          subject: "Invite",
          text: "invite",
          html: "<p>invite</p>",
          claimId: "claim_1",
          claimedAt: "2026-04-17T10:59:00.000Z",
        }),
      ],
    })

    await markSingleEmailJobSent(ctx)

    expectSingleEmailJobMarkedSent(ctx)
    expect(ctx.tables.notifications).toHaveLength(0)
  })

  it("releases failed claims and records the last error", async () => {
    const { releaseEmailJobClaimHandler } = await import(
      "@/convex/app/email_job_handlers"
    )
    const ctx = createCtx({
      emailJobs: [
        createEmailJobRecord("job_1", {
          toEmail: "alex@example.com",
          subject: "One",
          text: "one",
          html: "<p>one</p>",
          claimId: "claim_1",
          claimedAt: "2026-04-17T10:59:00.000Z",
        }),
      ],
    })

    const result = await releaseEmailJobClaimHandler(
      ctx as never,
      {
        serverToken: "server_token",
        claimId: "claim_1",
        jobIds: ["job_1"],
        errorMessage: "SMTP timeout",
      }
    )

    expect(ctx.tables.emailJobs[0]).toMatchObject({
      claimId: null,
      claimedAt: null,
      lastError: "SMTP timeout",
      attemptCount: 1,
      lastAttemptAt: "2026-04-17T11:00:00.000Z",
    })
    expect(result).toEqual([
      {
        jobId: "job_1",
        retryBackoffMs: 60 * 1000,
      },
    ])
  })
})
