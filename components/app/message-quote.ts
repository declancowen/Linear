import {
  CHAT_QUOTE_SOURCE_MESSAGE_ID_ATTRIBUTE,
  normalizeChatQuoteSourceMessageId,
} from "@/lib/content/chat-message-quote-metadata"
import { parseHtmlDocument } from "@/lib/content/html-parsing"
import { sanitizeRichTextMessageContent } from "@/lib/content/rich-text-security"
import { escapeHtml } from "@/lib/html"
import { getPlainTextContent } from "@/lib/utils"

function hasQuotableRichTextContent(contentHtml: string) {
  if (getPlainTextContent(contentHtml).trim().length > 0) {
    return true
  }

  const document = parseHtmlDocument(contentHtml)
  return Boolean(
    document.body.querySelector(
      'img.editor-image, a[data-type="attachment"], a[href]'
    )
  )
}

export function createQuotedRichText(
  content: string,
  authorName?: string,
  sourceMessageId?: string
) {
  const quotedContent = sanitizeRichTextMessageContent(content).trim()

  if (!hasQuotableRichTextContent(quotedContent)) {
    return "<p></p>"
  }

  const normalizedSourceMessageId =
    normalizeChatQuoteSourceMessageId(sourceMessageId)
  const sourceAttribute = normalizedSourceMessageId
    ? ` ${CHAT_QUOTE_SOURCE_MESSAGE_ID_ATTRIBUTE}="${escapeHtml(normalizedSourceMessageId)}"`
    : ""
  const attribution = authorName?.trim()
    ? `<p>${escapeHtml(authorName.trim())}:</p>`
    : ""

  return `<blockquote${sourceAttribute}>${attribution}${quotedContent}</blockquote><p></p>`
}
