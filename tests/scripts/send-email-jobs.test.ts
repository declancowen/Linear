import { describe, expect, it, vi } from "vitest"

type EmailJobBatchResult = {
  failedCount: number
  processedCount: number
  sentCount: number
}

type ProcessTestEmailJobsBatchOptions = {
  markEmailJobsSentMock?: ReturnType<typeof vi.fn>
  releaseEmailJobClaimMock?: ReturnType<typeof vi.fn>
  resendFromEmail?: string
  resendFromName?: string | undefined
  sendMock?: ReturnType<typeof vi.fn>
}

function createEmailJob() {
  return {
    id: "job_1",
    kind: "mention",
    notificationId: "notification_1",
    toEmail: "alex@example.com",
    subject: "Mention",
    text: "text",
    html: "<p>text</p>",
  }
}

async function processTestEmailJobsBatch({
  sendMock = vi.fn().mockResolvedValue({ data: { id: "email_1" } }),
  markEmailJobsSentMock = vi.fn().mockResolvedValue(undefined),
  releaseEmailJobClaimMock = vi.fn().mockResolvedValue(undefined),
  resendFromEmail = "noreply@example.com",
  resendFromName = undefined,
}: ProcessTestEmailJobsBatchOptions = {}) {
  const { processEmailJobsBatch } = await import(
    "../../scripts/send-email-jobs.mjs"
  )

  const result = await processEmailJobsBatch({
    jobs: [createEmailJob()],
    claimId: "claim_1",
    resend: {
      emails: {
        send: sendMock,
      },
    },
    resendFromEmail,
    resendFromName,
    markEmailJobsSent: markEmailJobsSentMock,
    releaseEmailJobClaim: releaseEmailJobClaimMock,
  })

  return {
    markEmailJobsSentMock,
    releaseEmailJobClaimMock,
    result,
    sendMock,
  }
}

function expectSingleJobClaimReleased(
  releaseEmailJobClaimMock: ReturnType<typeof vi.fn>,
  errorMessage: string
) {
  expect(releaseEmailJobClaimMock).toHaveBeenCalledWith({
    claimId: "claim_1",
    jobIds: ["job_1"],
    errorMessage,
  })
}

function expectSingleJobFailure(result: EmailJobBatchResult) {
  expect(result).toEqual({
    processedCount: 1,
    sentCount: 0,
    failedCount: 1,
  })
}

function expectSingleEmailSentFrom(
  sendMock: ReturnType<typeof vi.fn>,
  from: string
) {
  expect(sendMock).toHaveBeenCalledWith(
    expect.objectContaining({
      from,
    }),
    {
      idempotencyKey: "job_1",
    }
  )
}

describe("send-email-jobs worker", () => {
  it("releases the claim when provider delivery fails", async () => {
    const sendMock = vi.fn().mockRejectedValue(new Error("SMTP timeout"))
    const markEmailJobsSentMock = vi.fn()
    const { releaseEmailJobClaimMock, result } =
      await processTestEmailJobsBatch({
        sendMock,
        markEmailJobsSentMock,
      })

    expect(markEmailJobsSentMock).not.toHaveBeenCalled()
    expectSingleJobClaimReleased(releaseEmailJobClaimMock, "SMTP timeout")
    expectSingleJobFailure(result)
  })

  it("uses a stable provider idempotency key and releases the claim on ack failure", async () => {
    const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_1" } })
    const markEmailJobsSentMock = vi
      .fn()
      .mockRejectedValue(new Error("Convex unavailable"))
    const { releaseEmailJobClaimMock, result } =
      await processTestEmailJobsBatch({
        sendMock,
        markEmailJobsSentMock,
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
    expectSingleJobClaimReleased(releaseEmailJobClaimMock, "Convex unavailable")
    expectSingleJobFailure(result)
  })

  it("releases the claim when Resend returns an API error response", async () => {
    const { releaseEmailJobClaimMock, result } =
      await processTestEmailJobsBatch({
        sendMock: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: "domain not verified",
          },
        }),
      })

    expectSingleJobClaimReleased(releaseEmailJobClaimMock, "domain not verified")
    expectSingleJobFailure(result)
  })

  it("preserves an explicit formatted sender", async () => {
    const { sendMock } = await processTestEmailJobsBatch({
      resendFromEmail: "Recipe Room <noreply@example.com>",
      resendFromName: "Ignored",
    })

    expectSingleEmailSentFrom(sendMock, "Recipe Room <noreply@example.com>")
  })

  it("formats the sender with an optional display name", async () => {
    const { sendMock } = await processTestEmailJobsBatch({
      resendFromName: "Recipe Room",
    })

    expectSingleEmailSentFrom(sendMock, "Recipe Room <noreply@example.com>")
  })
})
