import { ConvexHttpClient } from "convex/browser"
import { Resend } from "resend"

import { api } from "../convex/_generated/api.js"

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
const serverToken = process.env.CONVEX_SERVER_TOKEN
const resendApiKey = process.env.RESEND_API_KEY
const resendFromEmail = process.env.RESEND_FROM_EMAIL
const origin =
  process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const dryRun = process.env.DRY_RUN === "1"

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

function escapeHtml(input) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function toEntityPath(entityType, entityId) {
  if (entityType === "document") {
    return `/docs/${entityId}`
  }

  if (entityType === "workItem") {
    return `/items/${entityId}`
  }

  return "/inbox"
}

const digests =
  (await client.query(api.app.listPendingNotificationDigests, {
    serverToken,
  })) ?? []
const emailedNotificationIds = []

for (const digest of digests) {
  const topNotifications = digest.notifications.slice(0, 8)
  const listItems = topNotifications
    .map(
      (notification) =>
        `<li><a href="${origin}${toEntityPath(notification.entityType, notification.entityId)}">${escapeHtml(notification.message)}</a></li>`
    )
    .join("")

  if (!dryRun) {
    await resend.emails.send({
      from: resendFromEmail,
      to: digest.user.email,
      subject: `You have ${digest.notifications.length} unread notifications`,
      text: [
        `Hi ${digest.user.name},`,
        "",
        `You have ${digest.notifications.length} unread notifications waiting in your inbox.`,
        `${origin}/inbox`,
      ].join("\n"),
      html: [
        `<p>Hi ${escapeHtml(digest.user.name)},</p>`,
        `<p>You have <strong>${digest.notifications.length}</strong> unread notifications waiting in your inbox.</p>`,
        `<ul>${listItems}</ul>`,
        `<p><a href="${origin}/inbox">Open inbox</a></p>`,
      ].join(""),
    })

    await client.mutation(api.app.markNotificationsEmailed, {
      serverToken,
      notificationIds: digest.notifications.map((notification) => notification.id),
    })
  }

  emailedNotificationIds.push(...digest.notifications.map((notification) => notification.id))
}

console.log(
  `${dryRun ? "prepared" : "sent"} ${emailedNotificationIds.length} digest notification email entr${emailedNotificationIds.length === 1 ? "y" : "ies"}`
)
