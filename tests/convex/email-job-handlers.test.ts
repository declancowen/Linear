import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const getNowMock = vi.fn()
const createIdMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  getNow: getNowMock,
  createId: createIdMock,
}))

type RecordWithId = {
  _id: string
  [key: string]: unknown
}

function createQuery(records: RecordWithId[]) {
  return {
    withIndex: (_indexName: string, build?: (query: {
      eq: (field: string, value: unknown) => unknown
    }) => unknown) => {
      const filters: Array<{ field: string; value: unknown }> = []
      const queryApi = {
        eq(field: string, value: unknown) {
          filters.push({ field, value })
          return queryApi
        },
      }

      build?.(queryApi)

      const applyFilters = () =>
        records.filter((record) =>
          filters.every(({ field, value }) => record[field] === value)
        )

      return {
        collect: async () => applyFilters(),
        take: async (count: number) => applyFilters().slice(0, count),
        unique: async () => applyFilters()[0] ?? null,
        async *[Symbol.asyncIterator]() {
          for (const record of applyFilters()) {
            yield record
          }
        },
      }
    },
  }
}

function createCtx(input?: {
  emailJobs?: RecordWithId[]
  notifications?: RecordWithId[]
}) {
  const tables = {
    emailJobs: [...(input?.emailJobs ?? [])],
    notifications: [...(input?.notifications ?? [])],
  }

  return {
    tables,
    db: {
      insert: vi.fn(async (
        table: keyof typeof tables,
        value: Record<string, unknown> & { id: string }
      ) => {
        tables[table].push({
          ...value,
          _id: `${value.id}_doc`,
        })
      }),
      patch: vi.fn(async (docId: string, patch: Record<string, unknown>) => {
        for (const table of Object.values(tables)) {
          const record = table.find((entry) => entry._id === docId)

          if (record) {
            Object.assign(record, patch)
            return
          }
        }
      }),
      query: (table: keyof typeof tables) => createQuery(tables[table]),
    },
  }
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
  })

  it("claims only unclaimed or stale pending jobs", async () => {
    const { claimPendingEmailJobsHandler } = await import(
      "@/convex/app/email_job_handlers"
    )
    const ctx = createCtx({
      emailJobs: [
        {
          _id: "job_1_doc",
          id: "job_1",
          kind: "mention",
          notificationId: "notification_1",
          toEmail: "alex@example.com",
          subject: "One",
          text: "one",
          html: "<p>one</p>",
          sentAt: null,
          claimId: null,
          claimedAt: null,
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
        {
          _id: "job_2_doc",
          id: "job_2",
          kind: "mention",
          notificationId: "notification_2",
          toEmail: "jamie@example.com",
          subject: "Two",
          text: "two",
          html: "<p>two</p>",
          sentAt: null,
          claimId: "other_claim",
          claimedAt: "2026-04-17T10:55:00.000Z",
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
        {
          _id: "job_3_doc",
          id: "job_3",
          kind: "mention",
          notificationId: "notification_3",
          toEmail: "morgan@example.com",
          subject: "Three",
          text: "three",
          html: "<p>three</p>",
          sentAt: null,
          claimId: "stale_claim",
          claimedAt: "2026-04-17T10:00:00.000Z",
          lastError: null,
          attemptCount: 1,
          lastAttemptAt: "2026-04-17T10:00:00.000Z",
          createdAt: "2026-04-17T10:00:00.000Z",
        },
      ],
      notifications: [
        {
          _id: "notification_1_doc",
          id: "notification_1",
          emailedAt: null,
          readAt: null,
          archivedAt: null,
        },
        {
          _id: "notification_2_doc",
          id: "notification_2",
          emailedAt: null,
          readAt: null,
          archivedAt: null,
        },
        {
          _id: "notification_3_doc",
          id: "notification_3",
          emailedAt: null,
          readAt: null,
          archivedAt: null,
        },
      ],
    })

    const result = await claimPendingEmailJobsHandler(
      ctx as never,
      {
        serverToken: "server_token",
        claimId: "claim_1",
      }
    )

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
    const { claimPendingEmailJobsHandler } = await import(
      "@/convex/app/email_job_handlers"
    )
    const ctx = createCtx({
      emailJobs: [
        {
          _id: "job_1_doc",
          id: "job_1",
          kind: "mention",
          notificationId: "notification_1",
          toEmail: "alex@example.com",
          subject: "One",
          text: "one",
          html: "<p>one</p>",
          sentAt: null,
          claimId: null,
          claimedAt: null,
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
        {
          _id: "job_2_doc",
          id: "job_2",
          kind: "mention",
          notificationId: "notification_2",
          toEmail: "jamie@example.com",
          subject: "Two",
          text: "two",
          html: "<p>two</p>",
          sentAt: null,
          claimId: null,
          claimedAt: null,
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
      ],
      notifications: [
        {
          _id: "notification_1_doc",
          id: "notification_1",
          emailedAt: "2026-04-17T10:30:00.000Z",
        },
        {
          _id: "notification_2_doc",
          id: "notification_2",
          emailedAt: null,
        },
      ],
    })

    const result = await claimPendingEmailJobsHandler(
      ctx as never,
      {
        serverToken: "server_token",
        claimId: "claim_1",
      }
    )

    expect(result.map((job) => job.id)).toEqual(["job_2"])
    expect(ctx.tables.emailJobs[0]).toMatchObject({
      sentAt: "2026-04-17T10:30:00.000Z",
      claimId: null,
      claimedAt: null,
      lastError: null,
    })
    expect(ctx.tables.emailJobs[1]).toMatchObject({
      claimId: "claim_1",
      claimedAt: "2026-04-17T11:00:00.000Z",
    })
  })

  it("retires notification-linked jobs when the notification is no longer pending", async () => {
    const { claimPendingEmailJobsHandler } = await import(
      "@/convex/app/email_job_handlers"
    )
    const ctx = createCtx({
      emailJobs: [
        {
          _id: "job_1_doc",
          id: "job_1",
          kind: "mention",
          notificationId: "notification_read",
          toEmail: "alex@example.com",
          subject: "Read",
          text: "read",
          html: "<p>read</p>",
          sentAt: null,
          claimId: null,
          claimedAt: null,
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
        {
          _id: "job_2_doc",
          id: "job_2",
          kind: "mention",
          notificationId: "notification_archived",
          toEmail: "jamie@example.com",
          subject: "Archived",
          text: "archived",
          html: "<p>archived</p>",
          sentAt: null,
          claimId: null,
          claimedAt: null,
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
        {
          _id: "job_3_doc",
          id: "job_3",
          kind: "mention",
          notificationId: "notification_missing",
          toEmail: "morgan@example.com",
          subject: "Missing",
          text: "missing",
          html: "<p>missing</p>",
          sentAt: null,
          claimId: null,
          claimedAt: null,
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
        {
          _id: "job_4_doc",
          id: "job_4",
          kind: "mention",
          notificationId: "notification_pending",
          toEmail: "riley@example.com",
          subject: "Pending",
          text: "pending",
          html: "<p>pending</p>",
          sentAt: null,
          claimId: null,
          claimedAt: null,
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
      ],
      notifications: [
        {
          _id: "notification_read_doc",
          id: "notification_read",
          emailedAt: null,
          readAt: "2026-04-17T10:15:00.000Z",
          archivedAt: null,
        },
        {
          _id: "notification_archived_doc",
          id: "notification_archived",
          emailedAt: null,
          readAt: null,
          archivedAt: "2026-04-17T10:20:00.000Z",
        },
        {
          _id: "notification_pending_doc",
          id: "notification_pending",
          emailedAt: null,
          readAt: null,
          archivedAt: null,
        },
      ],
    })

    const result = await claimPendingEmailJobsHandler(
      ctx as never,
      {
        serverToken: "server_token",
        claimId: "claim_1",
      }
    )

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
        {
          _id: "job_1_doc",
          id: "job_1",
          kind: "mention",
          notificationId: "notification_1",
          toEmail: "alex@example.com",
          subject: "One",
          text: "one",
          html: "<p>one</p>",
          sentAt: null,
          claimId: null,
          claimedAt: null,
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
      ],
      notifications: [
        {
          _id: "notification_1_doc",
          id: "notification_1",
          emailedAt: null,
          readAt: null,
          archivedAt: null,
          digestClaimId: "digest_claim_1",
          digestClaimedAt: "2026-04-17T10:55:00.000Z",
        },
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

  it("marks sent jobs and their notifications as emailed", async () => {
    const { markEmailJobsSentHandler } = await import(
      "@/convex/app/email_job_handlers"
    )
    const ctx = createCtx({
      emailJobs: [
        {
          _id: "job_1_doc",
          id: "job_1",
          kind: "mention",
          notificationId: "notification_1",
          toEmail: "alex@example.com",
          subject: "One",
          text: "one",
          html: "<p>one</p>",
          sentAt: null,
          claimId: "claim_1",
          claimedAt: "2026-04-17T10:59:00.000Z",
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
      ],
      notifications: [
        {
          _id: "notification_1_doc",
          id: "notification_1",
          emailedAt: null,
        },
      ],
    })

    await markEmailJobsSentHandler(
      ctx as never,
      {
        serverToken: "server_token",
        claimId: "claim_1",
        jobIds: ["job_1"],
      }
    )

    expect(ctx.tables.emailJobs[0]).toMatchObject({
      sentAt: "2026-04-17T11:00:00.000Z",
      claimId: null,
      claimedAt: null,
      attemptCount: 1,
      lastAttemptAt: "2026-04-17T11:00:00.000Z",
    })
    expect(ctx.tables.notifications[0]).toMatchObject({
      emailedAt: "2026-04-17T11:00:00.000Z",
    })
  })

  it("marks sent non-notification jobs without touching notifications", async () => {
    const { markEmailJobsSentHandler } = await import(
      "@/convex/app/email_job_handlers"
    )
    const ctx = createCtx({
      emailJobs: [
        {
          _id: "job_1_doc",
          id: "job_1",
          kind: "invite",
          toEmail: "alex@example.com",
          subject: "Invite",
          text: "invite",
          html: "<p>invite</p>",
          sentAt: null,
          claimId: "claim_1",
          claimedAt: "2026-04-17T10:59:00.000Z",
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
      ],
    })

    await markEmailJobsSentHandler(
      ctx as never,
      {
        serverToken: "server_token",
        claimId: "claim_1",
        jobIds: ["job_1"],
      }
    )

    expect(ctx.tables.emailJobs[0]).toMatchObject({
      sentAt: "2026-04-17T11:00:00.000Z",
      claimId: null,
      claimedAt: null,
      attemptCount: 1,
      lastAttemptAt: "2026-04-17T11:00:00.000Z",
    })
    expect(ctx.tables.notifications).toHaveLength(0)
  })

  it("releases failed claims and records the last error", async () => {
    const { releaseEmailJobClaimHandler } = await import(
      "@/convex/app/email_job_handlers"
    )
    const ctx = createCtx({
      emailJobs: [
        {
          _id: "job_1_doc",
          id: "job_1",
          kind: "mention",
          notificationId: "notification_1",
          toEmail: "alex@example.com",
          subject: "One",
          text: "one",
          html: "<p>one</p>",
          sentAt: null,
          claimId: "claim_1",
          claimedAt: "2026-04-17T10:59:00.000Z",
          lastError: null,
          attemptCount: 0,
          lastAttemptAt: null,
          createdAt: "2026-04-17T10:00:00.000Z",
        },
      ],
    })

    await releaseEmailJobClaimHandler(
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
  })
})
