import { describe, expect, it, vi } from "vitest"

describe("send-email-jobs worker", () => {
  it("releases the claim when provider delivery fails", async () => {
    const { processEmailJobsBatch } = await import(
      "../../scripts/send-email-jobs.mjs"
    )

    const sendMock = vi.fn().mockRejectedValue(new Error("SMTP timeout"))
    const markEmailJobsSentMock = vi.fn()
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

    expect(markEmailJobsSentMock).not.toHaveBeenCalled()
    expect(releaseEmailJobClaimMock).toHaveBeenCalledWith({
      claimId: "claim_1",
      jobIds: ["job_1"],
      errorMessage: "SMTP timeout",
    })
    expect(result).toEqual({
      processedCount: 1,
      sentCount: 0,
      failedCount: 1,
    })
  })

  it("uses a stable provider idempotency key and keeps the claim on ack failure", async () => {
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
    expect(releaseEmailJobClaimMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      processedCount: 1,
      sentCount: 0,
      failedCount: 1,
    })
  })
})
