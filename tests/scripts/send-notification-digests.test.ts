import { describe, expect, it, vi } from "vitest"

describe("send-notification-digests worker", () => {
  it("releases the current and remaining claimed digests when send fails", async () => {
    const { processNotificationDigestsBatch } = await import(
      "../../scripts/send-notification-digests.mjs"
    )

    const sendMock = vi.fn().mockRejectedValue(new Error("SMTP timeout"))
    const markNotificationsEmailedMock = vi.fn()
    const releaseNotificationDigestClaimMock = vi.fn().mockResolvedValue(undefined)

    await expect(
      processNotificationDigestsBatch({
        digests: [
          {
            user: {
              id: "user_1",
              email: "alex@example.com",
              name: "Alex",
            },
            notifications: [
              {
                id: "notification_1",
                entityType: "workItem",
                entityId: "item_1",
                message: "One",
                createdAt: "2026-04-17T10:00:00.000Z",
              },
            ],
          },
          {
            user: {
              id: "user_2",
              email: "jamie@example.com",
              name: "Jamie",
            },
            notifications: [
              {
                id: "notification_2",
                entityType: "chat",
                entityId: "chat_1",
                message: "Two",
                createdAt: "2026-04-17T10:05:00.000Z",
              },
            ],
          },
        ],
        dryRun: false,
        claimId: "claim_1",
        resend: {
          emails: {
            send: sendMock,
          },
        },
        resendFromEmail: "noreply@example.com",
        markNotificationsEmailed: markNotificationsEmailedMock,
        releaseNotificationDigestClaim: releaseNotificationDigestClaimMock,
      })
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
    const releaseNotificationDigestClaimMock = vi.fn().mockResolvedValue(undefined)

    await expect(
      processNotificationDigestsBatch({
        digests: [
          {
            user: {
              id: "user_1",
              email: "alex@example.com",
              name: "Alex",
            },
            notifications: [
              {
                id: "notification_1",
                entityType: "workItem",
                entityId: "item_1",
                message: "One",
                createdAt: "2026-04-17T10:00:00.000Z",
              },
            ],
          },
          {
            user: {
              id: "user_2",
              email: "jamie@example.com",
              name: "Jamie",
            },
            notifications: [
              {
                id: "notification_2",
                entityType: "chat",
                entityId: "chat_1",
                message: "Two",
                createdAt: "2026-04-17T10:05:00.000Z",
              },
            ],
          },
        ],
        dryRun: false,
        claimId: "claim_1",
        resend: {
          emails: {
            send: sendMock,
          },
        },
        resendFromEmail: "noreply@example.com",
        markNotificationsEmailed: markNotificationsEmailedMock,
        releaseNotificationDigestClaim: releaseNotificationDigestClaimMock,
      })
    ).rejects.toThrow("Convex unavailable")

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com <noreply@example.com>",
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
      processNotificationDigestsBatch({
        digests: [
          {
            user: {
              id: "user_1",
              email: "alex@example.com",
              name: "Alex",
            },
            notifications: [
              {
                id: "notification_1",
                entityType: "workItem",
                entityId: "item_1",
                message: "One",
                createdAt: "2026-04-17T10:00:00.000Z",
              },
            ],
          },
        ],
        dryRun: false,
        claimId: "claim_1",
        resend: {
          emails: {
            send: sendMock,
          },
        },
        resendFromEmail: "noreply@example.com",
        markNotificationsEmailed: markNotificationsEmailedMock,
        releaseNotificationDigestClaim: releaseNotificationDigestClaimMock,
      })
    ).rejects.toThrow("SMTP timeout")

    expect(releaseNotificationDigestClaimMock).toHaveBeenCalledTimes(3)
    expect(releaseNotificationDigestClaimMock).toHaveBeenCalledWith({
      claimId: "claim_1",
      notificationIds: ["notification_1"],
    })
  })
})
