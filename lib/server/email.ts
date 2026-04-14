import { Resend } from "resend"

import { buildAppDestination } from "@/lib/auth-routing"

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error("Resend is not configured")
  }

  return new Resend(apiKey)
}

function getFromEmail() {
  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (!fromEmail) {
    throw new Error("Resend sender is not configured")
  }

  return fromEmail
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderEmailButton(input: {
  href: string
  label: string
  background: string
  color: string
  borderColor?: string
}) {
  return [
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0">',
    "<tr>",
    `<td align="center" bgcolor="${input.background}" style="border: 1px solid ${input.borderColor ?? input.background}; border-radius: 12px;">`,
    `<a href="${input.href}" style="display: inline-block; padding: 12px 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600; line-height: 1; color: ${input.color}; text-decoration: none; border-radius: 12px;">${escapeHtml(input.label)}</a>`,
    "</td>",
    "</tr>",
    "</table>",
  ].join("")
}

function renderInviteEmailHtml(input: {
  workspaceName: string
  teamName: string
  role: "admin" | "member" | "viewer" | "guest"
  acceptUrl: string
  joinCode: string
  joinCodeUrl: string
  logoUrl: string
}) {
  const primaryButton = renderEmailButton({
    href: input.acceptUrl,
    label: "Accept Invite",
    background: "#111111",
    color: "#ffffff",
  })
  const secondaryButton = renderEmailButton({
    href: input.joinCodeUrl,
    label: "Join With Team Code",
    background: "#ffffff",
    color: "#111111",
    borderColor: "#d4d4d8",
  })

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<body style="margin: 0; padding: 24px; background-color: #f5f5f5;">',
    '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">',
    "<tr>",
    '<td align="center">',
    '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 20px; overflow: hidden;">',
    "<tr>",
    '<td style="padding: 28px 28px 12px;">',
    `<img src="${input.logoUrl}" alt="Recipe Room" width="32" height="32" style="display: block; width: 32px; height: 32px; border-radius: 8px;" />`,
    '<div style="margin-top: 12px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #71717a;">Workspace Invite</div>',
    `<h1 style="margin: 10px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 28px; line-height: 1.15; font-weight: 700; color: #111111;">Join ${escapeHtml(input.teamName)} in ${escapeHtml(input.workspaceName)}</h1>`,
    `<p style="margin: 12px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6; color: #52525b;">You’ve been invited to access <strong style="color: #111111;">${escapeHtml(input.workspaceName)}</strong> through the <strong style="color: #111111;">${escapeHtml(input.teamName)}</strong> team.</p>`,
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding: 8px 28px 0;">',
    '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 16px;">',
    "<tr>",
    '<td style="padding: 16px 18px;">',
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #71717a;">Access Details</div>`,
    `<p style="margin: 10px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; color: #27272a;">Role: <strong>${escapeHtml(input.role)}</strong><br />This invite grants access at the workspace team level.</p>`,
    `<div style="margin-top: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 22px; line-height: 1; font-weight: 700; letter-spacing: 0.24em; color: #111111;">${escapeHtml(input.joinCode)}</div>`,
    '<div style="margin-top: 8px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 13px; line-height: 1.5; color: #71717a;">If the invite button doesn’t suit your flow, you can join with this 12-character team code instead.</div>',
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding: 20px 28px 0;">',
    primaryButton,
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding: 12px 28px 0;">',
    secondaryButton,
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding: 20px 28px 28px;">',
    `<p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; line-height: 1.6; color: #71717a;">If the buttons above do not open, use these links directly:<br /><a href="${input.acceptUrl}" style="color: #111111;">Accept invite</a><br /><a href="${input.joinCodeUrl}" style="color: #111111;">Join with team code</a></p>`,
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

function buildEntityPath(
  entityType: "workItem" | "document" | "channelPost" | "chat",
  entityId: string
) {
  if (entityType === "document") {
    return `/docs/${entityId}`
  }

  if (entityType === "channelPost") {
    return "/inbox"
  }

  if (entityType === "chat") {
    return `/chats?chatId=${entityId}`
  }

  return `/items/${entityId}`
}

export async function sendAssignmentEmails(input: {
  origin: string
  emails: Array<{
    notificationId: string
    email: string
    name: string
    itemTitle: string
    itemId: string
    actorName: string
  }>
}) {
  if (input.emails.length === 0) {
    return []
  }

  const resend = getResendClient()
  const from = getFromEmail()

  await Promise.all(
    input.emails.map((entry) =>
      resend.emails.send({
        from,
        to: entry.email,
        subject: `${entry.actorName} assigned you ${entry.itemTitle}`,
        text: [
          `Hi ${entry.name},`,
          "",
          `${entry.actorName} assigned you ${entry.itemTitle}.`,
          `${input.origin}${buildEntityPath("workItem", entry.itemId)}`,
        ].join("\n"),
        html: [
          `<p>Hi ${escapeHtml(entry.name)},</p>`,
          `<p><strong>${escapeHtml(entry.actorName)}</strong> assigned you <strong>${escapeHtml(entry.itemTitle)}</strong>.</p>`,
          `<p><a href="${input.origin}${buildEntityPath("workItem", entry.itemId)}">Open work item</a></p>`,
        ].join(""),
      })
    )
  )

  return input.emails.map((entry) => entry.notificationId)
}

export async function sendMentionEmails(input: {
  origin: string
  emails: Array<{
    notificationId: string
    email: string
    name: string
    entityTitle: string
    entityType: "workItem" | "document" | "channelPost" | "chat"
    entityId: string
    entityPath?: string
    entityLabel?: string
    actorName: string
    commentText: string
  }>
}) {
  if (input.emails.length === 0) {
    return []
  }

  const resend = getResendClient()
  const from = getFromEmail()

  await Promise.all(
    input.emails.map((entry) => {
      const path =
        entry.entityPath ?? buildEntityPath(entry.entityType, entry.entityId)
      const entityLabel =
        entry.entityLabel ??
        (entry.entityType === "document"
          ? "document"
          : entry.entityType === "channelPost"
            ? "channel post"
            : entry.entityType === "chat"
              ? "chat"
              : "work item")

      return resend.emails.send({
        from,
        to: entry.email,
        subject: `${entry.actorName} mentioned you in ${entry.entityTitle}`,
        text: [
          `Hi ${entry.name},`,
          "",
          `${entry.actorName} mentioned you in ${entry.entityTitle}.`,
          "",
          entry.commentText,
          "",
          `${input.origin}${path}`,
        ].join("\n"),
        html: [
          `<p>Hi ${escapeHtml(entry.name)},</p>`,
          `<p><strong>${escapeHtml(entry.actorName)}</strong> mentioned you in <strong>${escapeHtml(entry.entityTitle)}</strong>.</p>`,
          `<blockquote>${escapeHtml(entry.commentText).replaceAll("\n", "<br />")}</blockquote>`,
          `<p><a href="${input.origin}${path}">Open ${entityLabel}</a></p>`,
        ].join(""),
      })
    })
  )

  return input.emails.map((entry) => entry.notificationId)
}

export async function sendNotificationDigestEmails(input: {
  origin: string
  digests: Array<{
    user: {
      id: string
      email: string
      name: string
    }
    notifications: Array<{
      id: string
      message: string
      entityId: string
      entityType:
        | "workItem"
        | "document"
        | "project"
        | "invite"
        | "channelPost"
        | "chat"
      type: string
      createdAt: string
    }>
  }>
}) {
  if (input.digests.length === 0) {
    return []
  }

  const resend = getResendClient()
  const from = getFromEmail()
  const emailedNotificationIds: string[] = []

  await Promise.all(
    input.digests.map(async (digest) => {
      const topNotifications = digest.notifications.slice(0, 8)
      const listItems = topNotifications
        .map((notification) => {
          const path =
            notification.entityType === "document"
              ? buildEntityPath("document", notification.entityId)
              : notification.entityType === "workItem"
                ? buildEntityPath("workItem", notification.entityId)
                : notification.entityType === "chat"
                  ? "/inbox"
                  : "/inbox"

          return `<li><a href="${input.origin}${path}">${escapeHtml(notification.message)}</a></li>`
        })
        .join("")

      await resend.emails.send({
        from,
        to: digest.user.email,
        subject: `You have ${digest.notifications.length} unread notifications`,
        text: [
          `Hi ${digest.user.name},`,
          "",
          `You have ${digest.notifications.length} unread notifications waiting in your inbox.`,
          `${input.origin}/inbox`,
        ].join("\n"),
        html: [
          `<p>Hi ${escapeHtml(digest.user.name)},</p>`,
          `<p>You have <strong>${digest.notifications.length}</strong> unread notifications waiting in your inbox.</p>`,
          `<ul>${listItems}</ul>`,
          `<p><a href="${input.origin}/inbox">Open inbox</a></p>`,
        ].join(""),
      })

      emailedNotificationIds.push(
        ...digest.notifications.map((notification) => notification.id)
      )
    })
  )

  return emailedNotificationIds
}

export async function sendTeamInviteEmails(input: {
  invites: Array<{
    email: string
    workspaceName: string
    teamName: string
    role: "admin" | "member" | "viewer" | "guest"
    inviteToken: string
    joinCode: string
  }>
}) {
  if (input.invites.length === 0) {
    return
  }

  const resend = getResendClient()
  const from = getFromEmail()

  await Promise.all(
    input.invites.map((entry) => {
      const acceptUrl = buildAppDestination(
        `/onboarding?invite=${encodeURIComponent(entry.inviteToken)}`
      )
      const joinCodeUrl = buildAppDestination(
        `/onboarding?code=${encodeURIComponent(entry.joinCode)}`
      )
      const logoUrl = buildAppDestination("/app-icon.png")

      return resend.emails.send({
        from,
        to: entry.email,
        subject: `You're invited to join ${entry.teamName} in ${entry.workspaceName}`,
        text: [
          `You've been invited to join ${entry.teamName} in ${entry.workspaceName}.`,
          `Role: ${entry.role}`,
          "This access is issued at the workspace team level.",
          `Accept the invite: ${acceptUrl}`,
          `Join with team code: ${entry.joinCode}`,
          `Open code-based join: ${joinCodeUrl}`,
        ].join("\n"),
        html: renderInviteEmailHtml({
          workspaceName: entry.workspaceName,
          teamName: entry.teamName,
          role: entry.role,
          acceptUrl,
          joinCode: entry.joinCode,
          joinCodeUrl,
          logoUrl,
        }),
      })
    })
  )
}
