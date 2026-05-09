import type { Editor } from "@tiptap/react"

import type { CollaborationCaretSide } from "@/lib/collaboration/awareness"

export function getLocalTextblockBoundarySide(
  currentEditor: Editor,
  position: number
): CollaborationCaretSide | null {
  try {
    const safePosition = Math.min(
      Math.max(position, 0),
      currentEditor.state.doc.content.size
    )
    const resolvedPosition = currentEditor.state.doc.resolve(safePosition)

    if (!resolvedPosition.parent.isTextblock) {
      return null
    }

    if (resolvedPosition.parentOffset === 0) {
      return "after"
    }

    if (
      resolvedPosition.parentOffset === resolvedPosition.parent.content.size
    ) {
      return "before"
    }
  } catch {
    return null
  }

  return null
}
