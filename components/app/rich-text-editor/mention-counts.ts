import type { Editor } from "@tiptap/react"

import type { RichTextMentionCounts } from "@/lib/content/rich-text-mentions"

export function getEditorMentionCounts(
  currentEditor: Editor
): RichTextMentionCounts {
  const mentionCounts: RichTextMentionCounts = {}

  currentEditor.state.doc.descendants((node) => {
    if (node.type.name !== "mention") {
      return
    }

    const mentionId = node.attrs.id

    if (typeof mentionId !== "string" || mentionId.length === 0) {
      return
    }

    mentionCounts[mentionId] = (mentionCounts[mentionId] ?? 0) + 1
  })

  return mentionCounts
}
