import { escapeHtml } from "@/lib/html"
import { getPlainTextContent } from "@/lib/utils"

export function createQuotedRichText(content: string, authorName?: string) {
  const quoteText = getPlainTextContent(content).trim()

  if (!quoteText) {
    return "<p></p>"
  }

  const attributedText = authorName ? `${authorName}: ${quoteText}` : quoteText

  return `<blockquote><p>${escapeHtml(attributedText).replace(/\r?\n/g, "<br />")}</p></blockquote><p></p>`
}
