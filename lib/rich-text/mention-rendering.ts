import { getMentionRenderLabel } from "@/lib/rich-text/mention-label"

export function renderMentionText({
  node,
  suggestion,
}: {
  node: {
    attrs: {
      id?: unknown
      label?: unknown
    }
  }
  suggestion?: {
    char?: string
  } | null
}) {
  return `${suggestion?.char ?? "@"}${getMentionRenderLabel(node)}`
}

export function renderMentionHTML({
  options: mentionOptions,
  node,
  suggestion,
}: {
  options: {
    HTMLAttributes: Record<string, unknown>
  }
  node: {
    attrs: {
      id?: unknown
      label?: unknown
    }
  }
  suggestion?: {
    char?: string
  } | null
}) {
  return [
    "span",
    mentionOptions.HTMLAttributes,
    renderMentionText({ node, suggestion }),
  ] as [string, Record<string, unknown>, string]
}
