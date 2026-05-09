import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mutationMock = vi.fn()
const sendMock = vi.fn()

vi.mock("@/lib/server/convex/core", () => ({
  getConvexServerClient: () => ({
    mutation: mutationMock,
  }),
  withServerToken: <T extends Record<string, unknown>>(input: T) => ({
    ...input,
    serverToken: "server_token",
  }),
}))

vi.mock("resend", () => ({
  Resend: vi.fn(
    class {
      emails = {
        send: sendMock,
      }
    }
  ),
}))

function createEmailJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "email_job_1",
    toEmail: "alex@example.com",
    subject: "Mention",
    text: "Hello",
    html: "<p>Hello</p>",
    ...overrides,
  }
}

function mockResendSuccess(providerId = "provider_1") {
  sendMock.mockResolvedValueOnce({
    data: {
      id: providerId,
    },
    error: null,
    headers: null,
  })
}

function createEmailJobsRequest(authenticated = true) {
  return new NextRequest("http://localhost/api/internal/email-jobs", {
    headers: authenticated
      ? {
          authorization: "Bearer cron_secret",
        }
      : undefined,
  })
}

async function runEmailJobsRoute(authenticated = true) {
  const { GET } = await import("@/app/api/internal/email-jobs/route")
  return GET(createEmailJobsRequest(authenticated))
}

async function expectEmailJobsRouteSummary(
  response: Response,
  summary: {
    processedCount: number
    sentCount: number
    failedCount: number
  }
) {
  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    ...summary,
  })
}

function expectReleasedEmailJobClaim(callIndex: number, errorMessage: string) {
  expect(mutationMock.mock.calls[callIndex]?.[1]).toMatchObject({
    claimId: expect.any(String),
    jobIds: ["email_job_1"],
    errorMessage,
  })
}

describe("GET /api/internal/email-jobs", () => {
  beforeEach(() => {
    mutationMock.mockReset()
    sendMock.mockReset()
    process.env.CRON_SECRET = "cron_secret"
    process.env.RESEND_API_KEY = "re_test"
    process.env.RESEND_FROM_EMAIL = "noreply@example.com"
    delete process.env.RESEND_FROM_NAME
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM_EMAIL
    delete process.env.RESEND_FROM_NAME
  })

  it("claims queued jobs, sends them, and marks them as sent", async () => {
    mockResendSuccess()
    mutationMock
      .mockResolvedValueOnce([createEmailJob()])
      .mockResolvedValueOnce({ ok: true })

    const response = await runEmailJobsRoute()

    await expectEmailJobsRouteSummary(response, {
      processedCount: 1,
      sentCount: 1,
      failedCount: 0,
    })
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        to: "alex@example.com",
        subject: "Mention",
      }),
      {
        idempotencyKey: "email_job_1",
      }
    )
    expect(mutationMock).toHaveBeenCalledTimes(2)
  })

  it("rejects requests without the cron bearer token", async () => {
    const response = await runEmailJobsRoute(false)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    })
  })

  it("releases the claim when Resend returns an API error response", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: "domain not verified",
        statusCode: 403,
        name: "invalid_from_address",
      },
      headers: null,
    })
    mutationMock
      .mockResolvedValueOnce([createEmailJob()])
      .mockResolvedValueOnce({ ok: true })

    const response = await runEmailJobsRoute()

    await expectEmailJobsRouteSummary(response, {
      processedCount: 1,
      sentCount: 0,
      failedCount: 1,
    })
    expect(mutationMock).toHaveBeenCalledTimes(2)
    expectReleasedEmailJobClaim(1, "domain not verified")
  })

  it("releases the claim when marking a delivered job as sent fails", async () => {
    mockResendSuccess()
    mutationMock
      .mockResolvedValueOnce([createEmailJob()])
      .mockRejectedValueOnce(new Error("mark failed"))
      .mockResolvedValueOnce({ ok: true })

    const response = await runEmailJobsRoute()

    await expectEmailJobsRouteSummary(response, {
      processedCount: 1,
      sentCount: 0,
      failedCount: 1,
    })
    expect(mutationMock).toHaveBeenCalledTimes(3)
    expectReleasedEmailJobClaim(2, "mark failed")
  })

  it("continues the batch when claim release fails after a send error", async () => {
    sendMock.mockRejectedValueOnce(new Error("send failed"))
    mockResendSuccess("provider_2")
    mutationMock
      .mockResolvedValueOnce([
        createEmailJob(),
        createEmailJob({
          id: "email_job_2",
          toEmail: "sam@example.com",
          subject: "Invite",
          text: "Hi",
          html: "<p>Hi</p>",
        }),
      ])
      .mockRejectedValueOnce(new Error("release failed"))
      .mockResolvedValueOnce({ ok: true })

    const response = await runEmailJobsRoute()

    await expectEmailJobsRouteSummary(response, {
      processedCount: 2,
      sentCount: 1,
      failedCount: 1,
    })
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(mutationMock).toHaveBeenCalledTimes(3)
    expect(mutationMock.mock.calls[2]?.[1]).toMatchObject({
      claimId: expect.any(String),
      jobIds: ["email_job_2"],
    })
  })

  it("redacts missing configuration details from responses", async () => {
    delete process.env.CRON_SECRET

    const response = await runEmailJobsRoute(false)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Service unavailable",
    })
  })
})
