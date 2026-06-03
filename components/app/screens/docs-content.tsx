import { AppLink } from "@/lib/browser/app-navigation"
import { FileText } from "@phosphor-icons/react"
import { format } from "date-fns"

import {
  getProject,
  getTeam,
  getUser,
  getWorkItem,
} from "@/lib/domain/selectors"
import type {
  AppData,
  DisplayProperty,
  Document as AppDocument,
} from "@/lib/domain/types"
import { cn } from "@/lib/utils"

import { DocumentBoard } from "./collection-boards"
import type { GroupedSection } from "./grouped-sections"
import {
  getDocumentListRowMeta,
  type DocumentListRowMeta,
} from "./document-list-row-meta"
import { DocumentAuthorAvatar, DocumentContextMenu } from "./document-ui"
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
  displayProps,
  document,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  document: AppDocument
}) {
  const meta = getDocumentListRowMeta(data, document)

  return (
    <DocumentContextMenu data={data} document={document}>
      <AppLink
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
            <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
              <DocumentDisplayProperties
                data={data}
                displayProps={displayProps}
                document={document}
              />
              <DocumentListDesktopMeta meta={meta} />
            </div>
          </div>
          <DocumentListMobileMeta meta={meta} />
        </div>
      </AppLink>
    </DocumentContextMenu>
  )
}

function getDocumentKindLabel(kind: AppDocument["kind"]) {
  if (kind === "private-document") {
    return "Private"
  }

  if (kind === "team-document") {
    return "Team"
  }

  return "Workspace"
}

type DocumentPropertyLabelGetter = (
  data: AppData,
  document: AppDocument
) => string | null

function getLinkedProjectsLabel(data: AppData, document: AppDocument) {
  if (document.linkedProjectIds.length === 0) {
    return null
  }

  const [firstProjectId] = document.linkedProjectIds
  const firstProject = getProject(data, firstProjectId ?? null)
  return document.linkedProjectIds.length === 1
    ? (firstProject?.name ?? "1 project")
    : `${document.linkedProjectIds.length} projects`
}

function getLinkedItemsLabel(data: AppData, document: AppDocument) {
  if (document.linkedWorkItemIds.length === 0) {
    return null
  }

  const [firstItemId] = document.linkedWorkItemIds
  const firstItem = firstItemId ? getWorkItem(data, firstItemId) : null
  return document.linkedWorkItemIds.length === 1
    ? (firstItem?.title ?? "1 item")
    : `${document.linkedWorkItemIds.length} items`
}

const documentPropertyLabelGetters: Partial<
  Record<DisplayProperty, DocumentPropertyLabelGetter>
> = {
  kind: (_data, document) => getDocumentKindLabel(document.kind),
  team: (data, document) =>
    document.teamId
      ? (getTeam(data, document.teamId)?.name ?? "Team")
      : "Workspace",
  createdBy: (data, document) =>
    getUser(data, document.createdBy)?.name ?? "Unknown",
  updatedBy: (data, document) =>
    getUser(data, document.updatedBy)?.name ?? "Unknown",
  created: (_data, document) => format(new Date(document.createdAt), "MMM d"),
  updated: (_data, document) => format(new Date(document.updatedAt), "MMM d"),
  linkedProjects: getLinkedProjectsLabel,
  linkedItems: getLinkedItemsLabel,
}

function getDocumentPropertyLabel(
  data: AppData,
  document: AppDocument,
  property: DisplayProperty
) {
  return documentPropertyLabelGetters[property]?.(data, document) ?? null
}

function DocumentDisplayProperties({
  data,
  displayProps,
  document,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  document: AppDocument
}) {
  const labels = Array.from(
    new Set(
      Array.from(new Set(displayProps))
        .map((property) => getDocumentPropertyLabel(data, document, property))
        .filter((label): label is string => Boolean(label))
    )
  )

  if (labels.length === 0) {
    return null
  }

  return (
    <div className="flex max-w-[280px] flex-wrap items-center justify-end gap-1.5">
      {labels.map((label) => (
        <span
          key={label}
          className="rounded border border-line-soft bg-surface-2 px-1.5 py-0.5 text-[10.5px] leading-none text-fg-3"
        >
          {label}
        </span>
      ))}
    </div>
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
  displayProps,
  documents,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  documents: AppDocument[]
}) {
  return (
    <div className="flex flex-col pb-6">
      {documents.map((document) => (
        <DocumentListRow
          key={document.id}
          data={data}
          displayProps={displayProps}
          document={document}
        />
      ))}
    </div>
  )
}

function DocumentSectionHeader({
  count,
  label,
}: {
  count: number
  label: string
}) {
  return (
    <div className="sticky top-0 z-10 flex h-8 items-center gap-2 border-b border-line-soft bg-muted/60 px-7 text-[11px] font-medium text-fg-3 uppercase dark:bg-surface-2/80">
      <span>{label}</span>
      <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] leading-none">
        {count}
      </span>
    </div>
  )
}

function DocumentListSections({
  data,
  displayProps,
  sections,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  sections: GroupedSection<AppDocument>[]
}) {
  return (
    <div className="flex flex-col pb-6">
      {sections.map((section) => (
        <section key={section.key}>
          <DocumentSectionHeader
            count={section.items.length}
            label={section.label}
          />
          {section.items.map((document) => (
            <DocumentListRow
              key={document.id}
              data={data}
              displayProps={displayProps}
              document={document}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function DocumentBoardSections({
  data,
  sections,
}: {
  data: AppData
  sections: GroupedSection<AppDocument>[]
}) {
  return (
    <div className="flex flex-col pb-6">
      {sections.map((section) => (
        <section key={section.key}>
          <DocumentSectionHeader
            count={section.items.length}
            label={section.label}
          />
          <DocumentBoard data={data} documents={section.items} />
        </section>
      ))}
    </div>
  )
}

export function DocsContent({
  data,
  displayProps,
  documents,
  emptyTitle,
  hasLoadedOnce,
  layout,
  sections,
}: {
  data: AppData
  displayProps?: DisplayProperty[]
  documents: AppDocument[]
  emptyTitle: string
  hasLoadedOnce: boolean
  layout: "list" | "board"
  sections?: GroupedSection<AppDocument>[]
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

  const effectiveDisplayProps = displayProps ?? ["kind", "updatedBy", "updated"]
  const visibleSections =
    sections?.filter(
      (section) => section.items.length > 0 || sections.length > 1
    ) ?? null

  if (layout === "board") {
    if (visibleSections && visibleSections.length > 1) {
      return <DocumentBoardSections data={data} sections={visibleSections} />
    }

    return <DocumentBoard data={data} documents={documents} />
  }

  if (visibleSections && visibleSections.length > 1) {
    return (
      <DocumentListSections
        data={data}
        displayProps={effectiveDisplayProps}
        sections={visibleSections}
      />
    )
  }

  return (
    <DocumentList
      data={data}
      displayProps={effectiveDisplayProps}
      documents={documents}
    />
  )
}
