import type { Editor } from "@tiptap/react"

import {
  insertUploadedAttachment,
  type UploadedAttachment,
} from "./attachment-insertion"

export type RichTextAttachmentUploader = (
  file: File
) => Promise<UploadedAttachment | null>

export async function uploadRichTextEditorAttachment({
  currentEditor,
  file,
  position,
  setUploadingAttachment,
  uploadAttachment,
}: {
  currentEditor: Editor
  file: File | null
  position?: number | null
  setUploadingAttachment: (uploading: boolean) => void
  uploadAttachment?: RichTextAttachmentUploader
}) {
  if (!file || !uploadAttachment) {
    return
  }

  setUploadingAttachment(true)
  const uploaded = await uploadAttachment(file)
  setUploadingAttachment(false)

  if (uploaded?.fileUrl) {
    insertUploadedAttachment({
      currentEditor,
      file,
      uploaded,
      position,
    })
  }
}
