"use client"

import { useRef, useState, type RefObject } from "react"
import type { Editor } from "@tiptap/react"
import { ImageSquare, Paperclip } from "@phosphor-icons/react"

import {
  ATTACHMENT_FILE_INPUT_ACCEPT,
  ATTACHMENT_IMAGE_INPUT_ACCEPT,
} from "@/lib/domain/file-uploads"
import { cn } from "@/lib/utils"

import { uploadRichTextEditorFiles } from "./attachment-uploads"
import type { RichTextAttachmentInsertMode } from "./attachment-insertion"
import type { RichTextAttachmentUploader } from "./attachment-upload-one"

type RichTextUploadButtonKind = "file" | "image"

export function RichTextUploadButton({
  className,
  deferUpload = false,
  disabled,
  editorRef,
  iconClassName = "size-4",
  insertMode,
  kind = "file",
  label,
  onUploadAttachment,
}: {
  className?: string
  deferUpload?: boolean
  disabled?: boolean
  editorRef: RefObject<Editor | null>
  iconClassName?: string
  insertMode?: RichTextAttachmentInsertMode
  kind?: RichTextUploadButtonKind
  label?: string
  onUploadAttachment?: RichTextAttachmentUploader
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  if (!onUploadAttachment) {
    return null
  }

  const uploadDisabled = disabled || uploading
  const resolvedInsertMode =
    insertMode ?? (kind === "image" ? "preview" : "auto")
  const accept =
    kind === "image"
      ? ATTACHMENT_IMAGE_INPUT_ACCEPT
      : ATTACHMENT_FILE_INPUT_ACCEPT
  const resolvedLabel =
    label ?? (kind === "image" ? "Insert image preview" : "Attach file")
  const Icon = kind === "image" ? ImageSquare : Paperclip

  return (
    <>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept={accept}
        multiple
        onChange={(event) => {
          const currentEditor = editorRef.current
          const files = Array.from(event.target.files ?? [])

          if (currentEditor) {
            void uploadRichTextEditorFiles({
              currentEditor,
              deferUpload,
              files,
              insertMode: resolvedInsertMode,
              position: currentEditor.state.selection.from,
              setUploadingAttachment: setUploading,
              uploadAttachment: onUploadAttachment,
            })
          }

          event.target.value = ""
        }}
      />
      <button
        type="button"
        aria-label={uploading ? "Uploading file" : resolvedLabel}
        disabled={uploadDisabled}
        className={cn(
          "inline-grid size-7 place-items-center rounded-md transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-default disabled:opacity-60",
          className
        )}
        onClick={() => inputRef.current?.click()}
      >
        <Icon className={iconClassName} />
      </button>
    </>
  )
}
