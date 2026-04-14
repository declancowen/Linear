import { ConvexHttpClient } from "convex/browser"

import { api } from "../convex/_generated/api.js"

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
const serverToken = process.env.CONVEX_SERVER_TOKEN

if (!convexUrl) {
  throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")
}

if (!serverToken) {
  throw new Error("CONVEX_SERVER_TOKEN is not configured")
}

const convex = new ConvexHttpClient(convexUrl)

const result = await convex.mutation(api.app.backfillWorkItemModel, {
  serverToken,
})

console.log(JSON.stringify(result, null, 2))
