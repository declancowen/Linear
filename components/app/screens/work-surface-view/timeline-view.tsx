"use client"

import Link from "next/link"
import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
} from "react"
import { CSS } from "@dnd-kit/utilities"
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core"
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  format,
  startOfDay,
  subDays,
} from "date-fns"

import { buildItemGroups, getItemAssignees } from "@/lib/domain/selectors"
import type { AppData, ViewDefinition, WorkItem } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"

import { WorkItemTypeBadge } from "../work-item-ui"
import { IssueContextMenu } from "../work-item-menus"
import { getGroupValueAdornment, getGroupValueLabel } from "./shared"

type TimelineRangeDraft = {
  itemId: string
  startDate: Date
  endDate: Date
}

const TIMELINE_HEADER_TOP_ROW_HEIGHT = 32
const TIMELINE_HEADER_BOTTOM_ROW_HEIGHT = 32
const TIMELINE_HEADER_TOP_ROW_HEIGHT_CLASS = "h-8"
const TIMELINE_HEADER_BOTTOM_ROW_HEIGHT_CLASS = "h-8"
const TIMELINE_GROUP_ROW_HEIGHT_CLASS = "h-10"
const TIMELINE_ITEM_ROW_HEIGHT_CLASS = "h-9"

function parseDateOnlyValue(value: string | null | undefined, fallback: Date) {
  if (!value) {
    return startOfDay(fallback)
  }

  return startOfDay(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function toDateOnlyIsoString(date: Date) {
  return `${format(startOfDay(date), "yyyy-MM-dd")}T00:00:00.000Z`
}

function getTimelineRange(item: WorkItem, fallback: Date) {
  const startDate = parseDateOnlyValue(
    item.startDate ?? item.targetDate ?? item.dueDate,
    fallback
  )
  const rawEndDate = parseDateOnlyValue(
    item.targetDate ?? item.dueDate ?? item.startDate,
    fallback
  )

  return {
    startDate,
    endDate:
      rawEndDate.getTime() < startDate.getTime() ? startDate : rawEndDate,
  }
}

function buildTimelineMovePatch(
  item: WorkItem,
  nextStartDate: Date,
  fallback: Date
) {
  const { startDate } = getTimelineRange(item, fallback)
  const delta = differenceInCalendarDays(nextStartDate, startDate)

  return {
    startDate: toDateOnlyIsoString(nextStartDate),
    dueDate: item.dueDate
      ? toDateOnlyIsoString(
          addDays(parseDateOnlyValue(item.dueDate, fallback), delta)
        )
      : undefined,
    targetDate: item.targetDate
      ? toDateOnlyIsoString(
          addDays(parseDateOnlyValue(item.targetDate, fallback), delta)
        )
      : undefined,
  }
}

function buildTimelineResizePatch(
  item: WorkItem,
  nextStartDate: Date,
  nextEndDate: Date
) {
  return {
    startDate: toDateOnlyIsoString(nextStartDate),
    dueDate: item.dueDate ? toDateOnlyIsoString(nextEndDate) : undefined,
    targetDate:
      item.targetDate || !item.dueDate
        ? toDateOnlyIsoString(nextEndDate)
        : undefined,
  }
}

export function TimelineView({
  data,
  items,
  view,
  editable,
}: {
  data: AppData
  items: WorkItem[]
  view: ViewDefinition
  editable: boolean
}) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [labelColWidth, setLabelColWidth] = useState(224)
  const [resizeDraft, setResizeDraft] = useState<TimelineRangeDraft | null>(
    null
  )
  const resizingRef = useRef(false)
  const timelineHeaderScrollRef = useRef<HTMLDivElement | null>(null)
  const resizeStartRef = useRef({ x: 0, width: 224 })
  const dragOffsetRef = useRef<{ itemId: string; offsetDays: number } | null>(
    null
  )
  const today = startOfDay(new Date())
  const timelineStart = startOfDay(subDays(new Date(), 3))
  const timelineEnd = endOfDay(addDays(new Date(), 24))
  const days = eachDayOfInterval({
    start: timelineStart,
    end: timelineEnd,
  })
  const groups = [
    ...buildItemGroups(data, items, { ...view, subGrouping: null }).entries(),
  ]

  const weeks: { label: string; span: number }[] = []
  let currentWeekLabel = ""
  let currentSpan = 0
  for (const day of days) {
    const weekOfYear = format(day, "'W'ww")
    if (weekOfYear !== currentWeekLabel && currentWeekLabel) {
      weeks.push({
        label:
          format(subDays(day, currentSpan), "MMM d") +
          " – " +
          format(subDays(day, 1), "MMM d"),
        span: currentSpan,
      })
      currentSpan = 0
    }
    currentWeekLabel = weekOfYear
    currentSpan++
  }
  if (currentSpan > 0) {
    weeks.push({
      label:
        format(days[days.length - currentSpan], "MMM d") +
        " – " +
        format(days[days.length - 1], "MMM d"),
      span: currentSpan,
    })
  }

  const todayIndex = differenceInCalendarDays(today, timelineStart)

  function handleDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null)

    if (!editable || !event.over) {
      dragOffsetRef.current = null
      return
    }

    const activeId = String(event.active.id)
    const activeItem = data.workItems.find((entry) => entry.id === activeId)
    const [scope, , date] = String(event.over.id).split("::")

    if (!activeItem || scope !== "timeline") {
      dragOffsetRef.current = null
      return
    }

    const offsetDays =
      dragOffsetRef.current?.itemId === activeId
        ? dragOffsetRef.current.offsetDays
        : 0
    const nextStartDate = subDays(startOfDay(new Date(date)), offsetDays)

    useAppStore
      .getState()
      .updateWorkItem(
        activeId,
        buildTimelineMovePatch(activeItem, nextStartDate, timelineStart)
      )

    dragOffsetRef.current = null
  }

  function handleDragCancel() {
    setActiveItemId(null)
    dragOffsetRef.current = null
  }

  function captureDragOffset(
    item: WorkItem,
    span: number,
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    const target = event.target as HTMLElement

    if (target.closest("[data-timeline-resize-handle]")) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const rawOffset = Math.floor((event.clientX - rect.left) / dayColumnWidth)

    dragOffsetRef.current = {
      itemId: item.id,
      offsetDays: Math.max(0, Math.min(span - 1, rawOffset)),
    }
  }

  function handleTimelineBarResizeStart(
    item: WorkItem,
    edge: "start" | "end",
    clientX: number
  ) {
    const initialRange = getTimelineRange(item, timelineStart)
    let nextDraft: TimelineRangeDraft = {
      itemId: item.id,
      startDate: initialRange.startDate,
      endDate: initialRange.endDate,
    }

    setResizeDraft(nextDraft)

    const onPointerMove = (event: PointerEvent) => {
      const diffDays = Math.round((event.clientX - clientX) / dayColumnWidth)

      if (edge === "start") {
        const candidateStart = startOfDay(
          addDays(initialRange.startDate, diffDays)
        )
        nextDraft = {
          itemId: item.id,
          startDate:
            candidateStart.getTime() > initialRange.endDate.getTime()
              ? initialRange.endDate
              : candidateStart,
          endDate: initialRange.endDate,
        }
      } else {
        const candidateEnd = startOfDay(addDays(initialRange.endDate, diffDays))
        nextDraft = {
          itemId: item.id,
          startDate: initialRange.startDate,
          endDate:
            candidateEnd.getTime() < initialRange.startDate.getTime()
              ? initialRange.startDate
              : candidateEnd,
        }
      }

      setResizeDraft(nextDraft)
    }

    const onPointerUp = () => {
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerup", onPointerUp)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
      setResizeDraft(null)

      if (
        nextDraft.startDate.getTime() === initialRange.startDate.getTime() &&
        nextDraft.endDate.getTime() === initialRange.endDate.getTime()
      ) {
        return
      }

      useAppStore
        .getState()
        .updateWorkItem(
          item.id,
          buildTimelineResizePatch(item, nextDraft.startDate, nextDraft.endDate)
        )
    }

    document.body.style.setProperty("cursor", "ew-resize")
    document.body.style.setProperty("user-select", "none")
    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("pointerup", onPointerUp)
  }

  function handleResizeStart(event: ReactMouseEvent) {
    event.preventDefault()
    resizingRef.current = true
    resizeStartRef.current = { x: event.clientX, width: labelColWidth }

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return
      const diff = moveEvent.clientX - resizeStartRef.current.x
      setLabelColWidth(
        Math.max(160, Math.min(480, resizeStartRef.current.width + diff))
      )
    }

    const onMouseUp = () => {
      resizingRef.current = false
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  function handleTimelineBodyHorizontalScroll(
    event: ReactUIEvent<HTMLDivElement>
  ) {
    if (timelineHeaderScrollRef.current) {
      timelineHeaderScrollRef.current.scrollLeft =
        event.currentTarget.scrollLeft
    }
  }

  const dayColumnWidth = 56
  const timelineGridTemplateColumns = `repeat(${days.length}, ${dayColumnWidth}px)`
  const timelineCanvasWidth = dayColumnWidth * days.length
  const visibleGroups = groups.filter(
    ([groupName]) => !view.hiddenState.groups.includes(groupName)
  )
  const activeDragItem = activeItemId
    ? (data.workItems.find((entry) => entry.id === activeItemId) ?? null)
    : null
  const activeDragRange = activeDragItem
    ? getTimelineRange(activeDragItem, timelineStart)
    : null
  const activeDragSpan = activeDragRange
    ? Math.max(
        1,
        differenceInCalendarDays(
          activeDragRange.endDate,
          activeDragRange.startDate
        ) + 1
      )
    : 1

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <div
          className="relative z-10 shrink-0 border-r bg-background"
          style={{ width: labelColWidth }}
        >
          <div
            className={cn(
              "relative flex items-center border-b px-3 leading-none",
              TIMELINE_HEADER_TOP_ROW_HEIGHT_CLASS
            )}
            style={{ height: TIMELINE_HEADER_TOP_ROW_HEIGHT }}
          >
            <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Items
            </span>
            <div
              className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize transition-colors hover:bg-primary/20 active:bg-primary/40"
              onMouseDown={handleResizeStart}
            />
          </div>
          <div
            className={cn(
              "border-b bg-background",
              TIMELINE_HEADER_BOTTOM_ROW_HEIGHT_CLASS
            )}
            style={{ height: TIMELINE_HEADER_BOTTOM_ROW_HEIGHT }}
          />
        </div>

        <div className="min-w-0 overflow-hidden bg-background">
          <div ref={timelineHeaderScrollRef} className="overflow-hidden">
            <div className="min-w-max" style={{ width: timelineCanvasWidth }}>
              <div
                className="grid"
                style={{ gridTemplateColumns: timelineGridTemplateColumns }}
              >
                {weeks.map((week, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-center border-r border-b px-2 text-center text-[10px] leading-none font-medium whitespace-nowrap text-muted-foreground",
                      TIMELINE_HEADER_TOP_ROW_HEIGHT_CLASS
                    )}
                    style={{
                      gridColumn: `span ${week.span}`,
                      height: TIMELINE_HEADER_TOP_ROW_HEIGHT,
                    }}
                  >
                    {week.label}
                  </div>
                ))}
              </div>
              <div
                className="grid"
                style={{ gridTemplateColumns: timelineGridTemplateColumns }}
              >
                {days.map((day) => {
                  const isToday = differenceInCalendarDays(day, today) === 0
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex items-center justify-center border-r border-b px-1 text-center text-[10px] leading-none whitespace-nowrap",
                        TIMELINE_HEADER_BOTTOM_ROW_HEIGHT_CLASS,
                        isToday
                          ? "bg-primary/10 font-semibold text-primary"
                          : isWeekend
                            ? "text-muted-foreground/50"
                            : "text-muted-foreground"
                      )}
                      style={{ height: TIMELINE_HEADER_BOTTOM_ROW_HEIGHT }}
                    >
                      {format(day, "EEE")[0]} {format(day, "d")}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-2 min-h-0 overflow-y-auto overscroll-contain">
          <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)]">
            <div
              className="shrink-0 border-r bg-background"
              style={{ width: labelColWidth }}
            >
              {visibleGroups.map(([groupName, subgroups]) => {
                const groupItems = Array.from(subgroups.values()).flat()
                const groupLabel = getGroupValueLabel(view.grouping, groupName)
                const groupAdornment = getGroupValueAdornment(
                  view.grouping,
                  groupName
                )

                return (
                  <div key={groupName}>
                    <div
                      className={cn(
                        "flex items-center gap-2 border-b bg-muted/30 px-3",
                        TIMELINE_GROUP_ROW_HEIGHT_CLASS
                      )}
                    >
                      {groupAdornment}
                      <span className="text-xs font-medium">{groupLabel}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {groupItems.length}
                      </span>
                    </div>

                    {groupItems.map((item) => (
                      <TimelineLabelRow key={item.id} data={data} item={item} />
                    ))}
                  </div>
                )
              })}
            </div>

            <div
              className="min-w-0 overflow-x-auto overscroll-x-contain"
              onScroll={handleTimelineBodyHorizontalScroll}
            >
              <div
                className="relative min-w-max"
                style={{ width: timelineCanvasWidth }}
              >
                <div className="relative">
                  {todayIndex >= 0 && todayIndex < days.length ? (
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-primary/40"
                      style={{ left: (todayIndex + 0.5) * dayColumnWidth }}
                    />
                  ) : null}

                  {visibleGroups.map(([groupName, subgroups]) => {
                    const groupItems = Array.from(subgroups.values()).flat()

                    return (
                      <div key={groupName}>
                        <div
                          className={cn(
                            "border-b bg-muted/30",
                            TIMELINE_GROUP_ROW_HEIGHT_CLASS
                          )}
                        />

                        {groupItems.map((item) => (
                          <TimelineGridRow
                            key={item.id}
                            data={data}
                            days={days}
                            gridTemplateColumns={timelineGridTemplateColumns}
                            item={item}
                            onCaptureDragOffset={captureDragOffset}
                            onResizeStart={handleTimelineBarResizeStart}
                            rangeOverride={
                              resizeDraft?.itemId === item.id
                                ? resizeDraft
                                : null
                            }
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDragItem ? (
          <div
            className="h-9 px-0.5 py-1"
            style={{ width: activeDragSpan * dayColumnWidth }}
          >
            <TimelineBarPreview item={activeDragItem} span={activeDragSpan} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function TimelineLabelRow({ data, item }: { data: AppData; item: WorkItem }) {
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

function TimelineGridRow({
  data,
  item,
  days,
  gridTemplateColumns,
  onCaptureDragOffset,
  onResizeStart,
  rangeOverride,
}: {
  data: AppData
  item: WorkItem
  days: Date[]
  gridTemplateColumns: string
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
  rangeOverride: TimelineRangeDraft | null
}) {
  const range = rangeOverride ?? {
    itemId: item.id,
    ...getTimelineRange(item, days[0]),
  }
  const startDate = range.startDate
  const endDate = range.endDate
  const startIndex = Math.max(
    0,
    differenceInCalendarDays(startDate, startOfDay(days[0]))
  )
  const span = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1)

  return (
    <div className={cn("relative border-b", TIMELINE_ITEM_ROW_HEIGHT_CLASS)}>
      <div className="grid h-full" style={{ gridTemplateColumns }}>
        {days.map((day) => (
          <TimelineDropCell
            key={`${item.id}-${day.toISOString()}`}
            id={`timeline::${item.id}::${day.toISOString()}`}
            isWeekend={day.getDay() === 0 || day.getDay() === 6}
          />
        ))}
      </div>

      <div
        className="pointer-events-none absolute inset-0 grid"
        style={{ gridTemplateColumns }}
      >
        <div
          className="pointer-events-auto flex h-full items-center px-0.5 py-1"
          style={{ gridColumn: `${startIndex + 1} / span ${span}` }}
        >
          <TimelineBar
            data={data}
            item={item}
            span={span}
            onCaptureDragOffset={onCaptureDragOffset}
            onResizeStart={onResizeStart}
          />
        </div>
      </div>
    </div>
  )
}

function TimelineDropCell({
  id,
  isWeekend,
}: {
  id: string
  isWeekend: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-r transition-colors",
        TIMELINE_ITEM_ROW_HEIGHT_CLASS,
        isWeekend && "bg-muted/20",
        isOver && "bg-primary/10"
      )}
    />
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

function TimelineBarPreview({ item, span }: { item: WorkItem; span: number }) {
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

function TimelineBar({
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
