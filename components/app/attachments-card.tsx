"use client"

import { useRef, useState } from "react"
import {
  DownloadSimple,
  File,
  FileImage,
  Paperclip,
  Trash,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { useShallow } from "zustand/react/shallow"

import { getAttachmentsForTarget } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function formatFileSize(size: number) {
  const units = ["B", "KB", "MB", "GB"]
  let value = size
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`
}

export function AttachmentsCard({
  targetType,
  targetId,
  editable,
}: {
  targetType: "workItem" | "document"
  targetId: string
  editable: boolean
}) {
  const attachments = useAppStore(
    useShallow((state) => getAttachmentsForTarget(state, targetType, targetId))
  )
  const users = useAppStore(useShallow((state) => state.users))
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0]

    if (!file) {
      return
    }

    setUploading(true)
    await useAppStore.getState().uploadAttachment(targetType, targetId, file)
    setUploading(false)

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Attachments</CardTitle>
            <CardDescription>
              Stored in Convex and available from both the web app and Electron
              wrapper.
            </CardDescription>
          </div>
          {editable ? (
            <>
              <input
                ref={inputRef}
                className="hidden"
                type="file"
                onChange={(event) => void handleFiles(event.target.files)}
              />
              <Button
                disabled={uploading}
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                <Paperclip />
                {uploading ? "Uploading…" : "Attach file"}
              </Button>
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {attachments.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            No files attached yet.
          </div>
        ) : (
          attachments.map((attachment) => {
            const uploader =
              users.find((user) => user.id === attachment.uploadedBy) ?? null
            const isImage = attachment.contentType.startsWith("image/")

            return (
              <div
                key={attachment.id}
                className="flex flex-col gap-3 rounded-xl border px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                      {isImage ? <FileImage /> : <File />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {attachment.fileName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)} ·{" "}
                        {attachment.contentType}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Uploaded by {uploader?.name ?? "Unknown"} ·{" "}
                        {format(
                          new Date(attachment.createdAt),
                          "MMM d, h:mm a"
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {attachment.fileUrl ? (
                      <Button asChild size="icon-sm" variant="ghost">
                        <a
                          href={attachment.fileUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <DownloadSimple />
                          <span className="sr-only">Download attachment</span>
                        </a>
                      </Button>
                    ) : null}
                    {editable ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() =>
                          void useAppStore
                            .getState()
                            .deleteAttachment(attachment.id)
                        }
                      >
                        <Trash />
                        <span className="sr-only">Delete attachment</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
                {isImage && attachment.fileUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={attachment.fileName}
                    className="max-h-52 rounded-xl border object-cover"
                    src={attachment.fileUrl}
                  />
                ) : null}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
