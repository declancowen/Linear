import { describe, expect, it, vi } from "vitest"

function createDigest(
  suffix: "1" | "2",
  overrides: Record<string, unknown> = {}
) {
  const isSecond = suffix === "2"

  return {
    user: {
      id: `user_${suffix}`,
      email: isSecond ? "jamie@example.com" : "alex@example.com",
      name: isSecond ? "Jamie" : "Alex",
    },
    notifications: [
      {
        id: `notification_${suffix}`,
        entityType: isSecond ? "chat" : "workItem",
        entityId: isSecond ? "chat_1" : "item_1",
        message: isSecond ? "Two" : "One",
        createdAt: isSecond
          ? "2026-04-17T10:05:00.000Z"
          : "2026-04-17T10:00:00.000Z",
      },
    ],
    ...overrides,
  }
}

function createDigestBatchInput({
  digests = [createDigest("1"), createDigest("2")],
  markNotificationsEmailed = vi.fn(),
  releaseNotificationDigestClaim = vi.fn().mockResolvedValue(undefined),
  resendFromName,
  send,
}: {
  digests?: ReturnType<typeof createDigest>[]
  markNotificationsEmailed?: ReturnType<typeof vi.fn>
  releaseNotificationDigestClaim?: ReturnType<typeof vi.fn>
  resendFromName?: string
  send: ReturnType<typeof vi.fn>
}) {
  return {
    digests,
    dryRun: false,
    claimId: "claim_1",
    resend: {
      emails: {
        send,
      },
    },
    resendFromEmail: "noreply@example.com",
    resendFromName,
    markNotificationsEmailed,
    releaseNotificationDigestClaim,
  }
}

function createDigestWorkerMocks() {
  return {
    markNotificationsEmailedMock: vi.fn(),
    releaseNotificationDigestClaimMock: vi.fn().mockResolvedValue(undefined),
  }
}

describe("send-notification-digests worker", () => {
  it("runs main in dry-run mode using the shared Convex/Resend config", async () => {
    const client = {
      mutation: vi.fn(),
      query: vi.fn().mockResolvedValue([createDigest("1")]),
    }
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const previousDryRun = process.env.DRY_RUN

    vi.resetModules()
    vi.doMock("../../scripts/shared/convex-resend.mjs", () => ({
      readConvexResendConfig: () => ({
        client,
        resend: {
          emails: {
            send: vi.fn(),
          },
        },
        resendFromEmail: "noreply@example.com",
        resendFromName: "Recipe Room",
        serverToken: "server_token",
      }),
    }))
    process.env.DRY_RUN = "1"

    try {
      const { api } = await import("../../convex/_generated/api.js")
      const { main } = await import("../../scripts/send-notification-digests.mjs")

      await main()

      expect(client.query).toHaveBeenCalledWith(
        api.app.listPendingNotificationDigests,
        {
          serverToken: "server_token",
        }
      )
      expect(client.mutation).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "prepared 1 digest notification email entry"
      )
    } finally {
      if (previousDryRun === undefined) {
        delete process.env.DRY_RUN
      } else {
        process.env.DRY_RUN = previousDryRun
      }
      consoleLogSpy.mockRestore()
      vi.doUnmock("../../scripts/shared/convex-resend.mjs")
      vi.resetModules()
    }
  })

  it("releases the current and remaining claimed digests when send fails", async () => {
    const { processNotificationDigestsBatch } = await import(
      "../../scripts/send-notification-digests.mjs"
    )

    const sendMock = vi.fn().mockRejectedValue(new Error("SMTP timeout"))
    const { markNotificationsEmailedMock, releaseNotificationDigestClaimMock } =
      createDigestWorkerMocks()

    await expect(
      processNotificationDigestsBatch(
        createDigestBatchInput({
          send: sendMock,
          markNotificationsEmailed: markNotificationsEmailedMock,
          releaseNotificationDigestClaim: releaseNotificationDigestClaimMock,
        })
      )
    ).rejects.toThrow("SMTP timeout")

    expect(markNotificationsEmailedMock).not.toHaveBeenCalled()
    expect(releaseNotificationDigestClaimMock).toHaveBeenCalledWith({
      claimId: "claim_1",
      notificationIds: ["notification_1", "notification_2"],
    })
  })

  it("keeps the current digest claimed when send succeeded but recording fails", async () => {
    const { processNotificationDigestsBatch } = await import(
      "../../scripts/send-notification-digests.mjs"
    )

    const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_1" } })
    const markNotificationsEmailedMock = vi
      .fn()
      .mockRejectedValue(new Error("Convex unavailable"))
    const { releaseNotificationDigestClaimMock } = createDigestWorkerMocks()

    await expect(
      processNotificationDigestsBatch(
        createDigestBatchInput({
          send: sendMock,
          markNotificationsEmailed: markNotificationsEmailedMock,
          releaseNotificationDigestClaim: releaseNotificationDigestClaimMock,
        })
      )
    ).rejects.toThrow("Convex unavailable")

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
      }),
      expect.any(Object)
    )
    expect(releaseNotificationDigestClaimMock).toHaveBeenCalledWith({
      claimId: "claim_1",
      notificationIds: ["notification_2"],
    })
  })

  it("retries claim release cleanup and preserves the original send failure", async () => {
    const { processNotificationDigestsBatch } = await import(
      "../../scripts/send-notification-digests.mjs"
    )

    const sendMock = vi.fn().mockRejectedValue(new Error("SMTP timeout"))
    const markNotificationsEmailedMock = vi.fn()
    const releaseNotificationDigestClaimMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Convex unavailable"))
      .mockRejectedValueOnce(new Error("Convex unavailable"))
      .mockResolvedValue(undefined)

    await expect(
      processNotificationDigestsBatch(
        createDigestBatchInput({
          digests: [createDigest("1")],
          send: sendMock,
          markNotificationsEmailed: markNotificationsEmailedMock,
          releaseNotificationDigestClaim: releaseNotificationDigestClaimMock,
        })
      )
    ).rejects.toThrow("SMTP timeout")

    expect(releaseNotificationDigestClaimMock).toHaveBeenCalledTimes(3)
    expect(releaseNotificationDigestClaimMock).toHaveBeenCalledWith({
      claimId: "claim_1",
      notificationIds: ["notification_1"],
    })
  })

  it("formats digest sends with an optional display name", async () => {
    const { processNotificationDigestsBatch } = await import(
      "../../scripts/send-notification-digests.mjs"
    )

    const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_1" } })

    await processNotificationDigestsBatch(
      createDigestBatchInput({
        digests: [createDigest("1")],
        send: sendMock,
        markNotificationsEmailed: vi.fn().mockResolvedValue(undefined),
        releaseNotificationDigestClaim: vi.fn().mockResolvedValue(undefined),
        resendFromName: "Recipe Room",
      })
    )

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Recipe Room <noreply@example.com>",
      }),
      expect.any(Object)
    )
  })
})
