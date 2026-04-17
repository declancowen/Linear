import { randomUUID } from "node:crypto"

import { ConvexHttpClient } from "convex/browser"
import { Resend } from "resend"

import { api } from "../convex/_generated/api.js"

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
const serverToken = process.env.CONVEX_SERVER_TOKEN
const resendApiKey = process.env.RESEND_API_KEY
const resendFromEmail = process.env.RESEND_FROM_EMAIL
const claimId = randomUUID()

if (!convexUrl) {
  throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")
}

if (!serverToken) {
  throw new Error("CONVEX_SERVER_TOKEN is not configured")
}

if (!resendApiKey || !resendFromEmail) {
  throw new Error("Resend is not configured")
}

const client = new ConvexHttpClient(convexUrl)
const resend = new Resend(resendApiKey)

const jobs =
  (await client.mutation(api.app.claimPendingEmailJobs, {
    serverToken,
    claimId,
  })) ?? []

let sentCount = 0
let failedCount = 0

for (const job of jobs) {
  try {
    await resend.emails.send({
      from: resendFromEmail,
      to: job.toEmail,
      subject: job.subject,
      text: job.text,
      html: job.html,
    })

    await client.mutation(api.app.markEmailJobsSent, {
      serverToken,
      claimId,
      jobIds: [job.id],
    })
    sentCount += 1
  } catch (error) {
    await client.mutation(api.app.releaseEmailJobClaim, {
      serverToken,
      claimId,
      jobIds: [job.id],
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    failedCount += 1
  }
}

console.log(`processed ${jobs.length} email jobs (${sentCount} sent, ${failedCount} failed)`)
