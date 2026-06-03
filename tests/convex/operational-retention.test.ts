import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { cleanupOperationalRetentionHandler } from "@/convex/app/maintenance"
import { createMutableConvexTestCtx } from "@/tests/lib/convex/test-db"

const NOW = "2026-06-03T12:00:00.000Z"
const OLD = "2026-01-01T12:00:00.000Z"
const RECENT = "2026-06-01T12:00:00.000Z"

function createRetentionCtx() {
  return createMutableConvexTestCtx({
    emailJobs: [
      {
        _id: "sent_email_job_doc",
        id: "sent_email_job",
        createdAt: OLD,
        sentAt: OLD,
      },
      {
        _id: "failed_email_job_doc",
        id: "failed_email_job",
        attemptCount: 5,
        createdAt: OLD,
        lastError: "Resend failed",
        sentAt: null,
      },
      {
        _id: "pending_email_job_doc",
        id: "pending_email_job",
        attemptCount: 1,
        createdAt: OLD,
        lastError: "Retry later",
        sentAt: null,
      },
      {
        _id: "recent_email_job_doc",
        id: "recent_email_job",
        createdAt: RECENT,
        sentAt: RECENT,
      },
    ],
    notifications: [
      {
        _id: "read_notification_doc",
        id: "read_notification",
        createdAt: OLD,
        digestClaimId: null,
        readAt: OLD,
      },
      {
        _id: "unread_notification_doc",
        id: "unread_notification",
        createdAt: OLD,
        digestClaimId: null,
        readAt: null,
      },
      {
        _id: "claimed_notification_doc",
        id: "claimed_notification",
        createdAt: OLD,
        digestClaimId: "claim_1",
        readAt: OLD,
      },
      {
        _id: "recent_notification_doc",
        id: "recent_notification",
        archivedAt: RECENT,
        createdAt: RECENT,
        digestClaimId: null,
      },
    ],
    readModelVersions: [
      {
        _id: "old_read_model_version_doc",
        scopeKey: "work-index:workspace_1",
        updatedAt: OLD,
        version: 10,
      },
      {
        _id: "recent_read_model_version_doc",
        scopeKey: "shell-context",
        updatedAt: RECENT,
        version: 2,
      },
    ],
  })
}

describe("operational retention cleanup", () => {
  const originalServerToken = process.env.CONVEX_SERVER_TOKEN

  beforeEach(() => {
    process.env.CONVEX_SERVER_TOKEN = "server_token"
  })

  afterEach(() => {
    if (originalServerToken === undefined) {
      delete process.env.CONVEX_SERVER_TOKEN
    } else {
      process.env.CONVEX_SERVER_TOKEN = originalServerToken
    }
  })

  it("defaults to dry-run and reports bounded cleanup candidates without deleting", async () => {
    const ctx = createRetentionCtx()

    await expect(
      cleanupOperationalRetentionHandler(ctx as never, {
        limit: 10,
        now: NOW,
        serverToken: "server_token",
      })
    ).resolves.toMatchObject({
      deleted: {
        emailJobs: 2,
        notifications: 1,
        readModelVersions: 1,
        total: 4,
      },
      dryRun: true,
      limit: 10,
    })

    expect(ctx.db.delete).not.toHaveBeenCalled()
    expect(ctx.tables.notifications.map((entry) => entry.id)).toContain(
      "read_notification"
    )
    expect(ctx.queries).toEqual([
      expect.objectContaining({
        count: 30,
        filters: [
          expect.objectContaining({
            field: "readAt",
            operator: "gt",
          }),
          expect.objectContaining({
            field: "readAt",
            operator: "lt",
          }),
        ],
        indexName: "by_read_at",
        operation: "take",
        table: "notifications",
      }),
      expect.objectContaining({
        count: 30,
        filters: [
          expect.objectContaining({
            field: "archivedAt",
            operator: "gt",
          }),
          expect.objectContaining({
            field: "archivedAt",
            operator: "lt",
          }),
        ],
        indexName: "by_archived_at",
        operation: "take",
        table: "notifications",
      }),
      expect.objectContaining({
        count: 30,
        filters: [
          expect.objectContaining({
            field: "emailedAt",
            operator: "gt",
          }),
          expect.objectContaining({
            field: "emailedAt",
            operator: "lt",
          }),
        ],
        indexName: "by_emailed_at",
        operation: "take",
        table: "notifications",
      }),
      expect.objectContaining({
        count: 27,
        filters: [
          expect.objectContaining({
            field: "sentAt",
            operator: "gt",
          }),
          expect.objectContaining({
            field: "sentAt",
            operator: "lt",
          }),
        ],
        indexName: "by_sent_at",
        operation: "take",
        table: "emailJobs",
      }),
      expect.objectContaining({
        count: 27,
        filters: [
          expect.objectContaining({
            field: "createdAt",
            operator: "lt",
          }),
        ],
        indexName: "by_created_at",
        operation: "take",
        table: "emailJobs",
      }),
      expect.objectContaining({
        count: 21,
        filters: [
          expect.objectContaining({
            field: "updatedAt",
            operator: "lt",
          }),
        ],
        indexName: "by_updated_at",
        operation: "take",
        table: "readModelVersions",
      }),
    ])
  })

  it("does not let old active notifications block terminal notification cleanup", async () => {
    const ctx = createRetentionCtx()

    ctx.tables.notifications.unshift(
      ...Array.from({ length: 6 }, (_, index) => ({
        _id: `active_old_notification_${index}_doc`,
        createdAt: OLD,
        digestClaimId: null,
        id: `active_old_notification_${index}`,
        readAt: null,
      }))
    )

    await cleanupOperationalRetentionHandler(ctx as never, {
      dryRun: false,
      limit: 1,
      now: NOW,
      serverToken: "server_token",
    })

    expect(ctx.tables.notifications.map((entry) => entry.id)).not.toContain(
      "read_notification"
    )
    expect(
      ctx.queries
        .filter((query) => query.table === "notifications")
        .map((query) => query.indexName)
    ).toEqual(["by_read_at", "by_archived_at", "by_emailed_at"])
  })

  it("does not let old pending email jobs block sent email cleanup", async () => {
    const ctx = createRetentionCtx()

    ctx.tables.emailJobs.unshift(
      ...Array.from({ length: 6 }, (_, index) => ({
        _id: `pending_old_email_job_${index}_doc`,
        attemptCount: 1,
        createdAt: OLD,
        id: `pending_old_email_job_${index}`,
        lastError: "Retry later",
        sentAt: null,
      }))
    )

    await cleanupOperationalRetentionHandler(ctx as never, {
      dryRun: false,
      limit: 2,
      now: NOW,
      serverToken: "server_token",
    })

    expect(ctx.tables.emailJobs.map((entry) => entry.id)).not.toContain(
      "sent_email_job"
    )
    expect(
      ctx.queries
        .filter((query) => query.table === "emailJobs")
        .map((query) => query.indexName)
    ).toEqual(["by_sent_at", "by_created_at"])
  })

  it("deletes only stale terminal records and preserves active records", async () => {
    const ctx = createRetentionCtx()

    await cleanupOperationalRetentionHandler(ctx as never, {
      dryRun: false,
      limit: 10,
      now: NOW,
      serverToken: "server_token",
    })

    expect(ctx.tables.notifications.map((entry) => entry.id)).toEqual([
      "unread_notification",
      "claimed_notification",
      "recent_notification",
    ])
    expect(ctx.tables.emailJobs.map((entry) => entry.id)).toEqual([
      "pending_email_job",
      "recent_email_job",
    ])
    expect(ctx.tables.readModelVersions.map((entry) => entry.scopeKey)).toEqual(
      ["shell-context"]
    )
  })

  it("caps deletion count across all retention tables", async () => {
    const ctx = createRetentionCtx()

    await expect(
      cleanupOperationalRetentionHandler(ctx as never, {
        dryRun: false,
        limit: 2,
        now: NOW,
        serverToken: "server_token",
      })
    ).resolves.toMatchObject({
      deleted: {
        emailJobs: 1,
        notifications: 1,
        readModelVersions: 0,
        total: 2,
      },
    })

    expect(ctx.tables.notifications.map((entry) => entry.id)).not.toContain(
      "read_notification"
    )
    expect(ctx.tables.emailJobs.map((entry) => entry.id)).not.toContain(
      "sent_email_job"
    )
    expect(ctx.tables.emailJobs.map((entry) => entry.id)).toContain(
      "failed_email_job"
    )
    expect(ctx.tables.readModelVersions).toHaveLength(2)
  })
})
