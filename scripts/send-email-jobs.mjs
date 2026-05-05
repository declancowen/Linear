import { randomUUID } from "node:crypto"
import { pathToFileURL } from "node:url"

import { api } from "../convex/_generated/api.js"
import { normalizeResendFrom } from "./resend-from.mjs"
import { readConvexResendConfig } from "./shared/convex-resend.mjs"

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

async function releaseEmailJobClaimSafely(input) {
  try {
    await input.releaseEmailJobClaim({
      claimId: input.claimId,
      jobIds: [input.jobId],
      errorMessage: input.errorMessage,
    })
  } catch (error) {
    console.error("Failed to release queued email job claim", {
      claimId: input.claimId,
      jobId: input.jobId,
      error: toErrorMessage(error),
    })
  }
}

export async function processEmailJobsBatch(input) {
  let sentCount = 0
  let failedCount = 0
  const resendFrom = normalizeResendFrom(
    input.resendFromEmail,
    input.resendFromName
  )

  for (const job of input.jobs) {
    let sendResult

    try {
      sendResult = await input.resend.emails.send(
        {
          from: resendFrom,
          to: job.toEmail,
          subject: job.subject,
          text: job.text,
          html: job.html,
        },
        {
          idempotencyKey: job.id,
        }
      )
    } catch (error) {
      await releaseEmailJobClaimSafely({
        claimId: input.claimId,
        jobId: job.id,
        errorMessage: toErrorMessage(error),
        releaseEmailJobClaim: input.releaseEmailJobClaim,
      })
      failedCount += 1
      continue
    }

    if (sendResult.error) {
      await releaseEmailJobClaimSafely({
        claimId: input.claimId,
        jobId: job.id,
        errorMessage: sendResult.error.message,
        releaseEmailJobClaim: input.releaseEmailJobClaim,
      })
      failedCount += 1
      continue
    }

    try {
      await input.markEmailJobsSent({
        claimId: input.claimId,
        jobIds: [job.id],
      })
      sentCount += 1
    } catch (error) {
      await releaseEmailJobClaimSafely({
        claimId: input.claimId,
        jobId: job.id,
        errorMessage: toErrorMessage(error),
        releaseEmailJobClaim: input.releaseEmailJobClaim,
      })
      failedCount += 1
    }
  }

  return {
    processedCount: input.jobs.length,
    sentCount,
    failedCount,
  }
}

export async function main() {
  const {
    client,
    resend,
    resendFromEmail,
    resendFromName,
    serverToken,
  } = readConvexResendConfig()
  const claimId = randomUUID()
  const jobs =
    (await client.mutation(api.app.claimPendingEmailJobs, {
      serverToken,
      claimId,
    })) ?? []

  const result = await processEmailJobsBatch({
    jobs,
    claimId,
    resend,
    resendFromEmail,
    resendFromName,
    markEmailJobsSent: (payload) =>
      client.mutation(api.app.markEmailJobsSent, {
        serverToken,
        ...payload,
      }),
    releaseEmailJobClaim: (payload) =>
      client.mutation(api.app.releaseEmailJobClaim, {
        serverToken,
        ...payload,
      }),
  })

  console.log(
    `processed ${result.processedCount} email jobs (${result.sentCount} sent, ${result.failedCount} failed)`
  )

  if (result.failedCount > 0) {
    process.exitCode = 1
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  await main()
}
