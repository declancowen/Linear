import type { Editor } from "@tiptap/react"
import { toast } from "sonner"

import { getAttachmentFileValidationMessage } from "@/lib/domain/file-uploads"

import {
  insertUploadedAttachment,
  type RichTextAttachmentInsertMode,
  type UploadedAttachment,
} from "./attachment-insertion"
import { registerPendingAttachment } from "./pending-attachments"

export type RichTextAttachmentUploader = (
  file: File
) => Promise<UploadedAttachment | null>

export async function uploadRichTextEditorAttachment({
  currentEditor,
  deferUpload = false,
  file,
  insertMode = "auto",
  position,
  setUploadingAttachment,
  uploadAttachment,
}: {
  currentEditor: Editor
  deferUpload?: boolean
  file: File | null
  insertMode?: RichTextAttachmentInsertMode
  position?: number | null
  setUploadingAttachment: (uploading: boolean) => void
  uploadAttachment?: RichTextAttachmentUploader
}) {
  if (!file || !uploadAttachment) {
    return
  }

  if (deferUpload) {
    const validationMessage = getAttachmentFileValidationMessage(file)

    if (validationMessage) {
      toast.error(validationMessage)
      return
    }

    insertUploadedAttachment({
      currentEditor,
      file,
      insertMode,
      position,
      uploaded: {
        fileName: file.name,
        fileUrl: registerPendingAttachment(file),
      },
    })

    return
  }

  setUploadingAttachment(true)
  const uploaded = await uploadAttachment(file).finally(() => {
    setUploadingAttachment(false)
  })

  if (uploaded?.fileUrl) {
    insertUploadedAttachment({
      currentEditor,
      file,
      insertMode,
      uploaded,
      position,
    })
  }
}
