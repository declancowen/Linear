export type PendingDocumentMention = {
  userId: string
  count: number
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0
}

function extractHtmlAttribute(content: string, attributeName: string) {
  const match = content.match(
    new RegExp(`${attributeName}\\s*=\\s*(["'])(.*?)\\1`, "i")
  )

  return match?.[2]
}

function extractMentionUserIdsWithRegex(content: string) {
  const matches = content.matchAll(/<span\b([^>]*)>/gi)

  return [
    ...new Set(
      [...matches]
        .map((match) => match[1] ?? "")
        .map((attributes) => {
          const mentionType = extractHtmlAttribute(attributes, "data-type")
          const className = extractHtmlAttribute(attributes, "class")
          const isMentionSpan =
            mentionType === "mention" ||
            className?.split(/\s+/).includes("editor-mention")

          if (!isMentionSpan) {
            return undefined
          }

          return extractHtmlAttribute(attributes, "data-id")
        })
        .filter(isNonEmptyString)
    ),
  ]
}

export function extractRichTextMentionUserIds(content: string) {
  const normalizedContent = content.trim()

  if (normalizedContent.length === 0) {
    return []
  }

  if (typeof DOMParser === "undefined") {
    return extractMentionUserIdsWithRegex(normalizedContent)
  }

  const parser = new DOMParser()
  const document = parser.parseFromString(normalizedContent, "text/html")
  const nodes = document.querySelectorAll<HTMLElement>(
    'span[data-type="mention"][data-id], span.editor-mention[data-id]'
  )

  return [
    ...new Set(
      [...nodes].map((node) => node.dataset.id).filter(isNonEmptyString)
    ),
  ]
}

export function filterPendingDocumentMentionsByContent(
  pendingMentions: PendingDocumentMention[],
  content: string
) {
  const mentionUserIds = new Set(extractRichTextMentionUserIds(content))

  return pendingMentions.filter((mention) => mentionUserIds.has(mention.userId))
}

export function summarizePendingDocumentMentions(
  pendingMentions: PendingDocumentMention[]
) {
  return pendingMentions.reduce(
    (summary, mention) => ({
      recipientCount: summary.recipientCount + 1,
      mentionCount: summary.mentionCount + mention.count,
    }),
    {
      recipientCount: 0,
      mentionCount: 0,
    }
  )
}
