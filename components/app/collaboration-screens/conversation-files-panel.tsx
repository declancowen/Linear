"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { ArrowSquareOut, DownloadSimple } from "@phosphor-icons/react"

import { parseHtmlDocument } from "@/lib/content/html-parsing"
import {
  getAttachmentFileKind,
  type AttachmentFileKind,
} from "@/lib/domain/file-uploads"
import { cn } from "@/lib/utils"

type ConversationContentEntry = {
  content: string
  createdAt: string
}

type ConversationFile = {
  url: string
  fileName: string
  kind: AttachmentFileKind
  createdAt: string
}

const ATTACHMENT_KIND_LABEL: Record<AttachmentFileKind, string> = {
  excel: "Excel",
  file: "File",
  image: "Image",
  pdf: "PDF",
  powerpoint: "PowerPoint",
  word: "Word",
}

function getFileTypeLabel(fileName: string, kind: AttachmentFileKind) {
  const extension = fileName.includes(".")
    ? fileName.split(".").pop()?.trim()
    : ""

  return extension ? extension.toUpperCase() : ATTACHMENT_KIND_LABEL[kind]
}

export function ConversationTabBar({
  activeTab,
  className,
  onTabChange,
}: {
  activeTab: "chat" | "files"
  className?: string
  onTabChange: (tab: "chat" | "files") => void
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {(["chat", "files"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[12.5px] font-medium capitalize transition-colors",
            activeTab === tab
              ? "bg-surface-3 text-foreground"
              : "text-fg-3 hover:text-foreground"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

function collectConversationFiles(
  entries: ConversationContentEntry[]
): ConversationFile[] {
  const byUrl = new Map<string, ConversationFile>()

  for (const { content, createdAt } of entries) {
    if (!content) {
      continue
    }

    const doc = parseHtmlDocument(content)

    doc.querySelectorAll('a[data-type="attachment"]').forEach((anchor) => {
      const url = anchor.getAttribute("href")

      if (!url || byUrl.has(url)) {
        return
      }

      const fileName =
        anchor.getAttribute("data-file-name") ||
        anchor.textContent?.trim() ||
        "Attachment"

      byUrl.set(url, {
        url,
        fileName,
        kind:
          (anchor.getAttribute("data-attachment-kind") as AttachmentFileKind) ||
          getAttachmentFileKind(fileName, null),
        createdAt,
      })
    })

    doc.querySelectorAll("img.editor-image").forEach((image) => {
      const url = image.getAttribute("src")

      if (!url || byUrl.has(url)) {
        return
      }

      byUrl.set(url, {
        url,
        fileName:
          image.getAttribute("alt") || image.getAttribute("title") || "Image",
        kind: "image",
        createdAt,
      })
    })
  }

  return [...byUrl.values()]
}

export function ConversationFilesPanel({
  entries,
}: {
  entries: ConversationContentEntry[]
}) {
  const files = useMemo(() => collectConversationFiles(entries), [entries])

  if (files.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-[13px] text-fg-3">
        No files have been shared here yet.
      </div>
    )
  }

  return (
    <div className="tiptap min-h-0 flex-1 overflow-y-auto px-4 py-1">
      {files.map((file) => (
        <div
          key={file.url}
          className="flex items-center gap-3 border-b border-line-soft py-2 last:border-b-0"
        >
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="editor-attachment min-w-0 text-[12.5px]"
            data-type="attachment"
            data-attachment-kind={file.kind}
            data-file-name={file.fileName}
          >
            <span className="truncate">{file.fileName}</span>
          </a>
          <span className="shrink-0 text-[11px] text-fg-3">
            {format(new Date(file.createdAt), "MMM d, h:mm a")} ·{" "}
            {getFileTypeLabel(file.fileName, file.kind)}
          </span>
          <span className="flex-1" />
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${file.fileName}`}
            className="inline-grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <ArrowSquareOut className="size-4" />
          </a>
          <a
            href={file.url}
            download={file.fileName}
            aria-label={`Download ${file.fileName}`}
            className="inline-grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <DownloadSimple className="size-4" />
          </a>
        </div>
      ))}
    </div>
  )
}
