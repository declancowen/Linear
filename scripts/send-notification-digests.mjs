import { randomUUID } from "node:crypto"

import { ConvexHttpClient } from "convex/browser"
import { Resend } from "resend"

import { api } from "../convex/_generated/api.js"

const APP_NAME = "Recipe Room"
const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const EMAIL_COLORS = {
  text: "#111111",
  secondary: "#52525b",
  muted: "#71717a",
  cardBackground: "#ffffff",
  detailBackground: "#fafafa",
  border: "#e4e4e7",
}

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

function formatTimestamp(input) {
  const date = new Date(input)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function buildAbsoluteUrl(path) {
  return new URL(path, origin).toString()
}

function getNotificationPath(entityType, entityId) {
  if (entityType === "document") {
    return `/docs/${entityId}`
  }

  if (entityType === "workItem") {
    return `/items/${entityId}`
  }

  if (entityType === "chat") {
    return `/chats?chatId=${entityId}`
  }

  return "/inbox"
}

function renderEmailButton(input) {
  return [
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0">',
    "<tr>",
    '<td align="center" bgcolor="#111111" style="border: 1px solid #111111; border-radius: 12px;">',
    `<a href="${input.href}" style="display: inline-block; padding: 12px 18px; font-family: ${EMAIL_FONT_STACK}; font-size: 14px; font-weight: 600; line-height: 1; color: #ffffff; text-decoration: none; border-radius: 12px;">${escapeHtml(input.label)}</a>`,
    "</td>",
    "</tr>",
    "</table>",
  ].join("")
}

function renderEmailLayout(input) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    '<body style="margin: 0; padding: 24px; background-color: #f5f5f5;">',
    '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">',
    "<tr>",
    '<td align="center">',
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: ${EMAIL_COLORS.cardBackground}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 20px; overflow: hidden;">`,
    "<tr>",
    '<td style="padding: 28px 28px 12px;">',
    `<img src="${input.logoUrl}" alt="${APP_NAME}" width="32" height="32" style="display: block; width: 32px; height: 32px; border-radius: 8px;" />`,
    `<div style="margin-top: 12px; font-family: ${EMAIL_FONT_STACK}; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${EMAIL_COLORS.muted};">${escapeHtml(input.eyebrow)}</div>`,
    "</td>",
    "</tr>",
    "<tr>",
    `<td style="padding: 0 28px;">${input.content}</td>`,
    "</tr>",
    "<tr>",
    `<td style="padding: 20px 28px 28px; border-top: 1px solid ${EMAIL_COLORS.border};">`,
    `<p style="margin: 0; font-family: ${EMAIL_FONT_STACK}; font-size: 13px; line-height: 1.5; color: ${EMAIL_COLORS.muted};">${APP_NAME} · <a href="${buildAbsoluteUrl("/settings/profile")}" style="color: ${EMAIL_COLORS.text}; text-decoration: underline;">Email settings</a></p>`,
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("")
}

function renderFallbackLinks(links) {
  return [
    `<p style="margin: 16px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 13px; line-height: 1.5; color: ${EMAIL_COLORS.muted};">If the button above does not open, use this link directly:<br />`,
    links
      .map(
        (link) =>
          `<a href="${link.href}" style="color: ${EMAIL_COLORS.text}; text-decoration: underline;">${escapeHtml(link.label)}</a>`
      )
      .join("<br />"),
    "</p>",
  ].join("")
}

function renderNotificationDigestEmail(input) {
  const topNotifications = input.notifications.slice(0, 8)
  const remainingCount = Math.max(input.notifications.length - topNotifications.length, 0)
  const inboxUrl = buildAbsoluteUrl("/inbox")
  const rows = topNotifications
    .map((notification, index) => {
      const notificationUrl = buildAbsoluteUrl(
        getNotificationPath(notification.entityType, notification.entityId)
      )
      const timestamp = formatTimestamp(notification.createdAt)

      return [
        "<tr>",
        `<td style="padding: 16px 18px;${index < topNotifications.length - 1 ? ` border-bottom: 1px solid ${EMAIL_COLORS.border};` : ""}">`,
        `<a href="${notificationUrl}" style="display: block; font-family: ${EMAIL_FONT_STACK}; font-size: 14px; line-height: 1.6; color: ${EMAIL_COLORS.text}; text-decoration: none;">${escapeHtml(notification.message)}</a>`,
        timestamp
          ? `<div style="margin-top: 4px; font-family: ${EMAIL_FONT_STACK}; font-size: 13px; line-height: 1.5; color: ${EMAIL_COLORS.muted};">${escapeHtml(timestamp)}</div>`
          : "",
        "</td>",
        "</tr>",
      ].join("")
    })
    .join("")

  const html = renderEmailLayout({
    logoUrl: buildAbsoluteUrl("/app-icon.png"),
    eyebrow: "DIGEST",
    content: [
      `<h1 style="margin: 0; font-family: ${EMAIL_FONT_STACK}; font-size: 22px; line-height: 1.2; font-weight: 700; color: ${EMAIL_COLORS.text};">You have ${input.notifications.length} unread notifications</h1>`,
      `<p style="margin: 12px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${EMAIL_COLORS.secondary};">Here’s a summary of what you missed.</p>`,
      '<div style="margin-top: 24px;">',
      `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${EMAIL_COLORS.detailBackground}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 16px;">`,
      rows,
      "</table>",
      "</div>",
      remainingCount
        ? `<p style="margin: 12px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 13px; line-height: 1.5; color: ${EMAIL_COLORS.muted};">and ${remainingCount} more in your inbox</p>`
        : "",
      `<div style="margin-top: 20px;">${renderEmailButton({
        href: inboxUrl,
        label: "Open Inbox",
      })}</div>`,
      renderFallbackLinks([
        {
          href: inboxUrl,
          label: "Open inbox",
        },
      ]),
    ].join(""),
  })

  const numberedNotifications = topNotifications.map((notification, index) => {
    const notificationUrl = buildAbsoluteUrl(
      getNotificationPath(notification.entityType, notification.entityId)
    )
    const timestamp = formatTimestamp(notification.createdAt)

    return [
      `${index + 1}. ${notification.message}`,
      timestamp ? `   ${timestamp}` : null,
      `   ${notificationUrl}`,
    ]
      .filter(Boolean)
      .join("\n")
  })

  return {
    subject: `You have ${input.notifications.length} unread notifications`,
    text: [
      `Hi ${input.userName},`,
      "",
      `You have ${input.notifications.length} unread notifications in ${APP_NAME}.`,
      "",
      ...numberedNotifications,
      ...(remainingCount ? ["", `And ${remainingCount} more in your inbox.`] : []),
      "",
      `Open inbox: ${inboxUrl}`,
    ].join("\n"),
    html,
  }
}

const claimId = randomUUID()
const digests =
  (await (dryRun
    ? client.query(api.app.listPendingNotificationDigests, {
        serverToken,
      })
    : client.mutation(api.app.claimPendingNotificationDigests, {
        serverToken,
        claimId,
      }))) ?? []
const emailedNotificationIds = []

for (const digest of digests) {
  const message = renderNotificationDigestEmail({
    userName: digest.user.name,
    notifications: digest.notifications,
  })

  if (!dryRun) {
    try {
      await resend.emails.send({
        from: resendFromEmail,
        to: digest.user.email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      })

      await client.mutation(api.app.markNotificationsEmailed, {
        serverToken,
        claimId,
        notificationIds: digest.notifications.map((notification) => notification.id),
      })
    } catch (error) {
      await client.mutation(api.app.releaseNotificationDigestClaim, {
        serverToken,
        claimId,
        notificationIds: digest.notifications.map((notification) => notification.id),
      })

      throw error
    }
  }

  emailedNotificationIds.push(...digest.notifications.map((notification) => notification.id))
}

console.log(
  `${dryRun ? "prepared" : "sent"} ${emailedNotificationIds.length} digest notification email entr${emailedNotificationIds.length === 1 ? "y" : "ies"}`
)
