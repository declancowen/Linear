import type { Editor } from "@tiptap/react"

import {
  getAttachmentFileKind,
  isImageAttachmentFile,
} from "@/lib/domain/file-uploads"

export type UploadedAttachment = {
  attachmentId?: string | null
  fileName: string
  fileUrl: string | null
}

export type RichTextAttachmentInsertMode = "auto" | "preview" | "reference"

export function insertUploadedAttachment(input: {
  currentEditor: Editor
  file: File
  insertMode?: RichTextAttachmentInsertMode
  uploaded: UploadedAttachment
  position?: number | null
}) {
  if (!input.uploaded.fileUrl) {
    return
  }

  const chain = input.currentEditor.chain().focus()
  const safePosition =
    input.position == null
      ? null
      : Math.min(
          Math.max(input.position, 1),
          input.currentEditor.state.doc.content.size
        )

  if (safePosition != null) {
    chain.setTextSelection(safePosition)
  }

  if (
    input.insertMode !== "reference" &&
    isImageAttachmentFile(input.file.name, input.file.type)
  ) {
    chain
      .insertContent([
        {
          type: "image",
          attrs: {
            src: input.uploaded.fileUrl,
            alt: input.uploaded.fileName,
            title: input.uploaded.fileName,
            ...(input.uploaded.attachmentId
              ? { attachmentId: input.uploaded.attachmentId }
              : {}),
          },
        },
        {
          type: "paragraph",
        },
      ])
      .run()

    return
  }

  chain
    .insertContent([
      {
        type: "attachmentReference",
        attrs: {
          href: input.uploaded.fileUrl,
          fileName: input.uploaded.fileName,
          attachmentKind: getAttachmentFileKind(
            input.file.name,
            input.file.type
          ),
          ...(input.uploaded.attachmentId
            ? { attachmentId: input.uploaded.attachmentId }
            : {}),
        },
      },
      {
        type: "text",
        text: " ",
      },
    ])
    .run()
}
