import { toErrorMessage } from "@/lib/email/errors"

export type ReleaseEmailJobClaim = (payload: {
  claimId: string
  jobIds: string[]
  errorMessage?: string
}) => Promise<
  | Array<{
      jobId: string
      retryBackoffMs: number
    }>
  | null
  | undefined
  | unknown
>

export async function releaseEmailJobClaimSafely(input: {
  claimId: string
  jobId: string
  errorMessage: string
  context: "send" | "mark_sent"
  releaseEmailJobClaim: ReleaseEmailJobClaim
}) {
  try {
    const result = await input.releaseEmailJobClaim({
      claimId: input.claimId,
      jobIds: [input.jobId],
      errorMessage: input.errorMessage,
    })
    const releasedClaim = Array.isArray(result)
      ? result.find(
          (entry) =>
            typeof entry === "object" &&
            entry !== null &&
            "jobId" in entry &&
            entry.jobId === input.jobId &&
            "retryBackoffMs" in entry &&
            typeof entry.retryBackoffMs === "number"
        )
      : null

    return releasedClaim?.retryBackoffMs ?? null
  } catch (error) {
    console.error("Failed to release queued email job claim", {
      claimId: input.claimId,
      jobId: input.jobId,
      context: input.context,
      error: toErrorMessage(error),
    })
    return null
  }
}
