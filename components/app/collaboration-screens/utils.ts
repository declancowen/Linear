import { format, isToday, isYesterday } from "date-fns"
import { trimTrailingRichTextDisplayWhitespace } from "@/lib/content/rich-text-security"
import { escapeHtml } from "@/lib/html"

export function formatTimestamp(value: string) {
  const d = new Date(value)
  if (isToday(d)) return format(d, "h:mm a")
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`
  return format(d, "MMM d, h:mm a")
}

export function formatShortDate(value: string) {
  const d = new Date(value)
  if (isToday(d)) return format(d, "h:mm a")
  if (isYesterday(d)) return "Yesterday"
  return format(d, "MMM d")
}

export function formatDayDivider(value: string) {
  const d = new Date(value)
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "EEEE, MMM d")
}

export function getLocalDayKey(value: string) {
  const d = new Date(value)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

const CHAT_MESSAGE_HTML_PATTERN =
  /^\s*<(p|h[1-6]|ul|ol|li|blockquote|pre|table|div|span|a|img)\b/i

export function getChatMessageMarkup(content: string) {
  if (CHAT_MESSAGE_HTML_PATTERN.test(content)) {
    return trimTrailingRichTextDisplayWhitespace(content)
  }

  return `<p>${escapeHtml(content.trimEnd()).replace(/\r?\n/g, "<br />")}</p>`
}

export function buildCallJoinHref(callId: string) {
  const query = new URLSearchParams({
    callId,
  })

  return `/api/calls/join?${query.toString()}`
}

export function parseCallInviteMessage(content: string) {
  const trimmed = content.trim()

  if (!trimmed.startsWith("Started a call")) {
    return null
  }

  const match = trimmed.match(
    /Join call:\s+(https?:\/\/\S+|\/api\/calls\/join\?\S+)/
  )

  if (!match) {
    return null
  }

  return {
    href: match[1],
    title: "Started a call",
  }
}
