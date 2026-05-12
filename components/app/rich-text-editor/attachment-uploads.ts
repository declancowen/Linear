import type { Editor } from "@tiptap/react"

import {
  uploadRichTextEditorAttachment,
  type RichTextAttachmentUploader,
} from "./attachment-upload-one"

export async function uploadRichTextEditorFiles({
  currentEditor,
  files,
  position,
  setUploadingAttachment,
  uploadAttachment,
}: {
  currentEditor: Editor
  files: File[]
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
      file,
      position: nextPosition,
      setUploadingAttachment,
      uploadAttachment,
    })
    nextPosition = null
  }
}
