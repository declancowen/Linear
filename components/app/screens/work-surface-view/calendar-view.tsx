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
const MIN_TIMED_DURATION_MINUTES = 15
const HOVER_DETAIL_DELAY_MS = 1000
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

export function CalendarView({
  data,
  items,
  editable,
}: {
  data: AppData
  items: WorkItem[]
  editable?: boolean
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

  function getCalendarItemInteractionProps(itemId: string) {
    return {
      onClick: () => setSelectedItemId(itemId),
      onMouseEnter: (event: MouseEvent<HTMLButtonElement>) =>
        scheduleHover(itemId, event),
      onMouseLeave: clearHoverTimer,
    }
  }

  function moveAnchor(direction: -1 | 1) {
    setAnchorDate((current) =>
      addDays(
        current,
        direction * (mode === "month" ? 28 : mode === "week" ? 7 : 1)
      )
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
    const slot = getPointerSlot(event.clientX, event.clientY)
    dragStateRef.current = null

    if (!drag || !slot || !editable) {
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
      startMinutes = slot.minutes
      endMinutes = slot.minutes + drag.durationMinutes
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
    if (!editable) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

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

  function moveAllDayItem(entry: AllDayCalendarEntry, targetDate: string) {
    const range = getWorkItemScheduleDateRange(entry.item)
    if (!range || !editable) {
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

  function convertAllDayItemToTimed(
    itemId: string,
    clientX: number,
    clientY: number
  ) {
    const slot = getPointerSlot(clientX, clientY)
    const item = items.find((candidate) => candidate.id === itemId) ?? null

    if (!slot || !item || !editable) {
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
          <Button variant="ghost" size="icon" onClick={() => moveAnchor(-1)}>
            <CaretLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnchorDate(startOfDay(new Date()))}
          >
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => moveAnchor(1)}>
            <CaretRight className="size-4" />
          </Button>
        </div>

        {mode === "month" ? (
          <div className="grid flex-1 grid-cols-7 overflow-hidden">
            {days.map((day) => {
              const dayKey = getDateKey(day)
              const entries = allDayEntries.filter(
                (entry) => entry.startDate <= dayKey && entry.endDate >= dayKey
              )

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "min-h-[128px] border-r border-b border-line-soft p-2",
                    !isSameMonth(day, anchorDate) && "bg-surface/40 text-fg-4"
                  )}
                >
                  <div className="mb-2 text-[11px] font-medium">
                    {format(day, "EEE d")}
                  </div>
                  <div className="space-y-1">
                    {entries.slice(0, 4).map((entry, index) => (
                      <button
                        key={entry.item.id}
                        className={cn(
                          "block w-full truncate rounded border-l-2 px-2 py-1 text-left text-[12px]",
                          itemTone(index)
                        )}
                        {...getCalendarItemInteractionProps(entry.item.id)}
                      >
                        {entry.item.title}
                      </button>
                    ))}
                  </div>
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
              }}
            >
              <div className="px-2 py-2 text-right text-[11px] text-fg-4">
                All day
              </div>
              {dayKeys.map((dayKey) => (
                <div
                  key={dayKey}
                  className="min-h-[76px] border-l border-line-soft p-1.5"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const itemId =
                      event.dataTransfer.getData("text/calendar-item")
                    const entry = visibleAllDayEntries.find(
                      (candidate) => candidate.item.id === itemId
                    )
                    if (entry) {
                      moveAllDayItem(entry, dayKey)
                    }
                  }}
                >
                  {visibleAllDayEntries
                    .filter(
                      (entry) =>
                        entry.startDate <= dayKey && entry.endDate >= dayKey
                    )
                    .map((entry, index) => (
                      <button
                        key={entry.item.id}
                        draggable={editable}
                        className={cn(
                          "mb-1 block w-full truncate rounded border-l-2 px-2 py-1 text-left text-[12px]",
                          itemTone(index)
                        )}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move"
                          event.dataTransfer.setData(
                            "text/calendar-item",
                            entry.item.id
                          )
                        }}
                        {...getCalendarItemInteractionProps(entry.item.id)}
                      >
                        {entry.item.title}
                      </button>
                    ))}
                </div>
              ))}
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
                  className="relative col-span-full col-start-2 grid"
                  style={{
                    gridTemplateColumns: `repeat(${dayKeys.length}, minmax(0, 1fr))`,
                    height: HOUR_HEIGHT * 24,
                  }}
                  onPointerMove={(event) => {
                    const drag = dragStateRef.current
                    if (!drag) {
                      return
                    }
                    drag.moved =
                      drag.moved ||
                      Math.abs(event.clientX - drag.originX) > 3 ||
                      Math.abs(event.clientY - drag.originY) > 3
                  }}
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
                          const drag = dragStateRef.current
                          if (!drag?.moved) {
                            setSelectedItemId(entry.item.id)
                          }
                        }}
                        onMouseEnter={(event) =>
                          scheduleHover(entry.item.id, event)
                        }
                        onMouseLeave={clearHoverTimer}
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
          editable={Boolean(editable)}
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
            editable={Boolean(editable)}
            variant="floating"
            onClose={clearHoverDetail}
          />
        </div>
      ) : null}
    </div>
  )
}
