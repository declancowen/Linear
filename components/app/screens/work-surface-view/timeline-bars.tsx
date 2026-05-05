import Link from "next/link"
import { type PointerEvent as ReactPointerEvent } from "react"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

import { getItemAssignees } from "@/lib/domain/selectors"
import type { AppData, WorkItem } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

import { IssueContextMenu } from "../work-item-menus"
import { WorkItemTypeBadge } from "../work-item-ui"
import { TIMELINE_ITEM_ROW_HEIGHT_CLASS } from "./timeline-constants"

export function TimelineLabelRow({
  data,
  item,
}: {
  data: AppData
  item: WorkItem
}) {
  const assignees = getItemAssignees(data, [item])

  return (
    <IssueContextMenu data={data} item={item}>
      <div
        className={cn(
          "flex items-center gap-2.5 border-b bg-background px-3",
          TIMELINE_ITEM_ROW_HEIGHT_CLASS
        )}
      >
        <div
          className={cn(
            "size-2 shrink-0 rounded-full",
            item.status === "done"
              ? "bg-green-500"
              : item.status === "in-progress"
                ? "bg-blue-500"
                : item.status === "cancelled"
                  ? "bg-red-500"
                  : "bg-muted-foreground/30"
          )}
        />
        <div className="min-w-0 flex-1">
          <Link
            className="block truncate text-xs hover:underline"
            href={`/items/${item.id}`}
          >
            {item.title}
          </Link>
        </div>
        <WorkItemTypeBadge data={data} item={item} className="shrink-0" />
        {assignees[0] ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {assignees[0].name.split(" ")[0]}
          </span>
        ) : null}
      </div>
    </IssueContextMenu>
  )
}

const barColors: Record<string, string> = {
  backlog: "bg-muted-foreground/20 text-foreground",
  todo: "bg-muted-foreground/30 text-foreground",
  "in-progress": "bg-blue-500/90 text-white",
  "in-review": "bg-violet-500/90 text-white",
  done: "bg-green-500/80 text-white",
  cancelled: "bg-red-400/60 text-white",
}

export function TimelineBarPreview({
  item,
  span,
}: {
  item: WorkItem
  span: number
}) {
  const colorClass =
    barColors[item.status] ?? "bg-primary text-primary-foreground"

  return (
    <div
      className={cn(
        "flex h-full w-full items-center rounded-[5px] px-2 text-left text-[11px] font-medium shadow-sm",
        colorClass
      )}
    >
      <span className="truncate">{span >= 3 ? item.title : item.key}</span>
    </div>
  )
}

export function TimelineBar({
  data,
  item,
  span,
  onCaptureDragOffset,
  onResizeStart,
}: {
  data: AppData
  item: WorkItem
  span: number
  onCaptureDragOffset: (
    item: WorkItem,
    span: number,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void
  onResizeStart: (
    item: WorkItem,
    edge: "start" | "end",
    clientX: number
  ) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
    })

  const colorClass =
    barColors[item.status] ?? "bg-primary text-primary-foreground"

  return (
    <IssueContextMenu data={data} item={item}>
      <button
        ref={setNodeRef}
        type="button"
        className={cn(
          "group/timeline-bar relative flex h-full w-full items-center rounded-[5px] px-2 text-left text-[11px] font-medium shadow-sm transition-shadow hover:shadow-md",
          isDragging && "opacity-0",
          colorClass
        )}
        style={{
          transform: isDragging ? undefined : CSS.Translate.toString(transform),
        }}
        onPointerDownCapture={(event) => onCaptureDragOffset(item, span, event)}
        {...listeners}
        {...attributes}
      >
        <span
          data-timeline-resize-handle="start"
          className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize rounded-l-[5px] opacity-0 transition-opacity group-hover/timeline-bar:opacity-100 hover:bg-black/10"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onResizeStart(item, "start", event.clientX)
          }}
        />
        <span className="truncate">{span >= 3 ? item.title : item.key}</span>
        <span
          data-timeline-resize-handle="end"
          className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize rounded-r-[5px] opacity-0 transition-opacity group-hover/timeline-bar:opacity-100 hover:bg-black/10"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onResizeStart(item, "end", event.clientX)
          }}
        />
      </button>
    </IssueContextMenu>
  )
}
