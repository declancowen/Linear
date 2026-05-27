import { AppLink } from "@/lib/browser/app-navigation"
import {
  memo,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

import { getItemAssignees } from "@/lib/domain/selectors"
import type { AppData, WorkItem } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

import { IssueContextMenu } from "../work-item-menus"
import { WorkItemTypeBadge } from "../work-item-ui"
import {
  getEventAccent,
  getEventAccentStyle,
  type EventAccentLabelLookup,
  type EventAccentMode,
} from "./event-accent"
import { TIMELINE_ITEM_ROW_HEIGHT_CLASS } from "./timeline-constants"

function getTimelineBarStyle(
  item: WorkItem,
  accentMode: EventAccentMode,
  fallbackIndex: number,
  labelsById: EventAccentLabelLookup | null
): CSSProperties {
  const accent = getEventAccent(item, accentMode, fallbackIndex, labelsById)
  return getEventAccentStyle(accent)
}

export const TimelineLabelRow = memo(function TimelineLabelRow({
  data,
  item,
  accentMode,
  accentIndex,
  labelsById,
  onSelectItem,
}: {
  data: AppData
  item: WorkItem
  accentMode: EventAccentMode
  accentIndex: number
  labelsById: EventAccentLabelLookup | null
  onSelectItem?: (itemId: string) => void
}) {
  const assignees = getItemAssignees(data, [item])
  const style = getTimelineBarStyle(item, accentMode, accentIndex, labelsById)

  return (
    <IssueContextMenu data={data} item={item} onEditItem={onSelectItem}>
      <div
        className={cn(
          "flex items-center gap-2.5 border-b bg-background px-3",
          TIMELINE_ITEM_ROW_HEIGHT_CLASS
        )}
      >
        <div
          className="size-2 shrink-0 rounded-full"
          style={{ ...style, background: "var(--cal-accent)" }}
        />
        <div className="min-w-0 flex-1">
          <AppLink
            className="block truncate text-xs hover:underline"
            href={`/items/${item.id}`}
            onClick={(event) => {
              if (!onSelectItem) {
                return
              }

              event.preventDefault()
              onSelectItem(item.id)
            }}
          >
            {item.title}
          </AppLink>
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
})

export const TimelineBarPreview = memo(function TimelineBarPreview({
  item,
  span,
  accentMode,
  accentIndex,
  labelsById,
}: {
  item: WorkItem
  span: number
  accentMode: EventAccentMode
  accentIndex: number
  labelsById: EventAccentLabelLookup | null
}) {
  const style = getTimelineBarStyle(item, accentMode, accentIndex, labelsById)

  return (
    <div
      className="relative flex h-full w-full items-center overflow-hidden rounded-md bg-[color:var(--cal-accent-tint)] pr-2 pl-[14px] text-left text-[11px] font-medium text-foreground shadow-sm"
      style={style}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-[color:var(--cal-accent)]"
      />
      <span className="truncate">{span >= 3 ? item.title : item.key}</span>
    </div>
  )
})

export const TimelineBar = memo(function TimelineBar({
  data,
  item,
  span,
  accentMode,
  accentIndex,
  labelsById,
  onCaptureDragOffset,
  onResizeStart,
  onSelectItem,
}: {
  data: AppData
  item: WorkItem
  span: number
  accentMode: EventAccentMode
  accentIndex: number
  labelsById: EventAccentLabelLookup | null
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
  onSelectItem?: (itemId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
    })
  const style = getTimelineBarStyle(item, accentMode, accentIndex, labelsById)
  const pointerDownPositionRef = useRef<{
    pointerId: number
    x: number
    y: number
  } | null>(null)
  const didSelectOnPointerUpRef = useRef(false)
  const clearWindowPointerListenersRef = useRef<(() => void) | null>(null)

  function clearWindowPointerListeners() {
    clearWindowPointerListenersRef.current?.()
    clearWindowPointerListenersRef.current = null
  }

  useEffect(() => clearWindowPointerListeners, [])

  function didPointerMovePastClickThreshold(clientX: number, clientY: number) {
    const pointerDownPosition = pointerDownPositionRef.current

    return (
      pointerDownPosition !== null &&
      (Math.abs(clientX - pointerDownPosition.x) > 4 ||
        Math.abs(clientY - pointerDownPosition.y) > 4)
    )
  }

  function isResizeHandleEventTarget(target: EventTarget | null) {
    return (
      target instanceof Element &&
      target.closest("[data-timeline-resize-handle]") !== null
    )
  }

  function isPrimaryPointerButton(event: ReactPointerEvent<HTMLButtonElement>) {
    return event.button === 0
  }

  function selectItemFromPointerRelease(input: {
    clientX: number
    clientY: number
    pointerId: number
  }) {
    const pointerDownPosition = pointerDownPositionRef.current

    if (
      pointerDownPosition === null ||
      pointerDownPosition.pointerId !== input.pointerId
    ) {
      return
    }

    clearWindowPointerListeners()

    if (didPointerMovePastClickThreshold(input.clientX, input.clientY)) {
      pointerDownPositionRef.current = null
      return
    }

    didSelectOnPointerUpRef.current = true
    pointerDownPositionRef.current = null
    onSelectItem?.(item.id)
  }

  function registerWindowPointerReleaseListener(pointerId: number) {
    clearWindowPointerListeners()

    const handlePointerUp = (event: PointerEvent) => {
      selectItemFromPointerRelease({
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId,
      })
    }
    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) {
        return
      }

      clearWindowPointerListeners()
      pointerDownPositionRef.current = null
    }

    window.addEventListener("pointerup", handlePointerUp, {
      capture: true,
      once: true,
    })
    window.addEventListener("pointercancel", handlePointerCancel, {
      capture: true,
      once: true,
    })
    clearWindowPointerListenersRef.current = () => {
      window.removeEventListener("pointerup", handlePointerUp, {
        capture: true,
      })
      window.removeEventListener("pointercancel", handlePointerCancel, {
        capture: true,
      })
    }
  }

  function selectItemFromPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (
      !isPrimaryPointerButton(event) ||
      isResizeHandleEventTarget(event.target)
    ) {
      clearWindowPointerListeners()
      pointerDownPositionRef.current = null
      return
    }

    selectItemFromPointerRelease({
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
    })
  }

  return (
    <IssueContextMenu data={data} item={item} onEditItem={onSelectItem}>
      <button
        ref={setNodeRef}
        type="button"
        className={cn(
          "group/timeline-bar relative flex h-full w-full items-center overflow-hidden rounded-md bg-[color:var(--cal-accent-tint)] pr-2 pl-[14px] text-left text-[11px] font-medium text-foreground shadow-sm transition-[background-color,box-shadow] hover:bg-[color:var(--cal-accent-tint-hover)] hover:shadow-md",
          isDragging && "opacity-0"
        )}
        style={{
          ...style,
          transform: isDragging ? undefined : CSS.Translate.toString(transform),
        }}
        onClick={(event) => {
          if (didSelectOnPointerUpRef.current) {
            didSelectOnPointerUpRef.current = false
            return
          }

          if (didPointerMovePastClickThreshold(event.clientX, event.clientY)) {
            pointerDownPositionRef.current = null
            return
          }

          onSelectItem?.(item.id)
        }}
        onPointerDownCapture={(event) => {
          if (
            !isPrimaryPointerButton(event) ||
            isResizeHandleEventTarget(event.target)
          ) {
            pointerDownPositionRef.current = null
            return
          }

          pointerDownPositionRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          }
          registerWindowPointerReleaseListener(event.pointerId)
          onCaptureDragOffset(item, span, event)
        }}
        onPointerUpCapture={selectItemFromPointerUp}
        {...listeners}
        {...attributes}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-[color:var(--cal-accent)]"
        />
        <span
          data-timeline-resize-handle="start"
          className="absolute inset-y-0 left-0 z-10 w-2.5 cursor-ew-resize opacity-0 transition-opacity group-hover/timeline-bar:opacity-100 hover:bg-black/10"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onResizeStart(item, "start", event.clientX)
          }}
        />
        <span className="truncate">{span >= 3 ? item.title : item.key}</span>
        <span
          data-timeline-resize-handle="end"
          className="absolute inset-y-0 right-0 z-10 w-2.5 cursor-ew-resize opacity-0 transition-opacity group-hover/timeline-bar:opacity-100 hover:bg-black/10"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onResizeStart(item, "end", event.clientX)
          }}
        />
      </button>
    </IssueContextMenu>
  )
})
