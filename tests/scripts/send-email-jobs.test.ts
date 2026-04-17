import { describe, expect, it, vi } from "vitest"

describe("send-email-jobs worker", () => {
  it("uses a stable provider idempotency key and releases the claim on ack failure", async () => {
    const { processEmailJobsBatch } = await import(
      "../../scripts/send-email-jobs.mjs"
    )

    const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_1" } })
    const markEmailJobsSentMock = vi
      .fn()
      .mockRejectedValue(new Error("Convex unavailable"))
    const releaseEmailJobClaimMock = vi.fn().mockResolvedValue(undefined)

    const result = await processEmailJobsBatch({
      jobs: [
        {
          id: "job_1",
          kind: "mention",
          notificationId: "notification_1",
          toEmail: "alex@example.com",
          subject: "Mention",
          text: "text",
          html: "<p>text</p>",
        },
      ],
      claimId: "claim_1",
      resend: {
        emails: {
          send: sendMock,
        },
      },
      resendFromEmail: "noreply@example.com",
      markEmailJobsSent: markEmailJobsSentMock,
      releaseEmailJobClaim: releaseEmailJobClaimMock,
    })

    expect(sendMock).toHaveBeenCalledWith(
      {
        from: "noreply@example.com",
        to: "alex@example.com",
        subject: "Mention",
        text: "text",
        html: "<p>text</p>",
      },
      {
        idempotencyKey: "job_1",
      }
    )
    expect(markEmailJobsSentMock).toHaveBeenCalledWith({
      claimId: "claim_1",
      jobIds: ["job_1"],
    })
    expect(releaseEmailJobClaimMock).toHaveBeenCalledWith({
      claimId: "claim_1",
      jobIds: ["job_1"],
      errorMessage:
        "Delivered email but failed to record sent state: Convex unavailable",
    })
    expect(result).toEqual({
      processedCount: 1,
      sentCount: 0,
      failedCount: 1,
    })
  })
})
