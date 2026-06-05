import { AppLink } from "@/lib/browser/app-navigation"
import type { ChangeEvent, MouseEvent } from "react"
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core"
import { SidebarSimple } from "@phosphor-icons/react"

import { StatusRing } from "@/components/ui/template-primitives"
import type { AppData, WorkItem } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

import { WorkItemSelectionCheckbox } from "../work-item-selection"
import { WorkItemAssigneeAvatar } from "../work-item-ui"

type BoardChildItemSelectionProps = {
  checked: boolean
  label: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onContextMenu: () => void
  onModifiedClick: (event: MouseEvent) => void
}

export function BoardChildItemRow({
  item,
  assignee,
  interactive,
  href,
  isDropTarget = false,
  dragAttributes,
  dragListeners,
  selection,
  onOpenProperties,
}: {
  item: WorkItem
  assignee: AppData["users"][number] | null
  interactive: boolean
  href?: string
  isDropTarget?: boolean
  dragAttributes?: DraggableAttributes
  dragListeners?: DraggableSyntheticListeners
  selection?: BoardChildItemSelectionProps
  onOpenProperties?: (itemId: string) => void
}) {
  const className = cn(
    "group/child-row relative flex cursor-grab touch-none items-center gap-2 rounded-md px-1.5 py-1 text-[12px] transition-colors hover:bg-surface-3 active:cursor-grabbing",
    selection?.checked && "bg-surface-2",
    isDropTarget && "bg-surface-3"
  )

  const content = (
    <>
      {selection ? (
        <WorkItemSelectionCheckbox
          checked={selection.checked}
          className="pointer-events-auto relative z-10"
          label={selection.label}
          onChange={selection.onChange}
        />
      ) : null}
      <StatusRing status={item.status} className="size-2.5" />
      <span className="shrink-0 text-[11px] text-fg-3">{item.key}</span>
      <span className="min-w-0 flex-1 truncate text-fg-2">{item.title}</span>
      {assignee ? (
        <WorkItemAssigneeAvatar user={assignee} className="size-4" />
      ) : null}
      {onOpenProperties ? (
        <button
          type="button"
          aria-label={`Open properties for ${item.title}`}
          title="Open properties"
          className="pointer-events-auto grid size-5 shrink-0 place-items-center rounded-sm text-fg-3 opacity-0 transition-opacity hover:bg-surface-3 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none group-hover/child-row:opacity-100"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenProperties(item.id)
          }}
        >
          <SidebarSimple className="size-4" />
        </button>
      ) : null}
    </>
  )

  if (!interactive || !href) {
    return (
      <div
        className={className}
        onClickCapture={selection?.onModifiedClick}
        onContextMenu={selection?.onContextMenu}
      >
        {content}
      </div>
    )
  }

  return (
    <div
      className={className}
      onClickCapture={selection?.onModifiedClick}
      onContextMenu={selection?.onContextMenu}
      {...dragAttributes}
      {...dragListeners}
    >
      <AppLink
        href={href}
        aria-label={`Open ${item.title}`}
        className="absolute inset-0 rounded-md focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
      />
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-2">
        {content}
      </div>
    </div>
  )
}
