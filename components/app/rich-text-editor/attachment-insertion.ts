import type { Editor } from "@tiptap/react"

import { escapeHtml } from "@/lib/html"

export type UploadedAttachment = {
  fileName: string
  fileUrl: string | null
}

export function insertUploadedAttachment(input: {
  currentEditor: Editor
  file: File
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

  if (input.file.type.startsWith("image/")) {
    chain
      .insertContent([
        {
          type: "image",
          attrs: {
            src: input.uploaded.fileUrl,
            alt: input.uploaded.fileName,
            title: input.uploaded.fileName,
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
    .insertContent(
      `<p><a href="${escapeHtml(input.uploaded.fileUrl)}" target="_blank" rel="noreferrer">${escapeHtml(input.uploaded.fileName)}</a></p>`
    )
    .run()
}
