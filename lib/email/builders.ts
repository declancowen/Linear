const APP_NAME = "Recipe Room"
const APP_TAGLINE = "Plan work, ship work."
const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const EMAIL_MONO_STACK =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

// Palette tuned to the app's neutral system. Values kept as
// hex so email clients (notably Outlook) render them reliably.
const EMAIL_COLORS = {
  text: "#0a0a0a",
  textStrong: "#111113",
  textMuted: "#52525b",
  textSubtle: "#71717a",
  bodyBackground: "#f4f4f5",
  cardBackground: "#ffffff",
  detailBackground: "#fafafa",
  border: "#e4e4e7",
  borderSoft: "#eeeef0",
  buttonBorder: "#d4d4d8",
  badgeBg: "#f4f4f5",
  badgeFg: "#52525b",
  badgeBorder: "#e4e4e7",
  quoteRule: "#111113",
} as const

const EMAIL_SETTINGS_PATH = "/settings/profile"
const EMAIL_HELP_PATH = "/help"

export type AssignmentEmail = {
  notificationId: string
  email: string
  name: string
  itemTitle: string
  itemId: string
  actorName: string
  teamName?: string | null
}

export type MentionEmail = {
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
  detailLabel?: string
  detailText?: string
  mentionCount?: number
}

export type TeamInviteEmail = {
  email: string
  workspaceName: string
  teamNames: string[]
  role: string
  inviteToken: string
}

export type AccessChangeEmail = {
  email: string
  subject: string
  eyebrow: string
  headline: string
  body: string
}

type EmailMessage = {
  subject: string
  text: string
  html: string
}

export type QueuedEmailJob = {
  kind: "mention" | "assignment" | "invite" | "access-change"
  notificationId?: string
  toEmail: string
  subject: string
  text: string
  html: string
}

export type QueuedMentionEmailJob = Omit<
  QueuedEmailJob,
  "kind" | "notificationId"
> & {
  kind: "mention"
  notificationId: string
}

export type QueuedAssignmentEmailJob = Omit<
  QueuedEmailJob,
  "kind" | "notificationId"
> & {
  kind: "assignment"
  notificationId: string
}

export type QueuedInviteEmailJob = Omit<QueuedEmailJob, "kind"> & {
  kind: "invite"
}

export type QueuedAccessChangeEmailJob = Omit<QueuedEmailJob, "kind"> & {
  kind: "access-change"
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

// Normalize badge labels to sentence case so legacy ALL-CAPS eyebrow strings
// (e.g. "WORKSPACE DELETED") render consistently with newer copy like
// "New mention".
function toBadgeLabel(input: string) {
  const trimmed = input.trim()

  if (!trimmed) {
    return trimmed
  }

  if (trimmed === trimmed.toUpperCase()) {
    const lower = trimmed.toLowerCase()
    return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`
  }

  return trimmed
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

function renderPreheader(text: string) {
  // Hidden preview text surfaced by most inbox previews. The zero-width joiners
  // prevent Gmail from pulling the first visible text into the preview pane.
  const padding = "&#847; ".repeat(60)
  return [
    `<div style="display: none; overflow: hidden; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; max-height: 0; max-width: 0; mso-hide: all; font-size: 1px; line-height: 1px;">`,
    escapeHtml(text),
    padding,
    "</div>",
  ].join("")
}

function renderBadge(input: { label: string }) {
  return [
    `<span style="display: inline-block; padding: 4px 10px; font-family: ${EMAIL_FONT_STACK}; font-size: 12px; font-weight: 600; line-height: 1.4; color: ${EMAIL_COLORS.badgeFg}; background-color: ${EMAIL_COLORS.badgeBg}; border: 1px solid ${EMAIL_COLORS.badgeBorder}; border-radius: 999px; letter-spacing: 0.01em;">`,
    escapeHtml(toBadgeLabel(input.label)),
    "</span>",
  ].join("")
}

function renderEmailButton(input: {
  href: string
  label: string
  variant?: "primary" | "secondary"
  showArrow?: boolean
}) {
  const isPrimary = (input.variant ?? "primary") === "primary"
  const background = isPrimary ? EMAIL_COLORS.text : "#ffffff"
  const color = isPrimary ? "#ffffff" : EMAIL_COLORS.text
  const borderColor = isPrimary ? EMAIL_COLORS.text : EMAIL_COLORS.buttonBorder
  const arrow = input.showArrow ?? isPrimary

  return [
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0">',
    "<tr>",
    `<td align="center" bgcolor="${background}" style="border: 1px solid ${borderColor}; border-radius: 12px;">`,
    `<a href="${input.href}" style="display: inline-block; padding: 13px 22px; font-family: ${EMAIL_FONT_STACK}; font-size: 14px; font-weight: 600; line-height: 1; color: ${color}; text-decoration: none; border-radius: 12px; letter-spacing: -0.005em;">`,
    `${escapeHtml(input.label)}${arrow ? '<span style="display: inline-block; margin-left: 6px;" aria-hidden="true">&rarr;</span>' : ""}`,
    "</a>",
    "</td>",
    "</tr>",
    "</table>",
  ].join("")
}

function renderEmailLayout(input: {
  origin: string
  logoUrl: string
  eyebrow: string
  content: string
  footerText?: string
  preheader?: string
}) {
  const footerText = input.footerText ?? APP_TAGLINE
  const settingsUrl = buildAbsoluteUrl(input.origin, EMAIL_SETTINGS_PATH)
  const helpUrl = buildAbsoluteUrl(input.origin, EMAIL_HELP_PATH)
  const preheader = input.preheader ?? ""

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="color-scheme" content="light" />',
    '<meta name="supported-color-schemes" content="light" />',
    `<title>${escapeHtml(APP_NAME)}</title>`,
    "</head>",
    `<body style="margin: 0; padding: 32px 16px; background-color: ${EMAIL_COLORS.bodyBackground}; font-family: ${EMAIL_FONT_STACK}; -webkit-font-smoothing: antialiased;">`,
    preheader ? renderPreheader(preheader) : "",
    '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">',
    "<tr>",
    '<td align="center">',
    // Card
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: ${EMAIL_COLORS.cardBackground}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 24px; overflow: hidden;">`,
    // Brand header
    "<tr>",
    `<td style="padding: 24px 32px 20px; border-bottom: 1px solid ${EMAIL_COLORS.borderSoft};">`,
    '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">',
    "<tr>",
    `<td valign="middle" style="width: 32px;"><img src="${input.logoUrl}" alt="" width="32" height="32" style="display: block; width: 32px; height: 32px; border-radius: 8px;" /></td>`,
    `<td valign="middle" style="padding-left: 12px; font-family: ${EMAIL_FONT_STACK}; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: ${EMAIL_COLORS.textStrong};">${escapeHtml(APP_NAME)}</td>`,
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    // Badge + content
    "<tr>",
    '<td style="padding: 28px 32px 8px;">',
    renderBadge({ label: input.eyebrow }),
    "</td>",
    "</tr>",
    "<tr>",
    `<td style="padding: 8px 32px 28px;">${input.content}</td>`,
    "</tr>",
    // Footer
    "<tr>",
    `<td style="padding: 20px 32px 28px; background-color: ${EMAIL_COLORS.detailBackground}; border-top: 1px solid ${EMAIL_COLORS.borderSoft};">`,
    `<p style="margin: 0 0 6px; font-family: ${EMAIL_FONT_STACK}; font-size: 13px; font-weight: 600; line-height: 1.4; color: ${EMAIL_COLORS.textStrong};">${escapeHtml(APP_NAME)}</p>`,
    `<p style="margin: 0 0 12px; font-family: ${EMAIL_FONT_STACK}; font-size: 13px; line-height: 1.5; color: ${EMAIL_COLORS.textSubtle};">${escapeHtml(footerText)}</p>`,
    `<p style="margin: 0; font-family: ${EMAIL_FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${EMAIL_COLORS.textSubtle};"><a href="${settingsUrl}" style="color: ${EMAIL_COLORS.textMuted}; text-decoration: underline;">Email preferences</a> &middot; <a href="${helpUrl}" style="color: ${EMAIL_COLORS.textMuted}; text-decoration: underline;">Help &amp; support</a></p>`,
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
    `<p style="margin: 20px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 12px; line-height: 1.5; color: ${EMAIL_COLORS.textSubtle};">${escapeHtml(
      input.intro ?? "Trouble with the button? Use this link instead:"
    )}<br />`,
    input.links
      .map(
        (link) =>
          `<a href="${link.href}" style="color: ${EMAIL_COLORS.textMuted}; text-decoration: underline; word-break: break-all;">${escapeHtml(link.label)}</a>`
      )
      .join("<br />"),
    "</p>",
  ].join("")
}

// Quote-style card, used for rendering comment bodies in mention emails.
function renderQuoteCard(input: { label: string; body: string }) {
  return [
    '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 20px;">',
    "<tr>",
    `<td style="padding: 16px 18px; background-color: ${EMAIL_COLORS.detailBackground}; border: 1px solid ${EMAIL_COLORS.borderSoft}; border-left: 3px solid ${EMAIL_COLORS.quoteRule}; border-radius: 12px;">`,
    `<div style="font-family: ${EMAIL_FONT_STACK}; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${EMAIL_COLORS.textSubtle};">${escapeHtml(input.label)}</div>`,
    `<div style="margin-top: 10px; font-family: ${EMAIL_FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${EMAIL_COLORS.textStrong};">${toHtmlWithLineBreaks(input.body)}</div>`,
    "</td>",
    "</tr>",
    "</table>",
  ].join("")
}

// Neutral detail card for structured metadata (work items, role info, etc.).
function renderDetailCard(input: { rows: Array<{ label: string; value: string; valueIsHtml?: boolean }> }) {
  return [
    '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 20px;">',
    "<tr>",
    `<td style="padding: 18px 20px; background-color: ${EMAIL_COLORS.detailBackground}; border: 1px solid ${EMAIL_COLORS.borderSoft}; border-radius: 14px;">`,
    input.rows
      .map((row, index) => {
        const value = row.valueIsHtml ? row.value : escapeHtml(row.value)
        return [
          `<div style="${index === 0 ? "" : "margin-top: 14px;"}">`,
          `<div style="font-family: ${EMAIL_FONT_STACK}; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${EMAIL_COLORS.textSubtle};">${escapeHtml(row.label)}</div>`,
          `<div style="margin-top: 6px; font-family: ${EMAIL_FONT_STACK}; font-size: 15px; font-weight: 500; line-height: 1.5; color: ${EMAIL_COLORS.textStrong};">${value}</div>`,
          "</div>",
        ].join("")
      })
      .join(""),
    "</td>",
    "</tr>",
    "</table>",
  ].join("")
}

function renderHeadline(text: string) {
  return `<h1 style="margin: 16px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 26px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; color: ${EMAIL_COLORS.textStrong};">${escapeHtml(text)}</h1>`
}

function renderSubheading(html: string) {
  return `<p style="margin: 10px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 15px; line-height: 1.6; color: ${EMAIL_COLORS.textMuted};">${html}</p>`
}

function renderInviteEmailText(input: {
  workspaceName: string
  teamNames: string[]
  role: string
  acceptUrl: string
}) {
  const teamLine =
    input.teamNames.length === 1
      ? `Team: ${input.teamNames[0]}`
      : `Teams: ${input.teamNames.join(", ")}`

  return [
    `You've been invited to join ${input.workspaceName}.`,
    teamLine,
    `Role: ${input.role}`,
    "This access is issued at the workspace team level.",
    `Accept the invite: ${input.acceptUrl}`,
  ].join("\n")
}

function renderAccessChangeEmail(input: {
  origin: string
  eyebrow: string
  headline: string
  body: string
}): EmailMessage {
  return {
    subject: input.headline,
    text: [input.headline, "", input.body].join("\n"),
    html: renderEmailLayout({
      origin: input.origin,
      logoUrl: buildAbsoluteUrl(input.origin, "/app-icon.png"),
      eyebrow: input.eyebrow,
      preheader: input.headline,
      content: [
        renderHeadline(input.headline),
        `<p style="margin: 14px 0 0; font-family: ${EMAIL_FONT_STACK}; font-size: 15px; line-height: 1.65; color: ${EMAIL_COLORS.textMuted};">${toHtmlWithLineBreaks(input.body)}</p>`,
      ].join(""),
      footerText: `${APP_NAME} sends this email whenever your workspace access changes.`,
    }),
  }
}

function renderInviteEmailHtml(input: {
  origin: string
  workspaceName: string
  teamNames: string[]
  role: string
  acceptUrl: string
  logoUrl: string
}) {
  const teamValue =
    input.teamNames.length === 1
      ? input.teamNames[0]
      : input.teamNames.join(", ")
  const primaryButton = renderEmailButton({
    href: input.acceptUrl,
    label: "Accept invite",
    variant: "primary",
  })

  const content = [
    renderHeadline(`Join ${input.workspaceName}`),
    renderSubheading(
      `You&rsquo;ve been invited to <strong style="color: ${EMAIL_COLORS.textStrong}; font-weight: 600;">${escapeHtml(input.workspaceName)}</strong> with access to ${input.teamNames.length === 1 ? "the following team" : "the following teams"}.`
    ),
    renderDetailCard({
      rows: [
        {
          label: input.teamNames.length === 1 ? "Team" : "Teams",
          value: teamValue,
        },
        {
          label: "Role",
          value: toTitleCase(input.role),
        },
        {
          label: "Access scope",
          value: "Workspace team level",
        },
      ],
    }),
    `<div style="margin-top: 24px;">${primaryButton}</div>`,
    renderFallbackLinks({
      intro: "Trouble with the button? Use this link instead:",
      links: [
        {
          href: input.acceptUrl,
          label: "Accept invite",
        },
      ],
    }),
  ].join("")

  return renderEmailLayout({
    origin: input.origin,
    logoUrl: input.logoUrl,
    eyebrow: "Workspace invite",
    preheader:
      input.teamNames.length === 1
        ? `Join ${input.teamNames[0]} in ${input.workspaceName}`
        : `Join ${input.workspaceName}`,
    content,
  })
}

function renderAssignmentEmail(input: {
  origin: string
  name: string
  itemTitle: string
  itemId: string
  actorName: string
  teamName?: string | null
}): EmailMessage {
  const itemUrl = buildAbsoluteUrl(input.origin, `/items/${input.itemId}`)
  const teamLine = input.teamName?.trim() ? `Team: ${input.teamName}` : null

  const detailRows: Array<{ label: string; value: string }> = [
    { label: "Work item", value: input.itemTitle },
  ]

  if (input.teamName?.trim()) {
    detailRows.push({ label: "Team", value: input.teamName })
  }

  return {
    subject: input.teamName?.trim()
      ? `${input.actorName} assigned you "${input.itemTitle}" in ${input.teamName}`
      : `${input.actorName} assigned you "${input.itemTitle}"`,
    text: [
      `Hi ${input.name},`,
      "",
      input.teamName?.trim()
        ? `${input.actorName} assigned you "${input.itemTitle}" in ${input.teamName}.`
        : `${input.actorName} assigned you "${input.itemTitle}".`,
      "",
      `Work item: ${input.itemTitle}`,
      ...(teamLine ? [teamLine] : []),
      `Open work item: ${itemUrl}`,
    ].join("\n"),
    html: renderEmailLayout({
      origin: input.origin,
      logoUrl: buildAbsoluteUrl(input.origin, "/app-icon.png"),
      eyebrow: "New assignment",
      preheader: `${input.actorName} assigned you ${input.itemTitle}`,
      content: [
        renderHeadline(`${input.actorName} assigned you a work item`),
        renderSubheading(
          input.teamName?.trim()
            ? `In <strong style="color: ${EMAIL_COLORS.textStrong}; font-weight: 600;">${escapeHtml(input.teamName)}</strong>. It&rsquo;s ready whenever you are.`
            : "It&rsquo;s ready whenever you are."
        ),
        renderDetailCard({ rows: detailRows }),
        `<div style="margin-top: 24px;">${renderEmailButton({
          href: itemUrl,
          label: "Open work item",
          variant: "primary",
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
  detailLabel?: string
  detailText?: string
  mentionCount?: number
}): EmailMessage {
  const entityPath =
    input.entityPath ?? getEntityPath(input.entityType, input.entityId)
  const entityUrl = buildAbsoluteUrl(input.origin, entityPath)
  const mentionCount = Math.max(1, input.mentionCount ?? 1)
  const detailLabel = input.detailLabel ?? "Comment"
  const detailText = input.detailText ?? input.commentText
  const mentionSummary =
    mentionCount > 1
      ? `${input.actorName} mentioned you ${mentionCount} times in ${input.entityTitle}.`
      : `${input.actorName} mentioned you in ${input.entityTitle}.`
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
      detailLabel: input.detailLabel,
      detailText: input.detailText,
      mentionCount: input.mentionCount,
    })
  const openLabel = `Open ${entityLabel}`
  const headline =
    mentionCount > 1
      ? `${input.actorName} mentioned you ${mentionCount} times`
      : `${input.actorName} mentioned you`

  return {
    subject:
      mentionCount > 1
        ? `${input.actorName} mentioned you ${mentionCount} times in ${input.entityTitle}`
        : `${input.actorName} mentioned you in ${input.entityTitle}`,
    text: [
      `Hi ${input.name},`,
      "",
      mentionSummary,
      "",
      `${detailLabel}:`,
      detailText,
      "",
      `${toTitleCase(openLabel)}: ${entityUrl}`,
    ].join("\n"),
    html: renderEmailLayout({
      origin: input.origin,
      logoUrl: buildAbsoluteUrl(input.origin, "/app-icon.png"),
      eyebrow: "New mention",
      preheader: mentionSummary,
      content: [
        renderHeadline(headline),
        renderSubheading(
          `in <strong style="color: ${EMAIL_COLORS.textStrong}; font-weight: 600;">${escapeHtml(input.entityTitle)}</strong>`
        ),
        renderQuoteCard({ label: detailLabel, body: detailText }),
        `<div style="margin-top: 24px;">${renderEmailButton({
          href: entityUrl,
          label: openLabel,
          variant: "primary",
        })}</div>`,
        renderFallbackLinks({
          links: [
            {
              href: entityUrl,
              label: toTitleCase(openLabel),
            },
          ],
        }),
      ].join(""),
    }),
  }
}

export function buildMentionEmailJobs(input: {
  origin: string
  emails: MentionEmail[]
}): QueuedMentionEmailJob[] {
  const origin = input.origin

  return input.emails.map((email) => {
    const message = renderMentionEmail({
      origin,
      name: email.name,
      entityTitle: email.entityTitle,
      entityType: email.entityType,
      entityId: email.entityId,
      entityPath: email.entityPath,
      entityLabel: email.entityLabel,
      actorName: email.actorName,
      commentText: email.commentText,
      detailLabel: email.detailLabel,
      detailText: email.detailText,
      mentionCount: email.mentionCount,
    })

    return {
      kind: "mention",
      notificationId: email.notificationId,
      toEmail: email.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }
  })
}

export function buildAssignmentEmailJobs(input: {
  origin: string
  emails: AssignmentEmail[]
}): QueuedAssignmentEmailJob[] {
  const origin = input.origin

  return input.emails.map((email) => {
    const message = renderAssignmentEmail({
      origin,
      name: email.name,
      itemTitle: email.itemTitle,
      itemId: email.itemId,
      actorName: email.actorName,
      teamName: email.teamName,
    })

    return {
      kind: "assignment",
      notificationId: email.notificationId,
      toEmail: email.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }
  })
}

export function buildTeamInviteEmailJobs(input: {
  origin: string
  invites: TeamInviteEmail[]
}): QueuedInviteEmailJob[] {
  const origin = input.origin

  return input.invites.map((invite) => {
    const acceptUrl = buildAbsoluteUrl(
      origin,
      `/join/${encodeURIComponent(invite.inviteToken)}`
    )
    const logoUrl = buildAbsoluteUrl(origin, "/app-icon.png")
    const message = {
      subject:
        invite.teamNames.length === 1
          ? `Join ${invite.teamNames[0]} in ${invite.workspaceName}`
          : `Join ${invite.workspaceName}`,
      text: renderInviteEmailText({
        workspaceName: invite.workspaceName,
        teamNames: invite.teamNames,
        role: invite.role,
        acceptUrl,
      }),
      html: renderInviteEmailHtml({
        origin,
        workspaceName: invite.workspaceName,
        teamNames: invite.teamNames,
        role: invite.role,
        acceptUrl,
        logoUrl,
      }),
    }

    return {
      kind: "invite",
      toEmail: invite.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }
  })
}

export function buildAccessChangeEmailJobs(input: {
  origin: string
  emails: AccessChangeEmail[]
}): QueuedAccessChangeEmailJob[] {
  const origin = input.origin

  return input.emails.map((email) => {
    const message = renderAccessChangeEmail({
      origin,
      eyebrow: email.eyebrow,
      headline: email.headline,
      body: email.body,
    })

    return {
      kind: "access-change",
      toEmail: email.email,
      subject: email.subject,
      text: message.text,
      html: message.html,
    }
  })
}
