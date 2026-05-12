import type { Editor } from "@tiptap/react"
import { ySyncPluginKey } from "@tiptap/y-tiptap"
import type { Node as ProsemirrorNode } from "@tiptap/pm/model"
import * as Y from "yjs"

export type YSyncEditorState = {
  doc: Y.Doc | null
  type: Y.XmlFragment | null
  binding: {
    mapping: Map<Y.AbstractType<unknown>, ProsemirrorNode | ProsemirrorNode[]>
  } | null
  snapshot?: unknown
  prevSnapshot?: unknown
}

export type UsableYSyncEditorState = YSyncEditorState & {
  doc: Y.Doc
  type: Y.XmlFragment
  binding: NonNullable<YSyncEditorState["binding"]>
}

export function getYSyncEditorState(currentEditor: Editor) {
  return ySyncPluginKey.getState(currentEditor.state) as
    | YSyncEditorState
    | undefined
}

export function getUsableYSyncEditorState(
  currentEditor: Editor
): UsableYSyncEditorState | null {
  const yState = getYSyncEditorState(currentEditor)

  if (!yState?.doc || !yState.type || !yState.binding) {
    return null
  }

  return {
    ...yState,
    binding: yState.binding,
    doc: yState.doc,
    type: yState.type,
  }
}

export function hasLiveYSyncMarkerState(yState: YSyncEditorState | undefined) {
  if (!yState?.doc || !yState.type || !yState.binding) {
    return false
  }

  return yState.snapshot == null && yState.prevSnapshot == null
}
