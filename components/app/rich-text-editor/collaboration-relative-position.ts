import type { Editor } from "@tiptap/react"
import { absolutePositionToRelativePosition } from "@tiptap/y-tiptap"

import {
  normalizeCollaborationRelativePosition,
  type CollaborationRelativePositionJson,
} from "./collaboration-relative-range"
import { getYSyncEditorState } from "./collaboration-y-sync-state"

export function createSerializedRelativePosition(
  currentEditor: Editor,
  position: number
): CollaborationRelativePositionJson | null {
  const yState = getYSyncEditorState(currentEditor)

  if (!yState?.type || !yState.binding) {
    return null
  }

  try {
    const safePosition = Math.min(
      Math.max(position, 0),
      currentEditor.state.doc.content.size
    )
    const relativePosition = absolutePositionToRelativePosition(
      safePosition,
      yState.type,
      yState.binding.mapping
    )

    return normalizeCollaborationRelativePosition(relativePosition)
  } catch {
    return null
  }
}
