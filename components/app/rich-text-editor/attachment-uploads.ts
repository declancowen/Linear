import type { Editor } from "@tiptap/react"

import {
  uploadRichTextEditorAttachment,
  type RichTextAttachmentUploader,
} from "./attachment-upload-one"
import type { RichTextAttachmentInsertMode } from "./attachment-insertion"

export async function uploadRichTextEditorFiles({
  currentEditor,
  deferUpload = false,
  files,
  insertMode = "auto",
  position,
  setUploadingAttachment,
  uploadAttachment,
}: {
  currentEditor: Editor
  deferUpload?: boolean
  files: File[]
  insertMode?: RichTextAttachmentInsertMode
  position?: number | null
  setUploadingAttachment: (uploading: boolean) => void
  uploadAttachment?: RichTextAttachmentUploader
}) {
  if (!uploadAttachment || files.length === 0) {
    return
  }

  let nextPosition = position ?? null

  for (const file of files) {
    await uploadRichTextEditorAttachment({
      currentEditor,
      deferUpload,
      file,
      insertMode,
      position: nextPosition,
      setUploadingAttachment,
      uploadAttachment,
    })
    nextPosition = null
  }
}
