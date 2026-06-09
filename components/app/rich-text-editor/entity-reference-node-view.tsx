"use client"

import { useState } from "react"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import {
  CheckSquare,
  FileText,
  FolderSimple,
  SquaresFour,
  TextAlignLeft,
  Cards,
  type Icon,
} from "@phosphor-icons/react"

import { useShallow } from "zustand/react/shallow"

import { resolveEntityReferenceNodeAttrs } from "@/lib/content/rich-text-references"
import {
  getDocument,
  getProject,
  getWorkItem,
} from "@/lib/domain/selectors"
import {
  projectStatusMeta,
  statusMeta,
  type AppData,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"

type ReferenceDisplay = "inline" | "preview"

type EntityReferencePreview = {
  icon: Icon
  typeLabel: string
  title: string
  subtitle: string | null
  accessible: boolean
}

const REFERENCE_TYPE_ICON: Record<string, Icon> = {
  workItem: CheckSquare,
  document: FileText,
  project: FolderSimple,
  view: SquaresFour,
}

function getReferenceTypeLabel(referenceType: string) {
  switch (referenceType) {
    case "document":
      return "Document"
    case "project":
      return "Project"
    case "view":
      return "View"
    default:
      return "Work item"
  }
}

type ReferenceDetails = {
  title: string
  subtitle: string | null
  accessible: boolean
}

type ReferenceDetailResolver = (
  data: AppData,
  referenceId: string,
  fallbackLabel: string
) => ReferenceDetails

function resolveWorkItemReferenceDetails(
  data: AppData,
  referenceId: string,
  fallbackLabel: string
): ReferenceDetails {
  const item = getWorkItem(data, referenceId)
  return {
    title: item?.title?.trim() || item?.key || fallbackLabel,
    subtitle: item
      ? [item.key, statusMeta[item.status]?.label].filter(Boolean).join(" · ")
      : null,
    accessible: Boolean(item),
  }
}

function resolveDocumentReferenceDetails(
  data: AppData,
  referenceId: string,
  fallbackLabel: string
): ReferenceDetails {
  const document = getDocument(data, referenceId)
  return {
    title: document?.title?.trim() || fallbackLabel,
    subtitle: document ? (document.previewText?.trim() || null) : null,
    accessible: Boolean(document),
  }
}

function resolveProjectReferenceDetails(
  data: AppData,
  referenceId: string,
  fallbackLabel: string
): ReferenceDetails {
  const project = getProject(data, referenceId)
  return {
    title: project?.name?.trim() || fallbackLabel,
    subtitle: project ? (projectStatusMeta[project.status]?.label ?? null) : null,
    accessible: Boolean(project),
  }
}

function resolveViewReferenceDetails(
  data: AppData,
  referenceId: string,
  fallbackLabel: string
): ReferenceDetails {
  const view = data.views.find((entry) => entry.id === referenceId) ?? null
  return {
    title: view?.name?.trim() || fallbackLabel,
    subtitle: view ? `${view.entityKind} view` : null,
    accessible: Boolean(view),
  }
}

const REFERENCE_DETAIL_RESOLVERS: Record<string, ReferenceDetailResolver> = {
  workItem: resolveWorkItemReferenceDetails,
  document: resolveDocumentReferenceDetails,
  project: resolveProjectReferenceDetails,
  view: resolveViewReferenceDetails,
}

function buildEntityReferencePreview(
  data: AppData,
  referenceType: string,
  referenceId: string,
  fallbackLabel: string
): EntityReferencePreview {
  const resolveDetails = REFERENCE_DETAIL_RESOLVERS[referenceType]
  const details: ReferenceDetails = resolveDetails
    ? resolveDetails(data, referenceId, fallbackLabel)
    : { title: fallbackLabel, subtitle: null, accessible: false }

  return {
    icon: REFERENCE_TYPE_ICON[referenceType] ?? CheckSquare,
    typeLabel: getReferenceTypeLabel(referenceType),
    ...details,
  }
}

function ReferenceDisplaySwitcher({
  display,
  onChange,
}: {
  display: ReferenceDisplay
  onChange: (next: ReferenceDisplay) => void
}) {
  return (
    <span
      contentEditable={false}
      className="absolute -top-2 right-1 z-10 inline-flex items-center gap-0.5 rounded-md border border-line bg-surface px-0.5 py-0.5 shadow-sm"
      // Keep the editor selection intact when interacting with the switcher.
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        aria-label="Show as inline reference"
        aria-pressed={display === "inline"}
        title="Inline"
        className={cn(
          "inline-grid size-5 place-items-center rounded text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
          display === "inline" && "bg-surface-3 text-foreground"
        )}
        onClick={() => onChange("inline")}
      >
        <TextAlignLeft className="size-3" />
      </button>
      <button
        type="button"
        aria-label="Show as preview"
        aria-pressed={display === "preview"}
        title="Preview"
        className={cn(
          "inline-grid size-5 place-items-center rounded text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
          display === "preview" && "bg-surface-3 text-foreground"
        )}
        onClick={() => onChange("preview")}
      >
        <Cards className="size-3" />
      </button>
    </span>
  )
}

export function EntityReferenceNodeView({
  node,
  updateAttributes,
  editor,
}: NodeViewProps) {
  const [hovered, setHovered] = useState(false)

  const { referenceType, referenceId, label, display } =
    resolveEntityReferenceNodeAttrs(node.attrs)

  const preview = useAppStore(
    useShallow((state) =>
      buildEntityReferencePreview(state, referenceType, referenceId, label)
    )
  )
  const PreviewIcon = preview.icon
  const canSwitch = editor.isEditable

  const showSwitcher = canSwitch && hovered

  return (
    <NodeViewWrapper
      as="span"
      data-entity-reference-node-view=""
      className="relative inline-flex max-w-full align-baseline"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {display === "preview" ? (
        <span className="my-1 inline-flex w-full max-w-[22rem] items-start gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-left align-top">
          <span className="mt-0.5 inline-grid size-5 shrink-0 place-items-center rounded text-fg-3">
            <PreviewIcon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium text-foreground">
              {preview.title}
            </span>
            <span className="truncate text-[11.5px] text-fg-3">
              {preview.subtitle ?? preview.typeLabel}
            </span>
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "editor-reference",
            `editor-reference-${referenceType}`
          )}
          data-reference-type={referenceType}
        >
          {label}
        </span>
      )}
      {showSwitcher ? (
        <ReferenceDisplaySwitcher
          display={display}
          onChange={(next) => updateAttributes({ display: next })}
        />
      ) : null}
    </NodeViewWrapper>
  )
}
