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
        html: [
          `<p>You've been invited to join <strong>${escapeHtml(entry.teamName)}</strong> in <strong>${escapeHtml(entry.workspaceName)}</strong>.</p>`,
          `<p>Role: <strong>${escapeHtml(entry.role)}</strong></p>`,
          `<p>This access is issued at the workspace team level.</p>`,
          `<p><a href="${acceptUrl}">Accept your invite</a></p>`,
          `<p>If you prefer, you can join with team code <strong>${escapeHtml(entry.joinCode)}</strong>.</p>`,
          `<p><a href="${joinCodeUrl}">Open the team code join flow</a></p>`,
        ].join(""),
      })
    })
  )
}
