"use client"

import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"

import { formatLocalCalendarDate } from "@/lib/calendar-date"
import { getCalendarDate } from "@/lib/date-input"
import { getUser } from "@/lib/domain/selectors"
import {
  getViewerWallTimeForScheduleDate,
  getWorkItemScheduleDateRange,
  resolveWorkItemSchedule,
} from "@/lib/domain/work-item-schedule"
import type { AppData, WorkItem } from "@/lib/domain/types"
import { getBrowserTimeZone, normalizeTimeZone } from "@/lib/time-zone"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import { ViewTab } from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"
import { WorkItemDetailSidebarSurface } from "../work-item-detail-screen"

type CalendarMode = "day" | "week" | "month"
type DragAction = "move" | "resize-start" | "resize-end"

type TimedCalendarEntry = {
  item: WorkItem
  date: string
  startMinutes: number
  endMinutes: number
}

type AllDayCalendarEntry = {
  item: WorkItem
  startDate: string
  endDate: string
}

type AllDayCalendarSpan = {
  entry: AllDayCalendarEntry
  startIndex: number
  endIndex: number
  rowIndex: number
}

type MonthCalendarEntry = {
  item: WorkItem
  timeLabel: string | null
}

type CalendarDragState = {
  action: DragAction
  item: WorkItem
  pointerId: number
  originX: number
  originY: number
  originStartMinutes: number
  originEndMinutes: number
  originDayIndex: number
  durationMinutes: number
  moved: boolean
}

type HoverDetailAnchor = {
  left: number
  top: number
  width: number
  maxHeight: number
}

const HOUR_HEIGHT = 64
const ALL_DAY_EVENT_HEIGHT = 26
const ALL_DAY_EVENT_GAP = 4
const MIN_TIMED_DURATION_MINUTES = 15
const HOVER_DETAIL_DELAY_MS = 1000
const HOVER_DETAIL_CLEAR_DELAY_MS = 150
const HOVER_DETAIL_WIDTH = 420
const HOVER_DETAIL_MAX_HEIGHT = 680
const HOVER_DETAIL_MARGIN = 12

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getDateKey(date: Date) {
  return formatLocalCalendarDate(date)
}

function getDateFromKey(value: string) {
  return getCalendarDate(value) ?? new Date(value)
}

function getVisibleDays(anchorDate: Date, mode: CalendarMode) {
  if (mode === "day") {
    return [startOfDay(anchorDate)]
  }

  if (mode === "week") {
    const start = startOfWeek(anchorDate)
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }

  const monthStart = startOfMonth(anchorDate)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = addDays(startOfWeek(endOfMonth(anchorDate)), 6)
  const dayCount = differenceInCalendarDays(gridEnd, gridStart) + 1

  return Array.from({ length: dayCount }, (_, index) =>
    addDays(gridStart, index)
  )
}

function getModeTitle(anchorDate: Date, mode: CalendarMode) {
  if (mode === "day") {
    return format(anchorDate, "d MMMM yyyy")
  }

  return format(anchorDate, "MMMM yyyy")
}

function getMinutesFromTime(value: string) {
  const [hour, minute] = value.split(":").map(Number)
  return (hour ?? 0) * 60 + (minute ?? 0)
}

function formatTimeFromMinutes(value: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, value))
  const hour = Math.floor(clamped / 60)
  const minute = clamped % 60

  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`
}

function snapMinutes(value: number) {
  return Math.round(value / 15) * 15
}

function resolveCalendarEntries(
  items: WorkItem[],
  viewerTimeZone: string
): {
  allDayEntries: AllDayCalendarEntry[]
  timedEntries: TimedCalendarEntry[]
} {
  const allDayEntries: AllDayCalendarEntry[] = []
  const timedEntries: TimedCalendarEntry[] = []

  items.forEach((item) => {
    const schedule = resolveWorkItemSchedule(item, viewerTimeZone)

    if (schedule.kind === "timed") {
      const start = getViewerWallTimeForScheduleDate(
        schedule.start,
        viewerTimeZone
      )
      const end = getViewerWallTimeForScheduleDate(schedule.end, viewerTimeZone)

      if (start.date === end.date) {
        timedEntries.push({
          item,
          date: start.date,
          startMinutes: getMinutesFromTime(start.time),
          endMinutes: Math.max(
            getMinutesFromTime(end.time),
            getMinutesFromTime(start.time) + MIN_TIMED_DURATION_MINUTES
          ),
        })
        return
      }

      allDayEntries.push({
        item,
        startDate: start.date,
        endDate: end.date,
      })
      return
    }

    if (schedule.kind === "all-day") {
      allDayEntries.push({
        item,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
      })
    }
  })

  return { allDayEntries, timedEntries }
}

function itemTone(index: number) {
  const tones = [
    "border-l-[var(--status-progress)] bg-[color:var(--status-progress)]/15 text-foreground",
    "border-l-[var(--priority-high)] bg-[color:var(--priority-high)]/15 text-foreground",
    "border-l-[var(--priority-medium)] bg-[color:var(--priority-medium)]/15 text-foreground",
    "border-l-[var(--status-done)] bg-[color:var(--status-done)]/15 text-foreground",
  ]

  return tones[index % tones.length]
}

function getAllDaySpanForVisibleDays(
  entry: AllDayCalendarEntry,
  dayKeys: string[]
) {
  let startIndex = -1
  let endIndex = -1

  dayKeys.forEach((dayKey, index) => {
    if (dayKey < entry.startDate || dayKey > entry.endDate) {
      return
    }

    if (startIndex === -1) {
      startIndex = index
    }

    endIndex = index
  })

  return startIndex === -1 || endIndex === -1
    ? null
    : {
        entry,
        startIndex,
        endIndex,
      }
}

function getAllDayCalendarSpans(
  entries: AllDayCalendarEntry[],
  dayKeys: string[]
): AllDayCalendarSpan[] {
  const occupiedRows: Array<Set<number>> = []

  return entries
    .map((entry) => getAllDaySpanForVisibleDays(entry, dayKeys))
    .filter((span): span is NonNullable<typeof span> => span !== null)
    .sort(
      (left, right) =>
        left.startIndex - right.startIndex ||
        right.endIndex - right.startIndex - (left.endIndex - left.startIndex)
    )
    .map((span) => {
      const dayIndexes = Array.from(
        { length: span.endIndex - span.startIndex + 1 },
        (_, index) => span.startIndex + index
      )
      let rowIndex = occupiedRows.findIndex((row) =>
        dayIndexes.every((dayIndex) => !row.has(dayIndex))
      )

      if (rowIndex === -1) {
        rowIndex = occupiedRows.length
        occupiedRows.push(new Set())
      }

      dayIndexes.forEach((dayIndex) => occupiedRows[rowIndex]?.add(dayIndex))

      return {
        ...span,
        rowIndex,
      }
    })
}

function getAllDaySpanLaneHeight(
  spans: AllDayCalendarSpan[],
  minimumHeight = 0
) {
  if (spans.length === 0) {
    return minimumHeight
  }

  const rowCount = Math.max(...spans.map((span) => span.rowIndex + 1))

  return Math.max(
    minimumHeight,
    12 + rowCount * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_EVENT_GAP)
  )
}

function getMonthCalendarEntries({
  dayKey,
  timedEntries,
}: {
  dayKey: string
  timedEntries: TimedCalendarEntry[]
}): MonthCalendarEntry[] {
  return timedEntries
    .filter((entry) => entry.date === dayKey)
    .map((entry) => ({
      item: entry.item,
      timeLabel: formatTimeFromMinutes(entry.startMinutes),
    }))
}

export function CalendarView({
  data,
  items,
  editable,
  canEditItem,
}: {
  data: AppData
  items: WorkItem[]
  editable?: boolean
  canEditItem?: (item: WorkItem) => boolean
}) {
  const currentUser = getUser(data, data.currentUserId)
  const viewerTimeZone = normalizeTimeZone(
    currentUser?.preferences.timeZone,
    getBrowserTimeZone()
  )
  const [mode, setMode] = useState<CalendarMode>("week")
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()))
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)
  const [hoverAnchor, setHoverAnchor] = useState<HoverDetailAnchor | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timedGridRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<CalendarDragState | null>(null)
  const suppressNextClickRef = useRef(false)
  const days = useMemo(
    () => getVisibleDays(anchorDate, mode),
    [anchorDate, mode]
  )
  const dayKeys = useMemo(() => days.map(getDateKey), [days])
  const dayKeySet = useMemo(() => new Set(dayKeys), [dayKeys])
  const { allDayEntries, timedEntries } = useMemo(
    () => resolveCalendarEntries(items, viewerTimeZone),
    [items, viewerTimeZone]
  )
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null
  const hoveredItem = items.find((item) => item.id === hoveredItemId) ?? null

  function isItemEditable(item: WorkItem) {
    return Boolean(editable) && (canEditItem?.(item) ?? true)
  }

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  function clearHoverDetail() {
    clearHoverTimer()
    setHoveredItemId(null)
    setHoverAnchor(null)
  }

  function getHoverAnchorFromEvent(event: MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const viewportWidth =
      typeof window === "undefined" ? HOVER_DETAIL_WIDTH : window.innerWidth
    const viewportHeight =
      typeof window === "undefined" ? 720 : window.innerHeight
    const width = Math.min(
      HOVER_DETAIL_WIDTH,
      Math.max(240, viewportWidth - HOVER_DETAIL_MARGIN * 2)
    )
    const maxHeight = Math.min(
      HOVER_DETAIL_MAX_HEIGHT,
      Math.max(160, viewportHeight - HOVER_DETAIL_MARGIN * 2)
    )
    const left = clampNumber(
      rect.left + rect.width / 2 - width / 2,
      HOVER_DETAIL_MARGIN,
      Math.max(HOVER_DETAIL_MARGIN, viewportWidth - width - HOVER_DETAIL_MARGIN)
    )
    const top = clampNumber(
      rect.top + rect.height / 2 - maxHeight / 2,
      HOVER_DETAIL_MARGIN,
      Math.max(
        HOVER_DETAIL_MARGIN,
        viewportHeight - maxHeight - HOVER_DETAIL_MARGIN
      )
    )

    return {
      left,
      top,
      width,
      maxHeight,
    }
  }

  function scheduleHover(itemId: string, event: MouseEvent<HTMLElement>) {
    const nextAnchor = getHoverAnchorFromEvent(event)
    clearHoverTimer()
    hoverTimerRef.current = setTimeout(() => {
      setHoverAnchor(nextAnchor)
      setHoveredItemId(itemId)
    }, HOVER_DETAIL_DELAY_MS)
  }

  function scheduleHoverDetailClear() {
    clearHoverTimer()
    hoverTimerRef.current = setTimeout(
      clearHoverDetail,
      HOVER_DETAIL_CLEAR_DELAY_MS
    )
  }

  function getCalendarItemInteractionProps(itemId: string) {
    return {
      onClick: () => setSelectedItemId(itemId),
      onMouseEnter: (event: MouseEvent<HTMLButtonElement>) =>
        scheduleHover(itemId, event),
      onMouseLeave: scheduleHoverDetailClear,
    }
  }

  function moveAnchor(direction: -1 | 1) {
    setAnchorDate((current) =>
      mode === "month"
        ? addMonths(current, direction)
        : addDays(current, direction * (mode === "week" ? 7 : 1))
    )
  }

  function getPointerSlot(clientX: number, clientY: number) {
    const rect = timedGridRef.current?.getBoundingClientRect()

    if (!rect) {
      return null
    }

    const dayWidth = rect.width / dayKeys.length
    const dayIndex = Math.max(
      0,
      Math.min(dayKeys.length - 1, Math.floor((clientX - rect.left) / dayWidth))
    )
    const minutes = snapMinutes(((clientY - rect.top) / HOUR_HEIGHT) * 60)

    return {
      dayIndex,
      date: dayKeys[dayIndex],
      minutes: Math.max(
        0,
        Math.min(24 * 60 - MIN_TIMED_DURATION_MINUTES, minutes)
      ),
    }
  }

  function commitDrag(event: PointerEvent) {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const slot = getPointerSlot(event.clientX, event.clientY)
    const shouldSuppressClick = drag.moved
    dragStateRef.current = null

    if (shouldSuppressClick) {
      suppressNextClickForDrag()
    }

    if (!slot || !isItemEditable(drag.item)) {
      return
    }

    const dayDelta = slot.dayIndex - drag.originDayIndex
    const baseDate = addDays(
      getDateFromKey(dayKeys[drag.originDayIndex]),
      dayDelta
    )
    const nextDate = getDateKey(baseDate)
    let startMinutes = drag.originStartMinutes
    let endMinutes = drag.originEndMinutes

    if (drag.action === "move") {
      startMinutes = Math.min(
        slot.minutes,
        Math.max(0, 24 * 60 - 1 - drag.durationMinutes)
      )
      endMinutes = startMinutes + drag.durationMinutes
    } else if (drag.action === "resize-start") {
      startMinutes = Math.min(
        slot.minutes,
        drag.originEndMinutes - MIN_TIMED_DURATION_MINUTES
      )
    } else {
      endMinutes = Math.max(
        slot.minutes,
        drag.originStartMinutes + MIN_TIMED_DURATION_MINUTES
      )
    }

    useAppStore.getState().updateWorkItem(drag.item.id, {
      startDate: nextDate,
      dueDate: drag.item.dueDate ? nextDate : undefined,
      targetDate:
        drag.item.targetDate || !drag.item.dueDate ? nextDate : undefined,
      startTime: formatTimeFromMinutes(startMinutes),
      endTime: formatTimeFromMinutes(endMinutes),
      scheduleTimeZone: viewerTimeZone,
    })
  }

  function beginTimedDrag(
    event: ReactPointerEvent<HTMLElement>,
    entry: TimedCalendarEntry,
    action: DragAction
  ) {
    if (!isItemEditable(entry.item)) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)

    dragStateRef.current = {
      action,
      item: entry.item,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      originStartMinutes: entry.startMinutes,
      originEndMinutes: entry.endMinutes,
      originDayIndex: Math.max(0, dayKeys.indexOf(entry.date)),
      durationMinutes: entry.endMinutes - entry.startMinutes,
      moved: false,
    }
  }

  function updateDragMovement(event: PointerEvent) {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    drag.moved =
      drag.moved ||
      Math.abs(event.clientX - drag.originX) > 3 ||
      Math.abs(event.clientY - drag.originY) > 3
  }

  function cancelDrag(event: PointerEvent) {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    dragStateRef.current = null
  }

  function suppressNextClickForDrag() {
    suppressNextClickRef.current = true
    window.setTimeout(() => {
      suppressNextClickRef.current = false
    }, 0)
  }

  function moveAllDayItem(entry: AllDayCalendarEntry, targetDate: string) {
    const range = getWorkItemScheduleDateRange(entry.item)
    if (!range || !isItemEditable(entry.item)) {
      return
    }

    const delta = differenceInCalendarDays(
      getDateFromKey(targetDate),
      getDateFromKey(range.startDate)
    )

    useAppStore.getState().updateWorkItem(entry.item.id, {
      startDate: getDateKey(addDays(getDateFromKey(range.startDate), delta)),
      dueDate: entry.item.dueDate
        ? getDateKey(addDays(getDateFromKey(entry.item.dueDate), delta))
        : undefined,
      targetDate: entry.item.targetDate
        ? getDateKey(addDays(getDateFromKey(entry.item.targetDate), delta))
        : undefined,
    })
  }

  function getDayKeyFromHorizontalPosition(
    element: HTMLElement,
    clientX: number
  ) {
    const rect = element.getBoundingClientRect()
    const dayWidth = rect.width / dayKeys.length
    const dayIndex = Math.max(
      0,
      Math.min(dayKeys.length - 1, Math.floor((clientX - rect.left) / dayWidth))
    )

    return dayKeys[dayIndex]
  }

  function handleAllDayDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()

    const itemId = event.dataTransfer.getData("text/calendar-item")
    const targetDate = getDayKeyFromHorizontalPosition(
      event.currentTarget,
      event.clientX
    )
    const entry = visibleAllDayEntries.find(
      (candidate) => candidate.item.id === itemId
    )

    if (entry && targetDate) {
      moveAllDayItem(entry, targetDate)
    }
  }

  function convertAllDayItemToTimed(
    itemId: string,
    clientX: number,
    clientY: number
  ) {
    const slot = getPointerSlot(clientX, clientY)
    const item = items.find((candidate) => candidate.id === itemId) ?? null

    if (!slot || !item || !isItemEditable(item)) {
      return
    }

    const startMinutes = slot.minutes
    const endMinutes = Math.min(
      24 * 60 - 1,
      startMinutes + Math.max(MIN_TIMED_DURATION_MINUTES, 60)
    )

    useAppStore.getState().updateWorkItem(item.id, {
      startDate: slot.date,
      dueDate: item.dueDate ? slot.date : undefined,
      targetDate: item.targetDate || !item.dueDate ? slot.date : undefined,
      startTime: formatTimeFromMinutes(startMinutes),
      endTime: formatTimeFromMinutes(endMinutes),
      scheduleTimeZone: viewerTimeZone,
    })
  }

  const visibleAllDayEntries = allDayEntries.filter(
    (entry) =>
      entry.endDate >= dayKeys[0] &&
      entry.startDate <= dayKeys[dayKeys.length - 1]
  )
  const allDaySpans = getAllDayCalendarSpans(visibleAllDayEntries, dayKeys)
  const allDayLaneHeight = getAllDaySpanLaneHeight(allDaySpans, 76)
  const visibleTimedEntries = timedEntries.filter((entry) =>
    dayKeySet.has(entry.date)
  )
  const nowWallTime = getViewerWallTimeForScheduleDate(
    new Date(),
    viewerTimeZone
  )
  const nowDayIndex = dayKeys.indexOf(nowWallTime.date)
  const nowTop = (getMinutesFromTime(nowWallTime.time) / 60) * HOUR_HEIGHT

  return (
    <div className="flex min-h-0 flex-1 bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-[18px] font-semibold">
            {getModeTitle(anchorDate, mode)}
          </h2>
          <div className="flex items-center gap-1">
            {(["day", "week", "month"] as const).map((option) => (
              <ViewTab
                key={option}
                active={mode === option}
                className="capitalize"
                onClick={() => setMode(option)}
              >
                {option}
              </ViewTab>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous period"
            onClick={() => moveAnchor(-1)}
          >
            <CaretLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnchorDate(startOfDay(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next period"
            onClick={() => moveAnchor(1)}
          >
            <CaretRight className="size-4" />
          </Button>
        </div>

        {mode === "month" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            {Array.from({ length: Math.ceil(days.length / 7) }, (_, week) => {
              const weekDays = days.slice(week * 7, week * 7 + 7)
              const weekDayKeys = weekDays.map(getDateKey)
              const weekAllDaySpans = getAllDayCalendarSpans(
                allDayEntries,
                weekDayKeys
              )
              const monthAllDayAreaHeight = getAllDaySpanLaneHeight(
                weekAllDaySpans
              )
              const rowMinHeight = Math.max(128, 52 + monthAllDayAreaHeight)

              return (
                <div
                  key={weekDayKeys.join(":")}
                  className="relative grid grid-cols-7 border-b border-line-soft"
                  style={{ minHeight: rowMinHeight }}
                >
                  {weekDays.map((day) => {
                    const dayKey = getDateKey(day)
                    const entries = getMonthCalendarEntries({
                      dayKey,
                      timedEntries,
                    })

                    return (
                      <div
                        key={dayKey}
                        className={cn(
                          "border-r border-line-soft p-2",
                          !isSameMonth(day, anchorDate) &&
                            "bg-surface/40 text-fg-4"
                        )}
                      >
                        <div className="mb-2 text-[11px] font-medium">
                          {format(day, "EEE d")}
                        </div>
                        <div
                          className="space-y-1"
                          style={{
                            marginTop: monthAllDayAreaHeight,
                          }}
                        >
                          {entries.slice(0, 4).map((entry, index) => (
                            <button
                              key={entry.item.id}
                              className={cn(
                                "flex w-full min-w-0 items-center gap-1 rounded border-l-2 px-2 py-1 text-left text-[12px]",
                                itemTone(index)
                              )}
                              {...getCalendarItemInteractionProps(
                                entry.item.id
                              )}
                            >
                              {entry.timeLabel ? (
                                <span className="shrink-0 text-[11px] text-fg-3">
                                  {entry.timeLabel}
                                </span>
                              ) : null}
                              <span className="truncate">
                                {entry.item.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {weekAllDaySpans.map((span, index) => {
                    const spanLength = span.endIndex - span.startIndex + 1

                    return (
                      <button
                        key={span.entry.item.id}
                        className={cn(
                          "absolute z-10 truncate rounded border-l-2 px-2 text-left text-[12px] leading-[26px]",
                          itemTone(index)
                        )}
                        style={{
                          left: `calc(${(span.startIndex / 7) * 100}% + 6px)`,
                          width: `calc(${(spanLength / 7) * 100}% - 12px)`,
                          top:
                            30 +
                            span.rowIndex *
                              (ALL_DAY_EVENT_HEIGHT + ALL_DAY_EVENT_GAP),
                          height: ALL_DAY_EVENT_HEIGHT,
                        }}
                        {...getCalendarItemInteractionProps(span.entry.item.id)}
                      >
                        {span.entry.item.title}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="grid border-b border-line-soft"
              style={{
                gridTemplateColumns: `64px repeat(${dayKeys.length}, minmax(0, 1fr))`,
              }}
            >
              <div />
              {days.map((day) => (
                <div
                  key={getDateKey(day)}
                  className="border-l border-line-soft px-3 py-2 text-center"
                >
                  <div className="text-[12px] text-fg-3">
                    {format(day, "EEE")}
                  </div>
                  <div className="text-[18px] font-semibold">
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="grid min-h-[76px] border-b border-line-soft"
              style={{
                gridTemplateColumns: `64px repeat(${dayKeys.length}, minmax(0, 1fr))`,
                minHeight: allDayLaneHeight,
              }}
            >
              <div className="px-2 py-2 text-right text-[11px] text-fg-4">
                All day
              </div>
              <div
                className="relative min-h-[76px]"
                style={{
                  gridColumn: `2 / span ${dayKeys.length}`,
                  minHeight: allDayLaneHeight,
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleAllDayDrop}
              >
                <div
                  className="pointer-events-none absolute inset-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${dayKeys.length}, minmax(0, 1fr))`,
                  }}
                >
                  {dayKeys.map((dayKey) => (
                    <div key={dayKey} className="border-l border-line-soft" />
                  ))}
                </div>
                {allDaySpans.map((span, index) => {
                  const spanLength = span.endIndex - span.startIndex + 1

                  return (
                    <button
                      key={span.entry.item.id}
                      draggable={isItemEditable(span.entry.item)}
                      className={cn(
                        "absolute z-10 truncate rounded border-l-2 px-2 text-left text-[12px] leading-[26px]",
                        itemTone(index)
                      )}
                      style={{
                        left: `calc(${(span.startIndex / dayKeys.length) * 100}% + 6px)`,
                        width: `calc(${(spanLength / dayKeys.length) * 100}% - 12px)`,
                        top:
                          6 +
                          span.rowIndex *
                            (ALL_DAY_EVENT_HEIGHT + ALL_DAY_EVENT_GAP),
                        height: ALL_DAY_EVENT_HEIGHT,
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move"
                        event.dataTransfer.setData(
                          "text/calendar-item",
                          span.entry.item.id
                        )
                      }}
                      {...getCalendarItemInteractionProps(span.entry.item.id)}
                    >
                      {span.entry.item.title}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `64px repeat(${dayKeys.length}, minmax(0, 1fr))`,
                }}
              >
                <div>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={hour}
                      className="h-16 border-b border-line-soft pr-2 text-right text-[11px] text-fg-4"
                    >
                      {hour === 0
                        ? ""
                        : format(new Date(2026, 0, 1, hour), "ha")}
                    </div>
                  ))}
                </div>
                <div
                  ref={timedGridRef}
                  data-testid="calendar-timed-grid"
                  className="relative col-span-full col-start-2 grid"
                  style={{
                    gridTemplateColumns: `repeat(${dayKeys.length}, minmax(0, 1fr))`,
                    height: HOUR_HEIGHT * 24,
                  }}
                  onPointerMove={(event) =>
                    updateDragMovement(event.nativeEvent)
                  }
                  onPointerCancel={(event) => cancelDrag(event.nativeEvent)}
                  onPointerUp={(event) => commitDrag(event.nativeEvent)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault()
                    const itemId =
                      event.dataTransfer.getData("text/calendar-item")
                    if (itemId) {
                      convertAllDayItemToTimed(
                        itemId,
                        event.clientX,
                        event.clientY
                      )
                    }
                  }}
                >
                  {dayKeys.map((dayKey) => (
                    <div key={dayKey} className="border-l border-line-soft">
                      {Array.from({ length: 24 }, (_, hour) => (
                        <div
                          key={hour}
                          className="h-16 border-b border-line-soft"
                        />
                      ))}
                    </div>
                  ))}
                  {nowDayIndex >= 0 ? (
                    <div
                      className="pointer-events-none absolute z-10 h-px bg-[color:var(--priority-urgent)]"
                      style={{
                        top: nowTop,
                        left: `${(nowDayIndex / dayKeys.length) * 100}%`,
                        width: `${100 / dayKeys.length}%`,
                      }}
                    >
                      <span className="absolute -top-2 -left-11 rounded-full bg-[color:var(--priority-urgent)] px-1.5 py-0.5 text-[11px] leading-none text-white">
                        {nowWallTime.time}
                      </span>
                    </div>
                  ) : null}
                  {visibleTimedEntries.map((entry, index) => {
                    const dayIndex = dayKeys.indexOf(entry.date)
                    const top = (entry.startMinutes / 60) * HOUR_HEIGHT
                    const height = Math.max(
                      24,
                      ((entry.endMinutes - entry.startMinutes) / 60) *
                        HOUR_HEIGHT
                    )

                    return (
                      <div
                        key={entry.item.id}
                        className={cn(
                          "absolute rounded-md border-l-2 px-2 py-1 text-left text-[12px] shadow-sm",
                          itemTone(index)
                        )}
                        style={{
                          left: `calc(${(dayIndex / dayKeys.length) * 100}% + 4px)`,
                          width: `calc(${100 / dayKeys.length}% - 8px)`,
                          top,
                          height,
                        }}
                        onPointerDown={(event) =>
                          beginTimedDrag(event, entry, "move")
                        }
                        onClick={() => {
                          if (suppressNextClickRef.current) {
                            suppressNextClickRef.current = false
                            return
                          }

                          setSelectedItemId(entry.item.id)
                        }}
                        onMouseEnter={(event) =>
                          scheduleHover(entry.item.id, event)
                        }
                        onMouseLeave={scheduleHoverDetailClear}
                      >
                        <button
                          type="button"
                          className="absolute inset-x-1 top-0 h-2 cursor-ns-resize"
                          onPointerDown={(event) =>
                            beginTimedDrag(event, entry, "resize-start")
                          }
                          aria-label="Resize start time"
                        />
                        <div className="truncate font-medium">
                          {entry.item.title}
                        </div>
                        <div className="truncate text-[11px] text-fg-3">
                          {formatTimeFromMinutes(entry.startMinutes)} -{" "}
                          {formatTimeFromMinutes(entry.endMinutes)}
                        </div>
                        <button
                          type="button"
                          className="absolute inset-x-1 bottom-0 h-2 cursor-ns-resize"
                          onPointerDown={(event) =>
                            beginTimedDrag(event, entry, "resize-end")
                          }
                          aria-label="Resize end time"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedItem ? (
        <WorkItemDetailSidebarSurface
          data={data}
          currentItem={selectedItem}
          editable={isItemEditable(selectedItem)}
          onClose={() => setSelectedItemId(null)}
        />
      ) : null}

      {hoveredItem && hoverAnchor ? (
        <div
          className="fixed z-50"
          style={{
            left: hoverAnchor.left,
            top: hoverAnchor.top,
            width: hoverAnchor.width,
            maxHeight: hoverAnchor.maxHeight,
          }}
          onMouseEnter={clearHoverTimer}
          onMouseLeave={clearHoverDetail}
        >
          <WorkItemDetailSidebarSurface
            data={data}
            currentItem={hoveredItem}
            editable={isItemEditable(hoveredItem)}
            variant="floating"
            onClose={clearHoverDetail}
          />
        </div>
      ) : null}
    </div>
  )
}
