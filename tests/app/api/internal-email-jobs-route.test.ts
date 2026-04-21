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
    mutationMock
      .mockResolvedValueOnce([
        {
          id: "email_job_1",
          toEmail: "alex@example.com",
          subject: "Mention",
          text: "Hello",
          html: "<p>Hello</p>",
        },
      ])
      .mockResolvedValueOnce({ ok: true })

    const { GET } = await import("@/app/api/internal/email-jobs/route")
    const response = await GET(
      new NextRequest("http://localhost/api/internal/email-jobs", {
        headers: {
          authorization: "Bearer cron_secret",
        },
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
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
    const { GET } = await import("@/app/api/internal/email-jobs/route")
    const response = await GET(
      new NextRequest("http://localhost/api/internal/email-jobs")
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    })
  })
})
