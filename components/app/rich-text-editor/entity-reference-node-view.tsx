"use client"

import { useState } from "react"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { TextAlignLeft, Cards, type Icon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { useShallow } from "zustand/react/shallow"

import { useAppRouter } from "@/lib/browser/app-navigation"
import { ProjectIconGlyph } from "@/components/app/entity-icons"
import { PhosphorIconGlyph } from "@/components/app/phosphor-icon-picker"
import { resolveEntityReferenceNodeAttrs } from "@/lib/content/rich-text-references"
import { getReferenceTypeIcon } from "@/components/app/rich-text-editor/reference-icons"
import { getViewHref, getViewIconName } from "@/lib/domain/default-views"
import {
  getDocument,
  getProject,
  getProjectHref,
  getWorkItem,
} from "@/lib/domain/selectors"
import {
  projectStatusMeta,
  statusMeta,
  type AppData,
  type Project,
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
  href: string | null
  project: Project | null
  viewIcon: string | null
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
    subtitle: document ? document.previewText?.trim() || null : null,
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
    subtitle: project
      ? (projectStatusMeta[project.status]?.label ?? null)
      : null,
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

function resolveEntityReferenceTarget(
  data: AppData,
  referenceType: string,
  referenceId: string,
  accessible: boolean
): Pick<EntityReferencePreview, "href" | "project" | "viewIcon"> {
  if (referenceType === "workItem") {
    return {
      href: accessible ? `/items/${referenceId}` : null,
      project: null,
      viewIcon: null,
    }
  }

  if (referenceType === "document") {
    return {
      href: accessible ? `/docs/${referenceId}` : null,
      project: null,
      viewIcon: null,
    }
  }

  if (referenceType === "project") {
    const project = getProject(data, referenceId)
    return {
      href: project
        ? (getProjectHref(data, project) ?? `/projects/${project.id}`)
        : null,
      project,
      viewIcon: null,
    }
  }

  const view =
    referenceType === "view"
      ? (data.views.find((entry) => entry.id === referenceId) ?? null)
      : null

  return {
    href: view ? getViewHref(view) : null,
    project: null,
    viewIcon: view ? getViewIconName(view) : null,
  }
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
  const target = resolveEntityReferenceTarget(
    data,
    referenceType,
    referenceId,
    details.accessible
  )

  return {
    icon: getReferenceTypeIcon(referenceType),
    typeLabel: getReferenceTypeLabel(referenceType),
    ...target,
    ...details,
  }
}

function EntityReferenceIcon({
  preview,
  className,
}: {
  preview: EntityReferencePreview
  className: string
}) {
  if (preview.project) {
    return <ProjectIconGlyph project={preview.project} className={className} />
  }

  if (preview.viewIcon) {
    return <PhosphorIconGlyph icon={preview.viewIcon} className={className} />
  }

  const TypeIcon = preview.icon
  return <TypeIcon className={className} />
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
      className="absolute right-0 bottom-full z-20 mb-1 inline-flex items-center gap-0.5 rounded-md border border-line bg-surface px-0.5 py-0.5 shadow-sm"
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
  const router = useAppRouter()

  const { referenceType, referenceId, label, display } =
    resolveEntityReferenceNodeAttrs(node.attrs)

  const preview = useAppStore(
    useShallow((state) =>
      buildEntityReferencePreview(state, referenceType, referenceId, label)
    )
  )
  const canSwitch = editor.isEditable

  const showSwitcher = canSwitch && hovered
  const openReference = () => {
    if (!preview.href) {
      toast.error("You do not have access to this reference")
      return
    }

    router.push(preview.href)
  }

  return (
    <NodeViewWrapper
      as="span"
      data-entity-reference-node-view=""
      className="relative inline-flex max-w-full align-baseline"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {display === "preview" ? (
        <button
          type="button"
          contentEditable={false}
          className="my-1 inline-flex w-full max-w-[22rem] items-start gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-left align-top transition-colors hover:bg-surface-3"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openReference}
        >
          <span className="mt-0.5 inline-grid size-5 shrink-0 place-items-center rounded text-fg-3">
            <EntityReferenceIcon preview={preview} className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium text-foreground">
              {preview.title}
            </span>
            <span className="truncate text-[11.5px] text-fg-3">
              {preview.subtitle ?? preview.typeLabel}
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          contentEditable={false}
          className={cn(
            "editor-reference",
            `editor-reference-${referenceType}`,
            "editor-reference-resolved-icon"
          )}
          data-reference-type={referenceType}
          onMouseDown={(event) => event.preventDefault()}
          onClick={openReference}
        >
          <EntityReferenceIcon
            preview={preview}
            className="size-3.5 shrink-0"
          />
          {label}
        </button>
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
