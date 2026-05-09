import Link from "next/link"
import { FileText } from "@phosphor-icons/react"

import type { AppData, Document as AppDocument } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

import { DocumentBoard } from "./collection-boards"
import {
  getDocumentListRowMeta,
  type DocumentListRowMeta,
} from "./document-list-row-meta"
import {
  DocumentAuthorAvatar,
  DocumentContextMenu,
} from "./document-ui"
import { MissingState } from "./shared"
import { ScopedScreenLoading } from "./scoped-screen-loading"

const DOC_ACCENT = "oklch(0.6 0.09 240)"

function DocumentIconTile({ size = "md" }: { size?: "md" | "lg" }) {
  const tile = size === "lg" ? "size-9 rounded-lg" : "size-7 rounded-md"
  const icon = size === "lg" ? "size-4" : "size-3.5"
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center border", tile)}
      style={{
        background: `color-mix(in oklch, ${DOC_ACCENT} 12%, var(--surface))`,
        borderColor: `color-mix(in oklch, ${DOC_ACCENT} 28%, transparent)`,
        color: DOC_ACCENT,
      }}
    >
      <FileText className={icon} />
    </span>
  )
}

function DocumentListRow({
  data,
  document,
}: {
  data: AppData
  document: AppDocument
}) {
  const meta = getDocumentListRowMeta(data, document)

  return (
    <DocumentContextMenu data={data} document={document}>
      <Link
        className="group flex items-start gap-3 border-b border-line-soft px-7 py-3 transition-colors hover:bg-surface-2"
        href={`/docs/${document.id}`}
      >
        <DocumentIconTile />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="truncate text-[13.5px] leading-[1.3] font-medium text-foreground group-hover:underline">
                {document.title}
              </span>
              <DocumentListPreview preview={meta.preview} />
            </div>
            <DocumentListDesktopMeta meta={meta} />
          </div>
          <DocumentListMobileMeta meta={meta} />
        </div>
      </Link>
    </DocumentContextMenu>
  )
}

function DocumentListPreview({ preview }: { preview: string }) {
  if (!preview) {
    return <p className="mt-0.5 text-[12px] text-fg-4 italic">No content yet</p>
  }

  return (
    <p className="mt-0.5 line-clamp-1 text-[12px] leading-[1.4] text-fg-3">
      {preview}
    </p>
  )
}

function DocumentListDesktopMeta({ meta }: { meta: DocumentListRowMeta }) {
  return (
    <div className="hidden shrink-0 items-center gap-2 text-[11.5px] text-fg-3 sm:flex">
      <DocumentAuthorAvatar
        avatarImageUrl={meta.authorAvatarImageUrl}
        avatarUrl={meta.authorAvatarUrl}
        name={meta.authorName}
        size="xs"
      />
      <span className="max-w-[120px] truncate">{meta.authorName}</span>
      <span aria-hidden className="size-1 rounded-full bg-line-soft" />
      <span className="tabular-nums">{meta.updated}</span>
    </div>
  )
}

function DocumentListMobileMeta({ meta }: { meta: DocumentListRowMeta }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-fg-3 sm:hidden">
      <span className="truncate">{meta.authorName}</span>
      <span aria-hidden className="size-1 rounded-full bg-line-soft" />
      <span className="tabular-nums">{meta.updated}</span>
    </div>
  )
}

function DocumentList({
  data,
  documents,
}: {
  data: AppData
  documents: AppDocument[]
}) {
  return (
    <div className="flex flex-col pb-6">
      {documents.map((document) => (
        <DocumentListRow key={document.id} data={data} document={document} />
      ))}
    </div>
  )
}

export function DocsContent({
  data,
  documents,
  emptyTitle,
  hasLoadedOnce,
  layout,
}: {
  data: AppData
  documents: AppDocument[]
  emptyTitle: string
  hasLoadedOnce: boolean
  layout: "list" | "board"
}) {
  if (!hasLoadedOnce && documents.length === 0) {
    return <ScopedScreenLoading label="Loading documents..." />
  }

  if (documents.length === 0) {
    return (
      <MissingState
        icon={FileText}
        title={emptyTitle}
        subtitle="Capture decisions, briefs, and notes that link back to the work."
      />
    )
  }

  if (layout === "board") {
    return <DocumentBoard data={data} documents={documents} />
  }

  return <DocumentList data={data} documents={documents} />
}
