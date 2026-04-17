export type PendingDocumentMention = {
  userId: string
  count: number
}

export type RichTextMentionCounts = Record<string, number>

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractHtmlAttribute(content: string, attributeName: string) {
  const escapedAttributeName = escapeRegExp(attributeName)
  const match = content.match(
    new RegExp(
      `${escapedAttributeName}\\s*=\\s*(?:(["'])([\\s\\S]*?)\\1|([^\\s"'=<>\\x60]+))`,
      "i"
    )
  )

  return match?.[2] ?? match?.[3]
}

function addMentionCount(
  mentionCounts: RichTextMentionCounts,
  userId: string | undefined
) {
  if (!isNonEmptyString(userId)) {
    return
  }

  mentionCounts[userId] = (mentionCounts[userId] ?? 0) + 1
}

function extractMentionCountsWithRegex(content: string) {
  const matches = content.matchAll(/<span\b([^>]*)>/gi)

  return [...matches]
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
    .reduce<RichTextMentionCounts>((mentionCounts, userId) => {
      addMentionCount(mentionCounts, userId)
      return mentionCounts
    }, {})
}

export function extractRichTextMentionCounts(content: string) {
  const normalizedContent = content.trim()

  if (normalizedContent.length === 0) {
    return {}
  }

  if (typeof DOMParser === "undefined") {
    return extractMentionCountsWithRegex(normalizedContent)
  }

  const parser = new DOMParser()
  const document = parser.parseFromString(normalizedContent, "text/html")
  const nodes = document.querySelectorAll<HTMLElement>(
    'span[data-type="mention"][data-id], span.editor-mention[data-id]'
  )

  return [...nodes]
    .map((node) => node.dataset.id)
    .reduce<RichTextMentionCounts>((mentionCounts, userId) => {
      addMentionCount(mentionCounts, userId)
      return mentionCounts
    }, {})
}

export function extractRichTextMentionUserIds(content: string) {
  return Object.keys(extractRichTextMentionCounts(content))
}

export function filterPendingDocumentMentionsByContent(
  pendingMentions: PendingDocumentMention[],
  content: string
) {
  const mentionCounts = extractRichTextMentionCounts(content)

  return pendingMentions.filter((mention) => (mentionCounts[mention.userId] ?? 0) > 0)
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
