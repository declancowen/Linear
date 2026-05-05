"use client"

import {
  useRef,
  useState,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
} from "react"
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
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

import { buildItemGroups } from "@/lib/domain/selectors"
import type { AppData, ViewDefinition, WorkItem } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"

import { getGroupValueAdornment, getGroupValueLabel } from "./shared"
import {
  TimelineBar,
  TimelineBarPreview,
  TimelineLabelRow,
} from "./timeline-bars"
import {
  TIMELINE_GROUP_ROW_HEIGHT_CLASS,
  TIMELINE_HEADER_BOTTOM_ROW_HEIGHT,
  TIMELINE_HEADER_BOTTOM_ROW_HEIGHT_CLASS,
  TIMELINE_HEADER_TOP_ROW_HEIGHT,
  TIMELINE_HEADER_TOP_ROW_HEIGHT_CLASS,
  TIMELINE_ITEM_ROW_HEIGHT_CLASS,
} from "./timeline-constants"
import {
  buildTimelineResizePatch,
  buildTimelineWeeks,
  getTimelineMovePatchForDrag,
  getTimelineRange,
  type TimelineRangeDraft,
  type TimelineWeek,
} from "./timeline-state"

type TimelineGroupEntry = [string, Map<string, WorkItem[]>]

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
  const today = startOfDay(new Date())
  const timelineStart = startOfDay(subDays(new Date(), 3))
  const timelineEnd = endOfDay(addDays(new Date(), 24))
  const days = eachDayOfInterval({
    start: timelineStart,
    end: timelineEnd,
  })
  const dayColumnWidth = 56
  const groups = [
    ...buildItemGroups(data, items, { ...view, subGrouping: null }).entries(),
  ]
  const weeks = buildTimelineWeeks(days)
  const todayIndex = differenceInCalendarDays(today, timelineStart)
  const timelineGridTemplateColumns = `repeat(${days.length}, ${dayColumnWidth}px)`
  const timelineCanvasWidth = dayColumnWidth * days.length
  const visibleGroups = getVisibleTimelineGroups(groups, view)
  const { labelColWidth, handleResizeStart } = useTimelineLabelColumnResize()
  const { timelineHeaderScrollRef, handleTimelineBodyHorizontalScroll } =
    useTimelineBodyScrollSync()
  const {
    activeDragItem,
    activeDragSpan,
    captureDragOffset,
    handleDragCancel,
    handleDragEnd,
    handleDragStart,
  } = useTimelineDndController({
    data,
    dayColumnWidth,
    editable,
    timelineStart,
  })
  const { handleTimelineBarResizeStart, resizeDraft } =
    useTimelineBarResizeController({
      dayColumnWidth,
      timelineStart,
    })

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <TimelineFrame
        data={data}
        days={days}
        gridTemplateColumns={timelineGridTemplateColumns}
        headerScrollRef={timelineHeaderScrollRef}
        labelColWidth={labelColWidth}
        onBodyHorizontalScroll={handleTimelineBodyHorizontalScroll}
        onCaptureDragOffset={captureDragOffset}
        onLabelColumnResizeStart={handleResizeStart}
        onTimelineBarResizeStart={handleTimelineBarResizeStart}
        resizeDraft={resizeDraft}
        timelineCanvasWidth={timelineCanvasWidth}
        today={today}
        todayIndex={todayIndex}
        dayColumnWidth={dayColumnWidth}
        view={view}
        visibleGroups={visibleGroups}
        weeks={weeks}
      />
      <TimelineDragOverlay
        activeDragItem={activeDragItem}
        activeDragSpan={activeDragSpan}
        dayColumnWidth={dayColumnWidth}
      />
    </DndContext>
  )
}

function getVisibleTimelineGroups(
  groups: TimelineGroupEntry[],
  view: ViewDefinition
) {
  return groups.filter(
    ([groupName]) => !view.hiddenState.groups.includes(groupName)
  )
}

function useTimelineLabelColumnResize(initialWidth = 224) {
  const [labelColWidth, setLabelColWidth] = useState(initialWidth)
  const resizingRef = useRef(false)
  const resizeStartRef = useRef({ x: 0, width: initialWidth })

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

  return { labelColWidth, handleResizeStart }
}

function useTimelineBodyScrollSync() {
  const timelineHeaderScrollRef = useRef<HTMLDivElement | null>(null)

  function handleTimelineBodyHorizontalScroll(
    event: ReactUIEvent<HTMLDivElement>
  ) {
    if (timelineHeaderScrollRef.current) {
      timelineHeaderScrollRef.current.scrollLeft =
        event.currentTarget.scrollLeft
    }
  }

  return { timelineHeaderScrollRef, handleTimelineBodyHorizontalScroll }
}

function useTimelineDndController({
  data,
  dayColumnWidth,
  editable,
  timelineStart,
}: {
  data: AppData
  dayColumnWidth: number
  editable: boolean
  timelineStart: Date
}) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const dragOffsetRef = useRef<{ itemId: string; offsetDays: number } | null>(
    null
  )
  const activeDragItem = getTimelineActiveDragItem(data, activeItemId)
  const activeDragSpan = getTimelineActiveDragSpan(
    activeDragItem,
    timelineStart
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null)

    const activeId = String(event.active.id)
    const move = getTimelineMovePatchForDrag({
      activeId,
      data,
      dragOffset: dragOffsetRef.current,
      editable,
      overId: event.over ? String(event.over.id) : null,
      timelineStart,
    })

    if (!move) {
      dragOffsetRef.current = null
      return
    }

    useAppStore.getState().updateWorkItem(move.itemId, move.patch)

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

  return {
    activeDragItem,
    activeDragSpan,
    captureDragOffset,
    handleDragCancel,
    handleDragEnd,
    handleDragStart,
  }
}

function getTimelineActiveDragItem(
  data: AppData,
  activeItemId: string | null
) {
  if (!activeItemId) {
    return null
  }

  return data.workItems.find((entry) => entry.id === activeItemId) ?? null
}

function getTimelineActiveDragSpan(
  activeDragItem: WorkItem | null,
  timelineStart: Date
) {
  if (!activeDragItem) {
    return 1
  }

  const activeDragRange = getTimelineRange(activeDragItem, timelineStart)

  return (
    differenceInCalendarDays(
      activeDragRange.endDate,
      activeDragRange.startDate
    ) + 1
  )
}

function useTimelineBarResizeController({
  dayColumnWidth,
  timelineStart,
}: {
  dayColumnWidth: number
  timelineStart: Date
}) {
  const [resizeDraft, setResizeDraft] = useState<TimelineRangeDraft | null>(
    null
  )

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
      nextDraft = getTimelineResizeDraft(item, edge, initialRange, diffDays)
      setResizeDraft(nextDraft)
    }

    const onPointerUp = () => {
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerup", onPointerUp)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
      setResizeDraft(null)

      if (timelineRangeMatches(nextDraft, initialRange)) {
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

  return { handleTimelineBarResizeStart, resizeDraft }
}

function getTimelineResizeDraft(
  item: WorkItem,
  edge: "start" | "end",
  initialRange: { startDate: Date; endDate: Date },
  diffDays: number
): TimelineRangeDraft {
  if (edge === "start") {
    const candidateStart = startOfDay(addDays(initialRange.startDate, diffDays))

    return {
      itemId: item.id,
      startDate:
        candidateStart.getTime() > initialRange.endDate.getTime()
          ? initialRange.endDate
          : candidateStart,
      endDate: initialRange.endDate,
    }
  }

  const candidateEnd = startOfDay(addDays(initialRange.endDate, diffDays))

  return {
    itemId: item.id,
    startDate: initialRange.startDate,
    endDate:
      candidateEnd.getTime() < initialRange.startDate.getTime()
        ? initialRange.startDate
        : candidateEnd,
  }
}

function timelineRangeMatches(
  nextDraft: TimelineRangeDraft,
  initialRange: { startDate: Date; endDate: Date }
) {
  return (
    nextDraft.startDate.getTime() === initialRange.startDate.getTime() &&
    nextDraft.endDate.getTime() === initialRange.endDate.getTime()
  )
}

function TimelineFrame({
  data,
  days,
  dayColumnWidth,
  gridTemplateColumns,
  headerScrollRef,
  labelColWidth,
  onBodyHorizontalScroll,
  onCaptureDragOffset,
  onLabelColumnResizeStart,
  onTimelineBarResizeStart,
  resizeDraft,
  timelineCanvasWidth,
  today,
  todayIndex,
  view,
  visibleGroups,
  weeks,
}: {
  data: AppData
  days: Date[]
  dayColumnWidth: number
  gridTemplateColumns: string
  headerScrollRef: RefObject<HTMLDivElement | null>
  labelColWidth: number
  onBodyHorizontalScroll: (event: ReactUIEvent<HTMLDivElement>) => void
  onCaptureDragOffset: (
    item: WorkItem,
    span: number,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void
  onLabelColumnResizeStart: (event: ReactMouseEvent) => void
  onTimelineBarResizeStart: (
    item: WorkItem,
    edge: "start" | "end",
    clientX: number
  ) => void
  resizeDraft: TimelineRangeDraft | null
  timelineCanvasWidth: number
  today: Date
  todayIndex: number
  view: ViewDefinition
  visibleGroups: TimelineGroupEntry[]
  weeks: TimelineWeek[]
}) {
  return (
    <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <TimelineLabelColumnHeader
        labelColWidth={labelColWidth}
        onResizeStart={onLabelColumnResizeStart}
      />
      <TimelineDateHeader
        days={days}
        gridTemplateColumns={gridTemplateColumns}
        headerScrollRef={headerScrollRef}
        timelineCanvasWidth={timelineCanvasWidth}
        today={today}
        weeks={weeks}
      />
      <TimelineBody
        data={data}
        dayColumnWidth={dayColumnWidth}
        days={days}
        gridTemplateColumns={gridTemplateColumns}
        labelColWidth={labelColWidth}
        onBodyHorizontalScroll={onBodyHorizontalScroll}
        onCaptureDragOffset={onCaptureDragOffset}
        onTimelineBarResizeStart={onTimelineBarResizeStart}
        resizeDraft={resizeDraft}
        timelineCanvasWidth={timelineCanvasWidth}
        todayIndex={todayIndex}
        view={view}
        visibleGroups={visibleGroups}
      />
    </div>
  )
}

function TimelineLabelColumnHeader({
  labelColWidth,
  onResizeStart,
}: {
  labelColWidth: number
  onResizeStart: (event: ReactMouseEvent) => void
}) {
  return (
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
          onMouseDown={onResizeStart}
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
  )
}

function TimelineDateHeader({
  days,
  gridTemplateColumns,
  headerScrollRef,
  timelineCanvasWidth,
  today,
  weeks,
}: {
  days: Date[]
  gridTemplateColumns: string
  headerScrollRef: RefObject<HTMLDivElement | null>
  timelineCanvasWidth: number
  today: Date
  weeks: TimelineWeek[]
}) {
  return (
    <div className="min-w-0 overflow-hidden bg-background">
      <div ref={headerScrollRef} className="overflow-hidden">
        <div className="min-w-max" style={{ width: timelineCanvasWidth }}>
          <TimelineWeekHeader
            gridTemplateColumns={gridTemplateColumns}
            weeks={weeks}
          />
          <TimelineDayHeader
            days={days}
            gridTemplateColumns={gridTemplateColumns}
            today={today}
          />
        </div>
      </div>
    </div>
  )
}

function TimelineWeekHeader({
  gridTemplateColumns,
  weeks,
}: {
  gridTemplateColumns: string
  weeks: TimelineWeek[]
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns }}>
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
  )
}

function TimelineDayHeader({
  days,
  gridTemplateColumns,
  today,
}: {
  days: Date[]
  gridTemplateColumns: string
  today: Date
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns }}>
      {days.map((day) => (
        <TimelineDayHeaderCell key={day.toISOString()} day={day} today={today} />
      ))}
    </div>
  )
}

function TimelineDayHeaderCell({ day, today }: { day: Date; today: Date }) {
  const isToday = differenceInCalendarDays(day, today) === 0
  const isWeekend = day.getDay() === 0 || day.getDay() === 6

  return (
    <div
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
}

type TimelineGridInteractionProps = {
  dayColumnWidth: number
  days: Date[]
  gridTemplateColumns: string
  onBodyHorizontalScroll: (event: ReactUIEvent<HTMLDivElement>) => void
  onCaptureDragOffset: (
    item: WorkItem,
    span: number,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void
  onTimelineBarResizeStart: (
    item: WorkItem,
    edge: "start" | "end",
    clientX: number
  ) => void
  resizeDraft: TimelineRangeDraft | null
  timelineCanvasWidth: number
  todayIndex: number
}

type TimelineBodyProps = TimelineGridInteractionProps & {
  data: AppData
  labelColWidth: number
  view: ViewDefinition
  visibleGroups: TimelineGroupEntry[]
}

type TimelineGridGroupsProps = TimelineGridInteractionProps & {
  data: AppData
  visibleGroups: TimelineGroupEntry[]
}

function TimelineBody({
  data,
  dayColumnWidth,
  days,
  gridTemplateColumns,
  labelColWidth,
  onBodyHorizontalScroll,
  onCaptureDragOffset,
  onTimelineBarResizeStart,
  resizeDraft,
  timelineCanvasWidth,
  todayIndex,
  view,
  visibleGroups,
}: TimelineBodyProps) {
  return (
    <div className="col-span-2 min-h-0 overflow-y-auto overscroll-contain">
      <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)]">
        <TimelineLabelGroupsColumn
          data={data}
          labelColWidth={labelColWidth}
          view={view}
          visibleGroups={visibleGroups}
        />
        <TimelineGridGroups
          data={data}
          dayColumnWidth={dayColumnWidth}
          days={days}
          gridTemplateColumns={gridTemplateColumns}
          onBodyHorizontalScroll={onBodyHorizontalScroll}
          onCaptureDragOffset={onCaptureDragOffset}
          onTimelineBarResizeStart={onTimelineBarResizeStart}
          resizeDraft={resizeDraft}
          timelineCanvasWidth={timelineCanvasWidth}
          todayIndex={todayIndex}
          visibleGroups={visibleGroups}
        />
      </div>
    </div>
  )
}

function TimelineLabelGroupsColumn({
  data,
  labelColWidth,
  view,
  visibleGroups,
}: {
  data: AppData
  labelColWidth: number
  view: ViewDefinition
  visibleGroups: TimelineGroupEntry[]
}) {
  return (
    <div
      className="shrink-0 border-r bg-background"
      style={{ width: labelColWidth }}
    >
      {visibleGroups.map(([groupName, subgroups]) => (
        <TimelineLabelGroup
          key={groupName}
          data={data}
          groupName={groupName}
          subgroups={subgroups}
          view={view}
        />
      ))}
    </div>
  )
}

function TimelineLabelGroup({
  data,
  groupName,
  subgroups,
  view,
}: {
  data: AppData
  groupName: string
  subgroups: Map<string, WorkItem[]>
  view: ViewDefinition
}) {
  const groupItems = Array.from(subgroups.values()).flat()
  const groupLabel = getGroupValueLabel(view.grouping, groupName)
  const groupAdornment = getGroupValueAdornment(view.grouping, groupName)

  return (
    <div>
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
}

function TimelineGridGroups({
  data,
  dayColumnWidth,
  days,
  gridTemplateColumns,
  onBodyHorizontalScroll,
  onCaptureDragOffset,
  onTimelineBarResizeStart,
  resizeDraft,
  timelineCanvasWidth,
  todayIndex,
  visibleGroups,
}: TimelineGridGroupsProps) {
  return (
    <div
      className="min-w-0 overflow-x-auto overscroll-x-contain"
      onScroll={onBodyHorizontalScroll}
    >
      <div className="relative min-w-max" style={{ width: timelineCanvasWidth }}>
        <div className="relative">
          <TimelineTodayMarker
            dayColumnWidth={dayColumnWidth}
            days={days}
            todayIndex={todayIndex}
          />
          {visibleGroups.map(([groupName, subgroups]) => (
            <TimelineGridGroup
              key={groupName}
              data={data}
              days={days}
              gridTemplateColumns={gridTemplateColumns}
              onCaptureDragOffset={onCaptureDragOffset}
              onTimelineBarResizeStart={onTimelineBarResizeStart}
              resizeDraft={resizeDraft}
              subgroups={subgroups}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TimelineTodayMarker({
  dayColumnWidth,
  days,
  todayIndex,
}: {
  dayColumnWidth: number
  days: Date[]
  todayIndex: number
}) {
  if (todayIndex < 0 || todayIndex >= days.length) {
    return null
  }

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-primary/40"
      style={{ left: (todayIndex + 0.5) * dayColumnWidth }}
    />
  )
}

function TimelineGridGroup({
  data,
  days,
  gridTemplateColumns,
  onCaptureDragOffset,
  onTimelineBarResizeStart,
  resizeDraft,
  subgroups,
}: {
  data: AppData
  days: Date[]
  gridTemplateColumns: string
  onCaptureDragOffset: (
    item: WorkItem,
    span: number,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void
  onTimelineBarResizeStart: (
    item: WorkItem,
    edge: "start" | "end",
    clientX: number
  ) => void
  resizeDraft: TimelineRangeDraft | null
  subgroups: Map<string, WorkItem[]>
}) {
  const groupItems = Array.from(subgroups.values()).flat()

  return (
    <div>
      <div
        className={cn("border-b bg-muted/30", TIMELINE_GROUP_ROW_HEIGHT_CLASS)}
      />

      {groupItems.map((item) => (
        <TimelineGridRow
          key={item.id}
          data={data}
          days={days}
          gridTemplateColumns={gridTemplateColumns}
          item={item}
          onCaptureDragOffset={onCaptureDragOffset}
          onResizeStart={onTimelineBarResizeStart}
          rangeOverride={resizeDraft?.itemId === item.id ? resizeDraft : null}
        />
      ))}
    </div>
  )
}

function TimelineDragOverlay({
  activeDragItem,
  activeDragSpan,
  dayColumnWidth,
}: {
  activeDragItem: WorkItem | null
  activeDragSpan: number
  dayColumnWidth: number
}) {
  return (
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
