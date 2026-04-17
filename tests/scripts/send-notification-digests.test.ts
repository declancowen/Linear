import { describe, expect, it, vi } from "vitest"

describe("send-notification-digests worker", () => {
  it("releases the current and remaining claimed digests before aborting", async () => {
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
})
