import { Resend } from "resend"

import { getAppOrigin } from "@/lib/auth-routing"

const APP_NAME = "Recipe Room"
const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const EMAIL_MONO_STACK =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
const EMAIL_COLORS = {
  text: "#111111",
  secondary: "#52525b",
  muted: "#71717a",
  bodyBackground: "#f5f5f5",
  cardBackground: "#ffffff",
  detailBackground: "#fafafa",
  border: "#e4e4e7",
  buttonBorder: "#d4d4d8",
} as const
const EMAIL_SETTINGS_PATH = "/settings/profile"

type AssignmentEmail = {
  notificationId: string
  email: string
  name: string
  itemTitle: string
  itemId: string
  actorName: string
}

type MentionEmail = {
  notificationId: string
  email: string
  name: string
  entityTitle: string
  entityType: "workItem" | "document" | "chat" | "channelPost"
  entityId: string
  actorName: string
  commentText: string
  entityPath?: string
  entityLabel?: string
}

type TeamInviteEmail = {
  email: string
  workspaceName: string
  teamName: string
  role: string
  inviteToken: string
  joinCode: string
}

type EmailMessage = {
  subject: string
  text: string
  html: string
}

let resendClient: Resend | null | undefined
let hasWarnedAboutMissingEmailConfig = false

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()

  if (!apiKey || !from) {
    return null
  }

  return {
    apiKey,
    from,
  }
}

function getResendClient() {
  const config = getResendConfig()

  if (!config) {
    if (!hasWarnedAboutMissingEmailConfig) {
      console.warn(
        "Resend is not configured. Skipping outbound app email delivery."
      )
      hasWarnedAboutMissingEmailConfig = true
    }

    return null
  }

  if (!resendClient) {
    resendClient = new Resend(config.apiKey)
  }

  return {
    client: resendClient,
    from: config.from,
  }
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function toHtmlWithLineBreaks(input: string) {
  return escapeHtml(input).replaceAll("\n", "<br />")
}

function toTitleCase(input: string) {
  return input
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function buildAbsoluteUrl(origin: string, path: string) {
  return new URL(path, origin).toString()
}

function getEntityPath(
  entityType: MentionEmail["entityType"],
  entityId: string
) {
  if (entityType === "document") {
    return `/docs/${entityId}`
  }

  if (entityType === "workItem") {
    return `/items/${entityId}`
  }

  return "/inbox"
}

function getEntityLabel(email: MentionEmail) {
  if (email.entityLabel) {
    return email.entityLabel
  }

  if (email.entityType === "workItem") {
    return "work item"
  }

  if (email.entityType === "document") {
    return "document"
  }

  if (email.entityType === "channelPost") {
    return "channel post"
  }

  return "chat"
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
    `<a href="${input.href}" style="display: inline-block; padding: 12px 18px; font-family: ${EMAIL_FONT_STACK}; font-size: 14px; font-weight: 600; line-height: 1; color: ${input.color}; text-decoration: none; border-radius: 12px;">${escapeHtml(input.label)}</a>`,
    "</td>",
    "</tr>",
    "</table>",
  ].join("")
}

function renderEmailLayout(input: {
  logoUrl: string
  eyebrow: string
  content: string
  footerText?: string
}) {
  const footerText = input.footerText ?? APP_NAME
  const settingsUrl = buildAbsoluteUrl(getAppOrigin(), EMAIL_SETTINGS_PATH)

  return [
    "<!doctype html>",
    '<html lang="en">',
    `<body style="margin: 0; padding: 24px; background-color: ${EMAIL_COLORS.bodyBackground};">`,
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
    `<p style="margin: 0; font-family: ${EMAIL_FONT_STACK}; font-size: 13px; line-height: 1.5; color: ${EMAIL_COLORS.muted};">${escapeHtml(footerText)} · <a href="${settingsUrl}" style="color: ${EMAIL_COLORS.text}; text-decoration: underline;">Email settings</a></p>`,
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

function renderFallbackLinks(input: {
  links: Array<{
    href: string
    label: string
  }>
  intro?: string
}) {
  return [
    `<p style="margin: 16px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 13px; line-height: 1.5; color: ${EMAIL_COLORS.muted};">${escapeHtml(
      input.intro ?? "If the button above does not open, use this link directly:"
    )}<br />`,
    input.links
      .map(
        (link) =>
          `<a href="${link.href}" style="color: ${EMAIL_COLORS.text}; text-decoration: underline;">${escapeHtml(link.label)}</a>`
      )
      .join("<br />"),
    "</p>",
  ].join("")
}

function renderInviteEmailText(input: {
  workspaceName: string
  teamName: string
  role: string
  acceptUrl: string
  joinCode: string
  joinCodeUrl: string
}) {
  return [
    `You've been invited to join ${input.teamName} in ${input.workspaceName}.`,
    `Role: ${input.role}`,
    "This access is issued at the workspace team level.",
    `Accept the invite: ${input.acceptUrl}`,
    `Join with team code: ${input.joinCode}`,
    `Open code-based join: ${input.joinCodeUrl}`,
  ].join("\n")
}

function renderInviteEmailHtml(input: {
  workspaceName: string
  teamName: string
  role: string
  acceptUrl: string
  joinCode: string
  joinCodeUrl: string
  logoUrl: string
}) {
  const primaryButton = renderEmailButton({
    href: input.acceptUrl,
    label: "Accept Invite",
    background: EMAIL_COLORS.text,
    color: "#ffffff",
  })
  const secondaryButton = renderEmailButton({
    href: input.joinCodeUrl,
    label: "Join With Team Code",
    background: "#ffffff",
    color: EMAIL_COLORS.text,
    borderColor: EMAIL_COLORS.buttonBorder,
  })

  const content = [
    `<h1 style="margin: 0; font-family: ${EMAIL_FONT_STACK}; font-size: 22px; line-height: 1.2; font-weight: 700; color: ${EMAIL_COLORS.text};">Join ${escapeHtml(input.teamName)} in ${escapeHtml(input.workspaceName)}</h1>`,
    `<p style="margin: 12px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${EMAIL_COLORS.secondary};">You’ve been invited to access <strong style="color: ${EMAIL_COLORS.text};">${escapeHtml(input.workspaceName)}</strong> through the <strong style="color: ${EMAIL_COLORS.text};">${escapeHtml(input.teamName)}</strong> team.</p>`,
    '<div style="margin-top: 24px;">',
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${EMAIL_COLORS.detailBackground}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 16px;">`,
    "<tr>",
    '<td style="padding: 16px 18px;">',
    `<div style="font-family: ${EMAIL_FONT_STACK}; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${EMAIL_COLORS.muted};">Access Details</div>`,
    `<p style="margin: 10px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 14px; line-height: 1.6; color: #27272a;">Role: <strong>${escapeHtml(toTitleCase(input.role))}</strong><br />This invite grants access at the workspace team level.</p>`,
    `<div style="margin-top: 14px; font-family: ${EMAIL_MONO_STACK}; font-size: 22px; line-height: 1; font-weight: 700; letter-spacing: 0.24em; color: ${EMAIL_COLORS.text};">${escapeHtml(input.joinCode)}</div>`,
    `<div style="margin-top: 8px; font-family: ${EMAIL_FONT_STACK}; font-size: 13px; line-height: 1.5; color: ${EMAIL_COLORS.muted};">If the invite button doesn’t suit your flow, you can join with this team code instead.</div>`,
    "</td>",
    "</tr>",
    "</table>",
    "</div>",
    `<div style="margin-top: 20px;">${primaryButton}</div>`,
    `<div style="margin-top: 12px;">${secondaryButton}</div>`,
    renderFallbackLinks({
      intro: "If the buttons above do not open, use these links directly:",
      links: [
        {
          href: input.acceptUrl,
          label: "Accept invite",
        },
        {
          href: input.joinCodeUrl,
          label: "Join with team code",
        },
      ],
    }),
  ].join("")

  return renderEmailLayout({
    logoUrl: input.logoUrl,
    eyebrow: "WORKSPACE INVITE",
    content,
  })
}

function renderAssignmentEmail(input: {
  origin: string
  name: string
  itemTitle: string
  itemId: string
  actorName: string
}): EmailMessage {
  const itemUrl = buildAbsoluteUrl(input.origin, `/items/${input.itemId}`)

  return {
    subject: `${input.actorName} assigned you ${input.itemTitle}`,
    text: [
      `Hi ${input.name},`,
      "",
      `${input.actorName} assigned you ${input.itemTitle}.`,
      "",
      `Work item: ${input.itemTitle}`,
      `Open work item: ${itemUrl}`,
    ].join("\n"),
    html: renderEmailLayout({
      logoUrl: buildAbsoluteUrl(input.origin, "/app-icon.png"),
      eyebrow: "ASSIGNMENT",
      content: [
        `<h1 style="margin: 0; font-family: ${EMAIL_FONT_STACK}; font-size: 22px; line-height: 1.2; font-weight: 700; color: ${EMAIL_COLORS.text};">${escapeHtml(input.actorName)} assigned you a work item</h1>`,
        '<div style="margin-top: 24px;">',
        `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${EMAIL_COLORS.detailBackground}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 16px;">`,
        "<tr>",
        '<td style="padding: 16px 18px;">',
        `<div style="font-family: ${EMAIL_FONT_STACK}; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${EMAIL_COLORS.muted};">Work Item</div>`,
        `<div style="margin-top: 10px; font-family: ${EMAIL_FONT_STACK}; font-size: 14px; line-height: 1.6; font-weight: 600; color: ${EMAIL_COLORS.text};">${escapeHtml(input.itemTitle)}</div>`,
        "</td>",
        "</tr>",
        "</table>",
        "</div>",
        `<div style="margin-top: 20px;">${renderEmailButton({
          href: itemUrl,
          label: "Open Work Item",
          background: EMAIL_COLORS.text,
          color: "#ffffff",
        })}</div>`,
        renderFallbackLinks({
          links: [
            {
              href: itemUrl,
              label: "Open work item",
            },
          ],
        }),
      ].join(""),
    }),
  }
}

function renderMentionEmail(input: {
  origin: string
  name: string
  entityTitle: string
  entityType: MentionEmail["entityType"]
  entityId: string
  entityPath?: string
  entityLabel?: string
  actorName: string
  commentText: string
}): EmailMessage {
  const entityPath =
    input.entityPath ?? getEntityPath(input.entityType, input.entityId)
  const entityUrl = buildAbsoluteUrl(input.origin, entityPath)
  const entityLabel =
    input.entityLabel ??
    getEntityLabel({
      notificationId: "",
      email: "",
      name: "",
      entityTitle: input.entityTitle,
      entityType: input.entityType,
      entityId: input.entityId,
      actorName: input.actorName,
      commentText: input.commentText,
    })
  const openLabel = `Open ${toTitleCase(entityLabel)}`

  return {
    subject: `${input.actorName} mentioned you in ${input.entityTitle}`,
    text: [
      `Hi ${input.name},`,
      "",
      `${input.actorName} mentioned you in ${input.entityTitle}.`,
      "",
      "Comment:",
      input.commentText,
      "",
      `${openLabel}: ${entityUrl}`,
    ].join("\n"),
    html: renderEmailLayout({
      logoUrl: buildAbsoluteUrl(input.origin, "/app-icon.png"),
      eyebrow: "MENTION",
      content: [
        `<h1 style="margin: 0; font-family: ${EMAIL_FONT_STACK}; font-size: 22px; line-height: 1.2; font-weight: 700; color: ${EMAIL_COLORS.text};">${escapeHtml(input.actorName)} mentioned you</h1>`,
        `<p style="margin: 8px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${EMAIL_COLORS.secondary};">in ${escapeHtml(input.entityTitle)}</p>`,
        '<div style="margin-top: 24px;">',
        `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${EMAIL_COLORS.detailBackground}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 16px;">`,
        "<tr>",
        '<td style="padding: 16px 18px;">',
        `<div style="font-family: ${EMAIL_FONT_STACK}; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${EMAIL_COLORS.muted};">Comment</div>`,
        `<div style="margin-top: 10px; font-family: ${EMAIL_FONT_STACK}; font-size: 14px; line-height: 1.6; color: #27272a;">${toHtmlWithLineBreaks(input.commentText)}</div>`,
        "</td>",
        "</tr>",
        "</table>",
        "</div>",
        `<div style="margin-top: 20px;">${renderEmailButton({
          href: entityUrl,
          label: openLabel,
          background: EMAIL_COLORS.text,
          color: "#ffffff",
        })}</div>`,
        renderFallbackLinks({
          links: [
            {
              href: entityUrl,
              label: openLabel,
            },
          ],
        }),
      ].join(""),
    }),
  }
}

async function sendEmail(input: {
  to: string
  subject: string
  text: string
  html: string
}) {
  const resend = getResendClient()

  if (!resend) {
    return false
  }

  await resend.client.emails.send({
    from: resend.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })

  return true
}

export async function sendAssignmentEmails(input: {
  origin: string
  emails: AssignmentEmail[]
}) {
  const emailedNotificationIds: string[] = []

  for (const email of input.emails) {
    try {
      const message = renderAssignmentEmail({
        origin: input.origin,
        name: email.name,
        itemTitle: email.itemTitle,
        itemId: email.itemId,
        actorName: email.actorName,
      })
      const sent = await sendEmail({
        to: email.email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      })

      if (sent) {
        emailedNotificationIds.push(email.notificationId)
      }
    } catch (error) {
      console.error("Failed to send assignment email", error)
    }
  }

  return emailedNotificationIds
}

export async function sendMentionEmails(input: {
  origin: string
  emails: MentionEmail[]
}) {
  const emailedNotificationIds: string[] = []

  for (const email of input.emails) {
    try {
      const message = renderMentionEmail({
        origin: input.origin,
        name: email.name,
        entityTitle: email.entityTitle,
        entityType: email.entityType,
        entityId: email.entityId,
        entityPath: email.entityPath,
        entityLabel: email.entityLabel,
        actorName: email.actorName,
        commentText: email.commentText,
      })
      const sent = await sendEmail({
        to: email.email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      })

      if (sent) {
        emailedNotificationIds.push(email.notificationId)
      }
    } catch (error) {
      console.error("Failed to send mention email", error)
    }
  }

  return emailedNotificationIds
}

export async function sendTeamInviteEmails(input: {
  invites: TeamInviteEmail[]
}) {
  const origin = getAppOrigin()

  await Promise.all(
    input.invites.map(async (invite) => {
      const acceptUrl = buildAbsoluteUrl(
        origin,
        `/join/${encodeURIComponent(invite.inviteToken)}`
      )
      const joinCodeUrl = buildAbsoluteUrl(
        origin,
        `/onboarding?code=${encodeURIComponent(invite.joinCode)}`
      )
      const logoUrl = buildAbsoluteUrl(origin, "/app-icon.png")

      try {
        const message = {
          subject: `Join ${invite.teamName} in ${invite.workspaceName}`,
          text: renderInviteEmailText({
            workspaceName: invite.workspaceName,
            teamName: invite.teamName,
            role: invite.role,
            acceptUrl,
            joinCode: invite.joinCode,
            joinCodeUrl,
          }),
          html: renderInviteEmailHtml({
            workspaceName: invite.workspaceName,
            teamName: invite.teamName,
            role: invite.role,
            acceptUrl,
            joinCode: invite.joinCode,
            joinCodeUrl,
            logoUrl,
          }),
        }

        await sendEmail({
          to: invite.email,
          subject: message.subject,
          text: message.text,
          html: message.html,
        })
      } catch (error) {
        console.error("Failed to send team invite email", error)
      }
    })
  )
}
