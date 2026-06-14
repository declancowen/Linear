"use client"

import { useMemo, useState } from "react"
import {
  CaretLeft,
  CaretRight,
  DownloadSimple,
  File,
  X,
} from "@phosphor-icons/react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { isImageAttachmentFile } from "@/lib/domain/file-uploads"
import type { Attachment } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

function AttachmentDownload({
  attachment,
  className,
}: {
  attachment: Attachment
  className?: string
}) {
  if (!attachment.fileUrl) {
    return null
  }

  return (
    <a
      href={attachment.fileUrl}
      download={attachment.fileName}
      aria-label={`Download ${attachment.fileName}`}
      title={`Download ${attachment.fileName}`}
      className={cn(
        "inline-grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
        className
      )}
    >
      <DownloadSimple className="size-4" />
    </a>
  )
}

export function WorkItemAttachments({
  attachments,
  editable = false,
  onRemove,
}: {
  attachments: Attachment[]
  editable?: boolean
  onRemove?: (attachmentId: string) => void
}) {
  const images = useMemo(
    () =>
      attachments.filter(
        (attachment) =>
          attachment.fileUrl &&
          isImageAttachmentFile(attachment.fileName, attachment.contentType)
      ),
    [attachments]
  )
  const files = useMemo(
    () =>
      attachments.filter(
        (attachment) =>
          !attachment.fileUrl ||
          !isImageAttachmentFile(attachment.fileName, attachment.contentType)
      ),
    [attachments]
  )
  const [previewImageId, setPreviewImageId] = useState<string | null>(null)
  const previewIndex = images.findIndex(
    (attachment) => attachment.id === previewImageId
  )
  const previewImage = previewIndex >= 0 ? images[previewIndex] : null

  if (attachments.length === 0) {
    return null
  }

  function movePreview(offset: number) {
    if (images.length < 2 || previewIndex < 0) {
      return
    }

    const nextIndex = (previewIndex + offset + images.length) % images.length
    setPreviewImageId(images[nextIndex]?.id ?? null)
  }

  function RemoveButton({ attachment }: { attachment: Attachment }) {
    if (!editable || !onRemove) {
      return null
    }

    return (
      <button
        type="button"
        aria-label={`Remove ${attachment.fileName}`}
        title={`Remove ${attachment.fileName}`}
        onClick={() => onRemove(attachment.id)}
        className="inline-grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    )
  }

  return (
    <>
      <div className="mt-3 space-y-3 border-t border-line-soft pt-3">
        {files.length > 0 ? (
          <div
            aria-label="Work item files"
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {files.map((attachment) => (
              <div
                key={attachment.id}
                className="flex min-w-52 max-w-64 shrink-0 items-center gap-2 rounded-lg border border-line bg-surface-2 p-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-3 text-fg-3">
                    <File className="size-4" />
                  </span>
                  <span className="truncate text-xs text-fg-2">
                    {attachment.fileName}
                  </span>
                </div>
                <AttachmentDownload attachment={attachment} />
                <RemoveButton attachment={attachment} />
              </div>
            ))}
          </div>
        ) : null}

        {images.length > 0 ? (
          <div
            aria-label="Work item images"
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {images.map((attachment) => (
              <div
                key={attachment.id}
                className="relative h-24 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2"
              >
                <button
                  type="button"
                  aria-label={attachment.fileName}
                  onClick={() => setPreviewImageId(attachment.id)}
                  className="h-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- User-uploaded attachment URLs are resolved at runtime. */}
                  <img
                    src={attachment.fileUrl ?? ""}
                    alt={attachment.fileName}
                    className="h-full w-auto object-cover"
                  />
                </button>
                <div className="absolute top-1 right-1 flex rounded-md bg-surface-1/90">
                  <AttachmentDownload attachment={attachment} />
                  <RemoveButton attachment={attachment} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <Dialog
        open={previewImage !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewImageId(null)
          }
        }}
      >
        {previewImage?.fileUrl ? (
          <DialogContent
            aria-describedby={undefined}
            className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] gap-3 bg-black/90 p-3 text-white sm:max-w-[calc(100vw-2rem)]"
          >
            <DialogTitle className="sr-only">
              {previewImage.fileName}
            </DialogTitle>
            <div className="relative flex min-h-0 items-center justify-center">
              {images.length > 1 ? (
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() => movePreview(-1)}
                  className="absolute left-2 z-10 grid size-9 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                >
                  <CaretLeft className="size-5" />
                </button>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element -- User-uploaded attachment URLs are resolved at runtime. */}
              <img
                src={previewImage.fileUrl}
                alt={previewImage.fileName}
                className="max-h-[calc(100vh-7rem)] max-w-full rounded-md object-contain"
              />
              {images.length > 1 ? (
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => movePreview(1)}
                  className="absolute right-2 z-10 grid size-9 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                >
                  <CaretRight className="size-5" />
                </button>
              ) : null}
            </div>
            <div className="flex items-center justify-center gap-2 px-8 text-xs text-white/75">
              <span className="truncate">{previewImage.fileName}</span>
              {images.length > 1 ? (
                <span className="shrink-0">
                  {previewIndex + 1} / {images.length}
                </span>
              ) : null}
              <AttachmentDownload
                attachment={previewImage}
                className="text-white/75 hover:bg-white/10 hover:text-white"
              />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}
