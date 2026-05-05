import { describe, expect, it, vi } from "vitest"

import { releaseEmailJobClaimSafely } from "@/lib/email/queued-email-claim-release"

describe("queued email worker claim release", () => {
  it("returns the retry delay for the released job claim", async () => {
    const releaseEmailJobClaim = vi.fn().mockResolvedValue([
      {
        jobId: "job_other",
        retryBackoffMs: 5000,
      },
      {
        jobId: "job_1",
        retryBackoffMs: 1500,
      },
    ])

    await expect(
      releaseEmailJobClaimSafely({
        claimId: "claim_1",
        jobId: "job_1",
        errorMessage: "SMTP timeout",
        context: "send",
        releaseEmailJobClaim,
      })
    ).resolves.toBe(1500)
    expect(releaseEmailJobClaim).toHaveBeenCalledWith({
      claimId: "claim_1",
      jobIds: ["job_1"],
      errorMessage: "SMTP timeout",
    })
  })

  it("logs and ignores malformed or failed release responses", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)

    await expect(
      releaseEmailJobClaimSafely({
        claimId: "claim_1",
        jobId: "job_1",
        errorMessage: "SMTP timeout",
        context: "mark_sent",
        releaseEmailJobClaim: vi.fn().mockResolvedValue([
          {
            jobId: "job_1",
            retryBackoffMs: "soon",
          },
        ]),
      })
    ).resolves.toBeNull()
    await expect(
      releaseEmailJobClaimSafely({
        claimId: "claim_2",
        jobId: "job_2",
        errorMessage: "API failure",
        context: "send",
        releaseEmailJobClaim: vi
          .fn()
          .mockRejectedValue(new Error("Convex unavailable")),
      })
    ).resolves.toBeNull()

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to release queued email job claim",
      expect.objectContaining({
        claimId: "claim_2",
        jobId: "job_2",
        context: "send",
        error: "Convex unavailable",
      })
    )
    consoleSpy.mockRestore()
  })
})
