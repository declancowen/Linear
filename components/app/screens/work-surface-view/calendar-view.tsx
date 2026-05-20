"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type UIEvent as ReactUIEvent,
} from "react"
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import {
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  GearSix,
} from "@phosphor-icons/react"

import { formatLocalCalendarDate } from "@/lib/calendar-date"
import { getCalendarDate } from "@/lib/date-input"
import { getUser } from "@/lib/domain/selectors"
import {
  getViewerWallTimeForScheduleDate,
  getWorkItemScheduleDateRange,
  resolveWorkItemSchedule,
} from "@/lib/domain/work-item-schedule"
import type { AppData, WorkItem, WorkItemVisibility } from "@/lib/domain/types"
import {
  formatTimeZoneLabel,
  getBrowserTimeZone,
  getSupportedTimeZones,
  normalizeTimeZone,
  utcToZonedWallTime,
} from "@/lib/time-zone"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ViewTab } from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"
import { WorkItemDetailSidebarSurface } from "../work-item-detail-screen"
import {
  createEventAccentLabelLookup,
  getEventAccent,
  getEventAccentStyle,
  type EventAccentLabelLookup,
} from "./event-accent"

export type CalendarMode = "day" | "week" | "month"
type DragAction = "move" | "resize-start" | "resize-end"
export type CalendarColorMode = "status" | "priority" | "label" | "project"
export type CalendarTimeInterval = "hour" | "two-hours" | "four-hours"
export type CalendarWeekDayCount = 2 | 3 | 4 | 5 | 7 | 14
type CalendarWeekendVisibility = "show" | "hide"
export type CalendarWeekStart = "sunday" | "monday"

type TimedCalendarEntry = {
  isPartialDay?: boolean
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

type CalendarWallTime = ReturnType<typeof getViewerWallTimeForScheduleDate>

type CalendarDragGridMetrics = {
  left: number
  top: number
  width: number
  dayKeys: string[]
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
  grid: CalendarDragGridMetrics
  moved: boolean
}

type CalendarDragPreview = {
  action: DragAction
  item: WorkItem
  date: string
  startMinutes: number
  endMinutes: number
  isAllDay?: boolean
}

type PendingCalendarMoveDrag = {
  entry: TimedCalendarEntry
  pointerId: number
  originX: number
  originY: number
  timer: number
}

type CalendarTimeRow = {
  height: number
  hour: number
}

type CalendarCreateContext = {
  defaultTeamId?: string | null
  defaultProjectId?: string | null
  defaultVisibility?: WorkItemVisibility
}

type CalendarCreateSchedule = {
  date: string
  startMinutes?: number | null
  endMinutes?: number | null
}
export type CalendarViewControls = {
  mode?: CalendarMode
  onModeChange?: (mode: CalendarMode) => void
  colorMode?: CalendarColorMode
  onColorModeChange?: (mode: CalendarColorMode) => void
  timeInterval?: CalendarTimeInterval
  onTimeIntervalChange?: (interval: CalendarTimeInterval) => void
  maxAllDayEvents?: number
  onMaxAllDayEventsChange?: (maxAllDayEvents: number) => void
  weekDayCount?: CalendarWeekDayCount
  onWeekDayCountChange?: (weekDayCount: CalendarWeekDayCount) => void
  showWeekends?: boolean
  onShowWeekendsChange?: (showWeekends: boolean) => void
  weekStart?: CalendarWeekStart
  onWeekStartChange?: (weekStart: CalendarWeekStart) => void
  timeZone?: string
  onTimeZoneChange?: (timeZone: string) => void
}
type CalendarViewProps = CalendarViewControls & {
  allowCreate?: boolean
  canEditItem?: (item: WorkItem) => boolean
  createContext?: CalendarCreateContext
  data: AppData
  editable?: boolean
  items: WorkItem[]
  showSettingsButton?: boolean
  toolbarAccessory?: ReactNode
}
type CalendarTimedEntryBlockProps = {
  beginTimedDrag: (
    event: ReactPointerEvent<HTMLElement>,
    entry: TimedCalendarEntry,
    action: DragAction
  ) => void
  colorMode: CalendarColorMode
  dayKeys: string[]
  dragPreview: CalendarDragPreview | null
  entry: TimedCalendarEntry
  index: number
  isItemEditable: (item: WorkItem) => boolean
  labelsById: EventAccentLabelLookup
  onSelectItem: (itemId: string) => void
  scheduleHover: (itemId: string, event: MouseEvent<HTMLElement>) => void
  scheduleHoverDetailClear: () => void
  scheduleTimedMoveDrag: (
    event: ReactPointerEvent<HTMLElement>,
    entry: TimedCalendarEntry
  ) => void
  selectedItemId: string | null
  suppressNextClickRef: RefObject<boolean>
  timedEntryLayouts: Map<string, TimedEntryLayout[]>
}

type CalendarItemInteractionPropsGetter = (itemId: string) => {
  onClick: () => void
  onMouseEnter: (event: MouseEvent<HTMLButtonElement>) => void
  onMouseLeave: () => void
}

type CalendarToolbarProps = {
  anchorDate: Date
  colorMode: CalendarColorMode
  maxAllDayEvents: number
  mode: CalendarMode
  moveAnchor: (direction: -1 | 1) => void
  onAnchorDateChange: (next: Date | ((current: Date) => Date)) => void
  showSettingsButton: boolean
  showWeekends: boolean
  timeInterval: CalendarTimeInterval
  timeZone: string
  toolbarAccessory?: ReactNode
  weekDayCount: CalendarWeekDayCount
  weekStart: CalendarWeekStart
} & Required<
  Pick<
    CalendarViewControls,
    | "onColorModeChange"
    | "onMaxAllDayEventsChange"
    | "onModeChange"
    | "onShowWeekendsChange"
    | "onTimeIntervalChange"
    | "onTimeZoneChange"
    | "onWeekDayCountChange"
    | "onWeekStartChange"
  >
>

type CalendarMonthSharedProps = {
  allDayEntries: AllDayCalendarEntry[]
  anchorDate: Date
  collapseAllDayRange: (rangeKey: string) => void
  colorMode: CalendarColorMode
  getCalendarItemInteractionProps: CalendarItemInteractionPropsGetter
  handleMonthBlankClick: (event: MouseEvent<HTMLDivElement>) => void
  handleMonthBlankDoubleClick: (
    event: MouseEvent<HTMLDivElement>,
    date: string
  ) => void
  isAllDayRangeExpanded: (rangeKey: string) => boolean
  labelsById: EventAccentLabelLookup
  maxAllDayEvents: number
  monthBaseRowHeight: number
  openDayFromMonth: (dayKey: string) => void
  selectedItemId: string | null
  timedEntries: TimedCalendarEntry[]
}

type CalendarMonthViewProps = CalendarMonthSharedProps & {
  monthGridRef: RefObject<HTMLDivElement | null>
  monthWeeks: Date[][]
}

type CalendarMonthWeekRowProps = CalendarMonthSharedProps & {
  weekDays: Date[]
}

type CalendarAllDaySurfaceProps = {
  dayKeys: string[]
  days: Date[]
  dragPreview: CalendarDragPreview | null
  expandAllDayRange: (rangeKey: string) => void
  getCalendarItemInteractionProps: CalendarItemInteractionPropsGetter
  handleAllDayBlankClick: (event: MouseEvent<HTMLDivElement>) => void
  handleAllDayBlankDoubleClick: (event: MouseEvent<HTMLDivElement>) => void
  handleAllDayDrop: (event: DragEvent<HTMLDivElement>) => void
}

type CalendarAllDayScrollAreaProps = CalendarAllDaySurfaceProps & {
  allDayLaneHeight: number
  allDayRangeExpanded: boolean
  allDayRangeKey: string
  collapseAllDayRange: (rangeKey: string) => void
  colorMode: CalendarColorMode
  dayAllDayScrollRef: RefObject<HTMLDivElement | null>
  dayColumnsContentWidth: string
  dayColumnsGridTemplateColumns: string
  hiddenAllDayCounts: number[]
  isItemEditable: (item: WorkItem) => boolean
  labelsById: EventAccentLabelLookup
  onAllDayDragStart: () => void
  selectedItemId: string | null
  visibleAllDayRowCount: number
  visibleAllDaySpans: AllDayCalendarSpan[]
}

type CalendarViewControlOptions = {
  controlledColorMode?: CalendarColorMode
  controlledMaxAllDayEvents?: number
  controlledMode?: CalendarMode
  controlledShowWeekends?: boolean
  controlledTimeInterval?: CalendarTimeInterval
  controlledTimeZone?: string
  controlledWeekDayCount?: CalendarWeekDayCount
  controlledWeekStart?: CalendarWeekStart
  defaultViewerTimeZone: string
} & Pick<
  CalendarViewControls,
  | "onColorModeChange"
  | "onMaxAllDayEventsChange"
  | "onModeChange"
  | "onShowWeekendsChange"
  | "onTimeIntervalChange"
  | "onTimeZoneChange"
  | "onWeekDayCountChange"
  | "onWeekStartChange"
>

type TimedEntryGeometry = {
  columnIndex: number
  dayIndex: number
  dayWidthPercent: number
  height: number
  leftPercent: number
  offsetPx: number
  rightOffsetPx: number
  top: number
  widthPercent: number
}

type CalendarSelectionDraft = {
  pointerId: number
  originSlot: CalendarPointerSlot
  currentSlot: CalendarPointerSlot
  moved: boolean
}

type CalendarSelectionPreview = {
  date: string
  startMinutes: number
  endMinutes: number
}

type HoverDetailAnchor = {
  left: number
  top: number
  width: number
  maxHeight: number
}

type CalendarPointerSlot = {
  dayIndex: number
  date: string
  minutes: number
}

const HOUR_HEIGHT = 64
const ALL_DAY_EVENT_HEIGHT = 26
const ALL_DAY_EVENT_GAP = 4
const ALL_DAY_LANE_MIN_HEIGHT = 44
const ALL_DAY_LANE_TOP_PADDING = 6
const ALL_DAY_LANE_BOTTOM_PADDING = 6
const ALL_DAY_MORE_BUTTON_HEIGHT = 22
const CALENDAR_TIME_AXIS_WIDTH = 64
const CALENDAR_DAY_MIN_WIDTH = 180
const CALENDAR_DAY_SCROLL_MULTIPLIER = 14
const CALENDAR_WEEK_SCROLL_MULTIPLIER = 3
const CALENDAR_MONTH_SCROLL_PAST_WEEK_COUNT = 6
const CALENDAR_MONTH_SCROLL_WEEK_COUNT = 10
const MONTH_GRID_MIN_ROW_HEIGHT = 128
const MONTH_DAY_HEADER_HEIGHT = 18
const MONTH_DAY_PADDING_Y = 16
const MONTH_DAY_EVENTS_TOP_GAP = 8
const MONTH_TIMED_EVENT_ROW_HEIGHT = 26
const MONTH_TIMED_EVENT_ROW_GAP = 4
const MIN_TIMED_DURATION_MINUTES = 15
const DRAG_HOLD_DELAY_MS = 160
const DRAG_START_TOLERANCE_PX = 6
const HOVER_DETAIL_DELAY_MS = 1000
const HOVER_DETAIL_CLEAR_DELAY_MS = 150
const HOVER_DETAIL_WIDTH = 420
const HOVER_DETAIL_MAX_HEIGHT = 680
const HOVER_DETAIL_MARGIN = 12
const CALENDAR_COLOR_MODE_OPTIONS: Array<{
  value: CalendarColorMode
  label: string
}> = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "label", label: "Label" },
  { value: "project", label: "Project" },
]
const CALENDAR_TIME_INTERVAL_OPTIONS: Array<{
  value: CalendarTimeInterval
  label: string
  hours: number
}> = [
  { value: "hour", label: "1 hour", hours: 1 },
  { value: "two-hours", label: "2 hours", hours: 2 },
  { value: "four-hours", label: "4 hours", hours: 4 },
]
const CALENDAR_MAX_ALL_DAY_EVENT_OPTIONS = Array.from(
  { length: 10 },
  (_, index) => index + 1
)
const CALENDAR_WEEK_DAY_COUNT_OPTIONS = [
  2, 3, 4, 5, 7, 14,
] satisfies CalendarWeekDayCount[]
const CALENDAR_WEEKEND_VISIBILITY_OPTIONS: Array<{
  value: CalendarWeekendVisibility
  label: string
}> = [
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
]
const CALENDAR_WEEK_START_OPTIONS: Array<{
  value: CalendarWeekStart
  label: string
}> = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
]

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getDateKey(date: Date) {
  return formatLocalCalendarDate(date)
}

function getDateFromKey(value: string) {
  return getCalendarDate(value) ?? new Date(value)
}

function getTodayDateInTimeZone(timeZone: string, now = new Date()) {
  return getDateFromKey(utcToZonedWallTime(now, timeZone).date)
}

function isWeekendDate(date: Date) {
  const day = date.getDay()

  return day === 0 || day === 6
}

function getWeekStartsOn(weekStart: CalendarWeekStart) {
  return weekStart === "monday" ? 1 : 0
}

function getVisibleDaySequence({
  count,
  showWeekends,
  start,
}: {
  count: number
  showWeekends: boolean
  start: Date
}) {
  const days: Date[] = []
  let cursor = startOfDay(start)

  while (days.length < count) {
    if (showWeekends || !isWeekendDate(cursor)) {
      days.push(cursor)
    }

    cursor = addDays(cursor, 1)
  }

  return days
}

function getVisibleDaySequenceBefore({
  count,
  end,
  showWeekends,
}: {
  count: number
  end: Date
  showWeekends: boolean
}) {
  const days: Date[] = []
  let cursor = addDays(startOfDay(end), -1)

  while (days.length < count) {
    if (showWeekends || !isWeekendDate(cursor)) {
      days.unshift(cursor)
    }

    cursor = addDays(cursor, -1)
  }

  return days
}

function getMonthVisibleWeeks(
  anchorDate: Date,
  showWeekends: boolean,
  weekStart: CalendarWeekStart
) {
  const monthStart = startOfMonth(anchorDate)
  const weekStartsOn = getWeekStartsOn(weekStart)
  const gridStart = startOfWeek(monthStart, { weekStartsOn })
  const gridEnd = addDays(
    startOfWeek(endOfMonth(anchorDate), { weekStartsOn }),
    6
  )
  const dayCount = differenceInCalendarDays(gridEnd, gridStart) + 1
  const gridDays = Array.from({ length: dayCount }, (_, index) =>
    addDays(gridStart, index)
  )

  return Array.from({ length: Math.ceil(gridDays.length / 7) }, (_, index) =>
    gridDays
      .slice(index * 7, index * 7 + 7)
      .filter((day) => showWeekends || !isWeekendDate(day))
  ).filter((week) => week.length > 0)
}

function getScrollableMonthWeeks(
  anchorDate: Date,
  showWeekends: boolean,
  weekStart: CalendarWeekStart
) {
  const gridStart = addDays(
    startOfWeek(startOfMonth(anchorDate), {
      weekStartsOn: getWeekStartsOn(weekStart),
    }),
    -CALENDAR_MONTH_SCROLL_PAST_WEEK_COUNT * 7
  )

  return Array.from(
    {
      length:
        CALENDAR_MONTH_SCROLL_PAST_WEEK_COUNT +
        CALENDAR_MONTH_SCROLL_WEEK_COUNT,
    },
    (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) =>
        addDays(gridStart, weekIndex * 7 + dayIndex)
      ).filter((day) => showWeekends || !isWeekendDate(day))
  ).filter((week) => week.length > 0)
}

function getScrollableWeekStart(
  anchorDate: Date,
  weekDayCount: CalendarWeekDayCount,
  showWeekends: boolean,
  weekStart: CalendarWeekStart
) {
  const alignsToWeekStart = showWeekends
    ? weekDayCount >= 7
    : weekDayCount === 5

  return alignsToWeekStart
    ? startOfWeek(anchorDate, {
        weekStartsOn: getWeekStartsOn(weekStart),
      })
    : startOfDay(anchorDate)
}

function getScrollAnchorDay(
  anchorDate: Date,
  mode: CalendarMode,
  weekDayCount: CalendarWeekDayCount,
  showWeekends: boolean,
  weekStart: CalendarWeekStart
) {
  const start =
    mode === "week"
      ? getScrollableWeekStart(
          anchorDate,
          weekDayCount,
          showWeekends,
          weekStart
        )
      : startOfDay(anchorDate)

  return getVisibleDaySequence({
    count: 1,
    showWeekends,
    start,
  })[0]
}

function getScrollableMonthScrollTop(rowHeight: number) {
  return CALENDAR_MONTH_SCROLL_PAST_WEEK_COUNT * rowHeight
}

function getScrollableDays(
  anchorDate: Date,
  mode: CalendarMode,
  weekDayCount: CalendarWeekDayCount,
  showWeekends: boolean,
  weekStart: CalendarWeekStart
) {
  if (mode === "day") {
    const currentDay = getScrollAnchorDay(
      anchorDate,
      mode,
      weekDayCount,
      showWeekends,
      weekStart
    )

    return [
      ...getVisibleDaySequenceBefore({
        count: CALENDAR_DAY_SCROLL_MULTIPLIER,
        end: currentDay,
        showWeekends,
      }),
      currentDay,
      ...getVisibleDaySequence({
        count: CALENDAR_DAY_SCROLL_MULTIPLIER,
        showWeekends,
        start: addDays(currentDay, 1),
      }),
    ]
  }

  if (mode === "week") {
    const start = getScrollableWeekStart(
      anchorDate,
      weekDayCount,
      showWeekends,
      weekStart
    )
    const currentDays = getVisibleDaySequence({
      count: weekDayCount,
      showWeekends,
      start,
    })
    const firstCurrentDay = currentDays[0] ?? start
    const lastCurrentDay =
      currentDays[currentDays.length - 1] ?? firstCurrentDay

    return [
      ...getVisibleDaySequenceBefore({
        count: weekDayCount * CALENDAR_WEEK_SCROLL_MULTIPLIER,
        end: firstCurrentDay,
        showWeekends,
      }),
      ...currentDays,
      ...getVisibleDaySequence({
        count: weekDayCount * CALENDAR_WEEK_SCROLL_MULTIPLIER,
        showWeekends,
        start: addDays(lastCurrentDay, 1),
      }),
    ]
  }

  return getScrollableMonthWeeks(anchorDate, showWeekends, weekStart).flat()
}

function moveDateByVisibleDays(
  anchorDate: Date,
  visibleDayDelta: number,
  showWeekends: boolean
) {
  if (visibleDayDelta === 0) {
    return startOfDay(anchorDate)
  }

  if (showWeekends) {
    return addDays(startOfDay(anchorDate), visibleDayDelta)
  }

  const direction = visibleDayDelta > 0 ? 1 : -1
  let remaining = Math.abs(visibleDayDelta)
  let cursor = startOfDay(anchorDate)

  while (remaining > 0) {
    cursor = addDays(cursor, direction)

    if (!isWeekendDate(cursor)) {
      remaining -= 1
    }
  }

  return cursor
}

export function getCalendarNavigationAnchorDate({
  anchorDate,
  direction,
  mode,
  showWeekends,
  weekDayCount,
  weekStart,
}: {
  anchorDate: Date
  direction: -1 | 1
  mode: CalendarMode
  showWeekends: boolean
  weekDayCount: CalendarWeekDayCount
  weekStart: CalendarWeekStart
}) {
  if (mode === "month") {
    return addMonths(anchorDate, direction)
  }

  if (mode === "day") {
    return moveDateByVisibleDays(anchorDate, direction, showWeekends)
  }

  const periodStart = getScrollAnchorDay(
    anchorDate,
    mode,
    weekDayCount,
    showWeekends,
    weekStart
  )

  return moveDateByVisibleDays(
    periodStart,
    direction * weekDayCount,
    showWeekends
  )
}

export function getCalendarWeekendVisibilityAnchorDate({
  anchorDate,
  mode,
  nextShowWeekends,
}: {
  anchorDate: Date
  mode: CalendarMode
  nextShowWeekends: boolean
}) {
  if (nextShowWeekends || mode !== "day" || !isWeekendDate(anchorDate)) {
    return startOfDay(anchorDate)
  }

  return getVisibleDaySequence({
    count: 1,
    showWeekends: false,
    start: anchorDate,
  })[0] ?? startOfDay(anchorDate)
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

function getSameDayTimedCalendarEntry(
  item: WorkItem,
  start: CalendarWallTime,
  end: CalendarWallTime
): TimedCalendarEntry {
  const startMinutes = getMinutesFromTime(start.time)

  return {
    item,
    date: start.date,
    startMinutes,
    endMinutes: Math.max(
      getMinutesFromTime(end.time),
      startMinutes + MIN_TIMED_DURATION_MINUTES
    ),
  }
}

function getCrossDayTimedCalendarEntries(
  item: WorkItem,
  start: CalendarWallTime,
  end: CalendarWallTime
): TimedCalendarEntry[] {
  const entries: TimedCalendarEntry[] = []
  let cursor = getDateFromKey(start.date)
  const endDate = getDateFromKey(end.date)

  while (cursor <= endDate) {
    const date = getDateKey(cursor)
    const startMinutes =
      date === start.date ? getMinutesFromTime(start.time) : 0
    const endMinutes =
      date === end.date ? getMinutesFromTime(end.time) : 24 * 60 - 1

    if (endMinutes > startMinutes) {
      entries.push({
        isPartialDay: true,
        item,
        date,
        startMinutes,
        endMinutes,
      })
    }

    cursor = addDays(cursor, 1)
  }

  return entries
}

function getTimedCalendarEntries(
  item: WorkItem,
  schedule: Extract<
    ReturnType<typeof resolveWorkItemSchedule>,
    { kind: "timed" }
  >,
  viewerTimeZone: string
): TimedCalendarEntry[] {
  const start = getViewerWallTimeForScheduleDate(schedule.start, viewerTimeZone)
  const end = getViewerWallTimeForScheduleDate(schedule.end, viewerTimeZone)

  return start.date === end.date
    ? [getSameDayTimedCalendarEntry(item, start, end)]
    : getCrossDayTimedCalendarEntries(item, start, end)
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
      timedEntries.push(
        ...getTimedCalendarEntries(item, schedule, viewerTimeZone)
      )
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

function isCalendarColorMode(value: string): value is CalendarColorMode {
  return CALENDAR_COLOR_MODE_OPTIONS.some((option) => option.value === value)
}

function isCalendarTimeInterval(value: string): value is CalendarTimeInterval {
  return CALENDAR_TIME_INTERVAL_OPTIONS.some((option) => option.value === value)
}

function isCalendarWeekendVisibility(
  value: string
): value is CalendarWeekendVisibility {
  return CALENDAR_WEEKEND_VISIBILITY_OPTIONS.some(
    (option) => option.value === value
  )
}

function isCalendarWeekStart(value: string): value is CalendarWeekStart {
  return CALENDAR_WEEK_START_OPTIONS.some((option) => option.value === value)
}

function getCalendarTimeIntervalHours(value: CalendarTimeInterval) {
  return (
    CALENDAR_TIME_INTERVAL_OPTIONS.find((option) => option.value === value)
      ?.hours ?? 1
  )
}

function normalizeMaxAllDayEvents(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)))
}

function parseMaxAllDayEvents(value: string) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? normalizeMaxAllDayEvents(parsed) : 3
}

function normalizeWeekDayCount(value: number): CalendarWeekDayCount {
  const rounded = Math.round(value)

  return CALENDAR_WEEK_DAY_COUNT_OPTIONS.reduce<CalendarWeekDayCount>(
    (closest, option) =>
      Math.abs(option - rounded) < Math.abs(closest - rounded)
        ? option
        : closest,
    7
  )
}

function parseWeekDayCount(value: string): CalendarWeekDayCount {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? normalizeWeekDayCount(parsed) : 7
}

function getCalendarItemAccent(
  item: WorkItem,
  colorMode: CalendarColorMode,
  fallbackIndex: number,
  labelsById: Map<string, { color: string }>
) {
  return getEventAccent(item, colorMode, fallbackIndex, labelsById)
}

function getCalendarItemStyle(accent: string): CSSProperties {
  return getEventAccentStyle(accent)
}

function getAllDaySpanRenderModel({
  colorMode,
  columnCount,
  index,
  labelsById,
  selectedItemId,
  span,
}: {
  colorMode: CalendarColorMode
  columnCount: number
  index: number
  labelsById: EventAccentLabelLookup
  selectedItemId: string | null
  span: AllDayCalendarSpan
}) {
  const spanLength = span.endIndex - span.startIndex + 1
  const accent = getCalendarItemAccent(
    span.entry.item,
    colorMode,
    index,
    labelsById
  )

  return {
    accent,
    isSelected: selectedItemId === span.entry.item.id,
    left: `calc(${(span.startIndex / columnCount) * 100}% + 6px)`,
    spanLength,
    width: `calc(${(spanLength / columnCount) * 100}% - 12px)`,
  }
}

function getCalendarDragWorkItemPatch(
  item: WorkItem,
  preview: CalendarDragPreview,
  viewerTimeZone: string
) {
  const datePatch = {
    startDate: preview.date,
    dueDate: item.dueDate ? preview.date : undefined,
    targetDate: item.targetDate || !item.dueDate ? preview.date : undefined,
  }

  if (preview.isAllDay) {
    return {
      ...datePatch,
      startTime: null,
      endTime: null,
      scheduleTimeZone: null,
    }
  }

  return {
    ...datePatch,
    startTime: formatTimeFromMinutes(preview.startMinutes),
    endTime: formatTimeFromMinutes(preview.endMinutes),
    scheduleTimeZone: viewerTimeZone,
  }
}

function getTimedEntryGeometry({
  dayKeys,
  entry,
  index,
  timedEntryLayouts,
}: {
  dayKeys: string[]
  entry: TimedCalendarEntry
  index: number
  timedEntryLayouts: Map<string, TimedEntryLayout[]>
}): TimedEntryGeometry | null {
  const dayIndex = dayKeys.indexOf(entry.date)

  if (dayIndex === -1) {
    return null
  }

  const layout = (timedEntryLayouts.get(entry.date) ?? []).find(
    (candidate) => candidate.index === index
  )
  const columnCount = layout?.columns ?? 1
  const columnIndex = layout?.column ?? 0
  const dayWidthPercent = 100 / dayKeys.length
  const widthPercent = dayWidthPercent / columnCount

  return {
    columnIndex,
    dayIndex,
    dayWidthPercent,
    height: Math.max(
      24,
      ((entry.endMinutes - entry.startMinutes) / 60) * HOUR_HEIGHT
    ),
    leftPercent: dayWidthPercent * dayIndex + widthPercent * columnIndex,
    offsetPx: columnIndex === 0 ? 4 : 1,
    rightOffsetPx: columnIndex === columnCount - 1 ? 4 : 1,
    top: (entry.startMinutes / 60) * HOUR_HEIGHT,
    widthPercent,
  }
}

function getTimedEntryClassName({
  editable,
  isDragging,
  isSelected,
}: {
  editable: boolean
  isDragging: boolean
  isSelected: boolean
}) {
  return cn(
    "group/event absolute overflow-hidden rounded-md text-left text-[12px] transition-[background-color,box-shadow] duration-150",
    editable
      ? "cursor-grab touch-none select-none active:cursor-grabbing"
      : "cursor-default",
    isDragging && "opacity-35",
    isSelected
      ? "bg-[color:var(--cal-accent)] text-white shadow-md"
      : "bg-[color:var(--cal-accent-tint)] text-foreground hover:bg-[color:var(--cal-accent-tint-hover)]"
  )
}

function CalendarTimedEntryResizeHandle({
  action,
  beginTimedDrag,
  entry,
}: {
  action: Extract<DragAction, "resize-start" | "resize-end">
  beginTimedDrag: CalendarTimedEntryBlockProps["beginTimedDrag"]
  entry: TimedCalendarEntry
}) {
  return (
    <button
      type="button"
      data-calendar-resize-handle
      className={cn(
        "absolute inset-x-1 z-10 h-1.5 cursor-ns-resize touch-none",
        action === "resize-start" ? "top-0" : "bottom-0"
      )}
      onPointerDown={(event) => {
        event.stopPropagation()
        beginTimedDrag(event, entry, action)
      }}
      aria-label={
        action === "resize-start" ? "Resize start time" : "Resize end time"
      }
    />
  )
}

function CalendarTimedEntryContent({
  entry,
  isSelected,
  isShort,
}: {
  entry: TimedCalendarEntry
  isSelected: boolean
  isShort: boolean
}) {
  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col gap-0.5 py-1 pr-2 pl-[14px]",
        isShort && "flex-row items-baseline gap-1.5 py-0.5"
      )}
    >
      <div
        className={cn(
          "min-w-0 truncate leading-tight font-semibold",
          isShort && "text-[11px]"
        )}
      >
        {entry.item.title}
      </div>
      <div
        className={cn(
          "min-w-0 shrink-0 truncate leading-tight",
          isShort ? "text-[10px]" : "text-[11px]",
          isSelected ? "text-white/85" : "text-fg-3"
        )}
      >
        {formatTimeFromMinutes(entry.startMinutes)} –{" "}
        {formatTimeFromMinutes(entry.endMinutes)}
      </div>
    </div>
  )
}

function CalendarTimedEntryBlock({
  beginTimedDrag,
  colorMode,
  dayKeys,
  dragPreview,
  entry,
  index,
  isItemEditable,
  labelsById,
  onSelectItem,
  scheduleHover,
  scheduleHoverDetailClear,
  scheduleTimedMoveDrag,
  selectedItemId,
  suppressNextClickRef,
  timedEntryLayouts,
}: CalendarTimedEntryBlockProps) {
  const geometry = getTimedEntryGeometry({
    dayKeys,
    entry,
    index,
    timedEntryLayouts,
  })

  if (!geometry) {
    return null
  }

  const entryEditable = isItemEditable(entry.item) && !entry.isPartialDay
  const accent = getCalendarItemAccent(entry.item, colorMode, index, labelsById)
  const isSelected = selectedItemId === entry.item.id
  const isShortEntry = geometry.height < 38
  const isDragging =
    dragPreview?.item.id === entry.item.id && !entry.isPartialDay

  function handleClick() {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      return
    }

    onSelectItem(entry.item.id)
  }

  return (
    <div
      key={`${entry.item.id}-${entry.date}-${entry.startMinutes}-${entry.endMinutes}`}
      data-calendar-timed-event={entry.item.id}
      className={getTimedEntryClassName({
        editable: entryEditable,
        isDragging,
        isSelected,
      })}
      style={{
        ...getCalendarItemStyle(accent),
        left: `calc(${geometry.leftPercent}% + ${geometry.offsetPx}px)`,
        width: `calc(${geometry.widthPercent}% - ${
          geometry.offsetPx + geometry.rightOffsetPx
        }px)`,
        top: geometry.top,
        height: geometry.height,
        zIndex: isSelected ? 15 : 10 + geometry.columnIndex,
      }}
      onPointerDown={(event) =>
        entryEditable ? scheduleTimedMoveDrag(event, entry) : undefined
      }
      onClick={handleClick}
      onMouseEnter={(event) => scheduleHover(entry.item.id, event)}
      onMouseLeave={scheduleHoverDetailClear}
    >
      {!isSelected ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-[color:var(--cal-accent)]"
        />
      ) : null}
      {entryEditable ? (
        <CalendarTimedEntryResizeHandle
          action="resize-start"
          beginTimedDrag={beginTimedDrag}
          entry={entry}
        />
      ) : null}
      <CalendarTimedEntryContent
        entry={entry}
        isSelected={isSelected}
        isShort={isShortEntry}
      />
      {entryEditable ? (
        <CalendarTimedEntryResizeHandle
          action="resize-end"
          beginTimedDrag={beginTimedDrag}
          entry={entry}
        />
      ) : null}
    </div>
  )
}

function CalendarSettingsField({
  children,
  label,
  description,
}: {
  children: ReactNode
  label: string
  description?: string
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-2">
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-foreground">{label}</div>
        {description ? (
          <div className="text-[11.5px] text-fg-3">{description}</div>
        ) : null}
      </div>
      <div className="w-[160px] shrink-0">{children}</div>
    </div>
  )
}

function CalendarDatePicker({
  anchorDate,
  getTodayDate,
  onSelect,
  triggerLabel,
}: {
  anchorDate: Date
  getTodayDate: () => Date
  onSelect: (next: Date) => void
  triggerLabel: string
}) {
  const todayDate = getTodayDate()
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    startOfMonth(anchorDate)
  )

  const monthGridStart = useMemo(
    () => startOfWeek(startOfMonth(viewMonth)),
    [viewMonth]
  )
  const monthGridDays = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index)),
    [monthGridStart]
  )
  const yearStart = useMemo(
    () => new Date(viewMonth.getFullYear(), 0, 1),
    [viewMonth]
  )

  function commitDate(next: Date) {
    onSelect(startOfDay(next))
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setViewMonth(startOfMonth(anchorDate))
        }
        setOpen(nextOpen)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/title -mx-2 inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-[18px] font-semibold tracking-tight transition-colors hover:bg-surface-3"
          aria-label="Open date picker"
        >
          <span className="truncate">{triggerLabel}</span>
          <CaretDown className="size-3.5 text-fg-3 transition-colors group-hover/title:text-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[300px] gap-0 p-0"
      >
        <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous year"
            onClick={() => setViewMonth(addMonths(viewMonth, -12))}
          >
            <CaretDoubleLeft className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          >
            <CaretLeft className="size-3.5" />
          </Button>
          <button
            type="button"
            className="flex-1 truncate rounded-md px-2 py-1 text-center text-[13px] font-semibold transition-colors hover:bg-surface-3"
            onClick={() => commitDate(getTodayDate())}
            aria-label="Jump to today"
          >
            {format(viewMonth, "MMMM yyyy")}
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          >
            <CaretRight className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next year"
            onClick={() => setViewMonth(addMonths(viewMonth, 12))}
          >
            <CaretDoubleRight className="size-3.5" />
          </Button>
        </div>
        <div className="px-3 py-2">
          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10.5px] font-medium tracking-wider text-fg-4 uppercase">
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
              <div key={`${label}-${index}`}>{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGridDays.map((day) => {
              const inMonth = isSameMonth(day, viewMonth)
              const isSelected = isSameDay(day, anchorDate)
              const isToday = isSameDay(day, todayDate)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => commitDate(day)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-md text-[12.5px] font-medium transition-colors",
                    isSelected
                      ? "bg-[color:var(--priority-urgent)] text-white"
                      : isToday
                        ? "bg-surface-3 text-foreground"
                        : inMonth
                          ? "text-foreground hover:bg-surface-3"
                          : "text-fg-4 hover:bg-surface-3"
                  )}
                >
                  {format(day, "d")}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line-soft px-3 py-2">
          <div className="text-[11px] text-fg-3">
            {format(yearStart, "yyyy")}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => commitDate(getTodayDate())}
          >
            Jump to today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function CalendarSettingsButton({
  colorMode,
  onColorModeChange,
  timeInterval,
  onTimeIntervalChange,
  maxAllDayEvents,
  onMaxAllDayEventsChange,
  weekDayCount = 7,
  onWeekDayCountChange = () => undefined,
  showWeekDayCount = false,
  showWeekends = true,
  onShowWeekendsChange = () => undefined,
  weekStart = "monday",
  onWeekStartChange = () => undefined,
  timeZone,
  onTimeZoneChange,
}: {
  colorMode: CalendarColorMode
  onColorModeChange: (mode: CalendarColorMode) => void
  timeInterval: CalendarTimeInterval
  onTimeIntervalChange: (interval: CalendarTimeInterval) => void
  maxAllDayEvents: number
  onMaxAllDayEventsChange: (maxAllDayEvents: number) => void
  weekDayCount?: CalendarWeekDayCount
  onWeekDayCountChange?: (weekDayCount: CalendarWeekDayCount) => void
  showWeekDayCount?: boolean
  showWeekends?: boolean
  onShowWeekendsChange?: (showWeekends: boolean) => void
  weekStart?: CalendarWeekStart
  onWeekStartChange?: (weekStart: CalendarWeekStart) => void
  timeZone: string
  onTimeZoneChange: (timeZone: string) => void
}) {
  const timeZoneOptions = useMemo(() => getSupportedTimeZones(), [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Calendar settings"
        >
          <GearSix className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[340px] gap-0 p-0"
      >
        <div className="border-b border-line-soft px-4 py-3">
          <div className="text-[13px] font-semibold text-foreground">
            Calendar settings
          </div>
          <div className="text-[11.5px] text-fg-3">
            Tune how this calendar looks for you.
          </div>
        </div>
        <div className="px-4 py-1.5">
          <div className="divide-y divide-line-soft">
            <CalendarSettingsField
              label="Color formatting"
              description="How events are colored."
            >
              <Select
                value={colorMode}
                onValueChange={(value) => {
                  if (isCalendarColorMode(value)) {
                    onColorModeChange(value)
                  }
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-full"
                  aria-label="Color formatting"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[60]">
                  {CALENDAR_COLOR_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CalendarSettingsField>
            <CalendarSettingsField
              label="Time interval"
              description="Spacing between hour labels."
            >
              <Select
                value={timeInterval}
                onValueChange={(value) => {
                  if (isCalendarTimeInterval(value)) {
                    onTimeIntervalChange(value)
                  }
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-full"
                  aria-label="Time interval"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[60]">
                  {CALENDAR_TIME_INTERVAL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CalendarSettingsField>
            {showWeekDayCount ? (
              <CalendarSettingsField
                label="Show number of days"
                description="Visible days in week view."
              >
                <Select
                  value={String(normalizeWeekDayCount(weekDayCount))}
                  onValueChange={(value) =>
                    onWeekDayCountChange(parseWeekDayCount(value))
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full"
                    aria-label="Show number of days"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[60]">
                    {CALENDAR_WEEK_DAY_COUNT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CalendarSettingsField>
            ) : null}
            <CalendarSettingsField
              label="Weekends"
              description="Show or hide weekends."
            >
              <Select
                value={showWeekends ? "show" : "hide"}
                onValueChange={(value) => {
                  if (isCalendarWeekendVisibility(value)) {
                    onShowWeekendsChange(value === "show")
                  }
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-full"
                  aria-label="Weekends"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[60]">
                  {CALENDAR_WEEKEND_VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CalendarSettingsField>
            <CalendarSettingsField
              label="Week starts on"
              description="First day in week and month views."
            >
              <Select
                value={weekStart}
                onValueChange={(value) => {
                  if (isCalendarWeekStart(value)) {
                    onWeekStartChange(value)
                  }
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-full"
                  aria-label="Week starts on"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[60]">
                  {CALENDAR_WEEK_START_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CalendarSettingsField>
            <CalendarSettingsField
              label="All-day events shown"
              description="Cap before collapsing to a count."
            >
              <Select
                value={String(normalizeMaxAllDayEvents(maxAllDayEvents))}
                onValueChange={(value) =>
                  onMaxAllDayEventsChange(parseMaxAllDayEvents(value))
                }
              >
                <SelectTrigger
                  size="sm"
                  className="w-full"
                  aria-label="Max all-day events shown"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[60]">
                  {CALENDAR_MAX_ALL_DAY_EVENT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CalendarSettingsField>
            <CalendarSettingsField
              label="Time zone"
              description="Times shown in this zone."
            >
              <Select value={timeZone} onValueChange={onTimeZoneChange}>
                <SelectTrigger
                  size="sm"
                  className="w-full"
                  aria-label="Time zone"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[60]">
                  {timeZoneOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {formatTimeZoneLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CalendarSettingsField>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
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

function getAllDaySpanRowCount(spans: AllDayCalendarSpan[]) {
  return spans.length === 0
    ? 0
    : Math.max(...spans.map((span) => span.rowIndex + 1))
}

function getVisibleAllDayRowCount({
  expanded,
  maxAllDayEvents,
  spans,
}: {
  expanded: boolean
  maxAllDayEvents: number
  spans: AllDayCalendarSpan[]
}) {
  const rowCount = getAllDaySpanRowCount(spans)

  return expanded
    ? rowCount
    : Math.min(rowCount, normalizeMaxAllDayEvents(maxAllDayEvents))
}

function getAllDayHiddenCounts(
  spans: AllDayCalendarSpan[],
  visibleRowCount: number,
  dayCount: number
) {
  const counts = Array.from({ length: dayCount }, () => 0)

  spans.forEach((span) => {
    if (span.rowIndex < visibleRowCount) {
      return
    }

    for (
      let dayIndex = span.startIndex;
      dayIndex <= span.endIndex;
      dayIndex++
    ) {
      counts[dayIndex] = (counts[dayIndex] ?? 0) + 1
    }
  })

  return counts
}

function hasHiddenAllDayEvents(hiddenCounts: number[]) {
  return hiddenCounts.some((count) => count > 0)
}

function getAllDayLaneHeightForRows(
  visibleRowCount: number,
  hasHiddenEvents: boolean,
  minimumHeight = ALL_DAY_LANE_MIN_HEIGHT
) {
  const eventRowsHeight =
    visibleRowCount > 0
      ? visibleRowCount * ALL_DAY_EVENT_HEIGHT +
        Math.max(0, visibleRowCount - 1) * ALL_DAY_EVENT_GAP
      : 0
  const hiddenButtonHeight = hasHiddenEvents
    ? (visibleRowCount > 0 ? ALL_DAY_EVENT_GAP : 0) + ALL_DAY_MORE_BUTTON_HEIGHT
    : 0

  return Math.max(
    minimumHeight,
    ALL_DAY_LANE_TOP_PADDING +
      eventRowsHeight +
      hiddenButtonHeight +
      ALL_DAY_LANE_BOTTOM_PADDING
  )
}

function getAllDayEventTop(rowIndex: number) {
  return (
    ALL_DAY_LANE_TOP_PADDING +
    rowIndex * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_EVENT_GAP)
  )
}

function getAllDayMoreButtonTop(visibleRowCount: number) {
  return (
    ALL_DAY_LANE_TOP_PADDING +
    visibleRowCount * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_EVENT_GAP)
  )
}

function getAllDayRangeKey(prefix: string, dayKeys: string[]) {
  return `${prefix}:${dayKeys.join(":")}`
}

function getMonthTimedEventRowCapacity({
  allDayAreaHeight,
  rowHeight,
}: {
  allDayAreaHeight: number
  rowHeight: number
}) {
  const availableHeight =
    rowHeight -
    allDayAreaHeight -
    MONTH_DAY_HEADER_HEIGHT -
    MONTH_DAY_PADDING_Y -
    MONTH_DAY_EVENTS_TOP_GAP
  const rowStride = MONTH_TIMED_EVENT_ROW_HEIGHT + MONTH_TIMED_EVENT_ROW_GAP

  return Math.max(
    1,
    Math.floor(
      (Math.max(MONTH_TIMED_EVENT_ROW_HEIGHT, availableHeight) +
        MONTH_TIMED_EVENT_ROW_GAP) /
        rowStride
    )
  )
}

function getVisibleMonthTimedEntries(
  entries: MonthCalendarEntry[],
  rowCapacity: number
) {
  if (entries.length <= rowCapacity) {
    return {
      hiddenCount: 0,
      visibleEntries: entries,
    }
  }

  const visibleCount = Math.max(1, rowCapacity - 1)

  return {
    hiddenCount: entries.length - visibleCount,
    visibleEntries: entries.slice(0, visibleCount),
  }
}

function getCalendarInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? target.closest(
        [
          "[data-calendar-all-day-event]",
          "[data-calendar-more-button]",
          "[data-calendar-timed-event]",
          "[data-calendar-resize-handle]",
        ].join(",")
      )
    : null
}

function isCalendarBlankTarget(target: EventTarget | null) {
  return getCalendarInteractiveTarget(target) === null
}

function getSelectionPreviewFromSlots(
  originSlot: CalendarPointerSlot,
  currentSlot: CalendarPointerSlot
): CalendarSelectionPreview {
  const date = currentSlot.date
  const startMinutes = Math.min(originSlot.minutes, currentSlot.minutes)
  const rawEndMinutes = Math.max(originSlot.minutes, currentSlot.minutes)
  const endMinutes = Math.min(
    24 * 60 - 1,
    Math.max(startMinutes + MIN_TIMED_DURATION_MINUTES, rawEndMinutes)
  )

  return {
    date,
    startMinutes,
    endMinutes,
  }
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

type TimedEntryLayout = {
  entry: TimedCalendarEntry
  index: number
  column: number
  columns: number
}

function layoutTimedEntriesForDay(
  entries: Array<{ entry: TimedCalendarEntry; index: number }>
): TimedEntryLayout[] {
  if (entries.length === 0) {
    return []
  }

  const sorted = [...entries].sort(
    (left, right) =>
      left.entry.startMinutes - right.entry.startMinutes ||
      right.entry.endMinutes -
        right.entry.startMinutes -
        (left.entry.endMinutes - left.entry.startMinutes)
  )

  const result: TimedEntryLayout[] = []
  let cluster: typeof sorted = []
  let clusterEnd = -Infinity

  function flushCluster(group: typeof sorted) {
    if (group.length === 0) {
      return
    }

    const columnEnds: number[] = []
    const placements = group.map((member) => {
      let columnIndex = columnEnds.findIndex(
        (end) => end <= member.entry.startMinutes
      )

      if (columnIndex === -1) {
        columnIndex = columnEnds.length
        columnEnds.push(member.entry.endMinutes)
      } else {
        columnEnds[columnIndex] = member.entry.endMinutes
      }

      return { member, columnIndex }
    })

    const totalColumns = columnEnds.length

    placements.forEach(({ member, columnIndex }) => {
      result.push({
        entry: member.entry,
        index: member.index,
        column: columnIndex,
        columns: totalColumns,
      })
    })
  }

  sorted.forEach((member) => {
    if (cluster.length === 0 || member.entry.startMinutes < clusterEnd) {
      cluster.push(member)
      clusterEnd = Math.max(clusterEnd, member.entry.endMinutes)
      return
    }

    flushCluster(cluster)
    cluster = [member]
    clusterEnd = member.entry.endMinutes
  })

  flushCluster(cluster)

  return result
}

function CalendarToolbar({
  anchorDate,
  colorMode,
  maxAllDayEvents,
  mode,
  moveAnchor,
  onAnchorDateChange,
  onColorModeChange,
  onMaxAllDayEventsChange,
  onModeChange,
  onShowWeekendsChange,
  onTimeIntervalChange,
  onTimeZoneChange,
  onWeekDayCountChange,
  onWeekStartChange,
  showSettingsButton,
  showWeekends,
  timeInterval,
  timeZone,
  toolbarAccessory,
  weekDayCount,
  weekStart,
}: CalendarToolbarProps) {
  function getTodayDate() {
    return getTodayDateInTimeZone(timeZone)
  }

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-3 overflow-hidden border-b border-line-soft px-5 py-3">
      <div className="min-w-0 flex-1">
        <CalendarDatePicker
          anchorDate={anchorDate}
          triggerLabel={getModeTitle(anchorDate, mode)}
          onSelect={onAnchorDateChange}
          getTodayDate={getTodayDate}
        />
      </div>
      <div className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-surface-3/70 p-0.5">
        {(["day", "week", "month"] as const).map((option) => (
          <ViewTab
            key={option}
            active={mode === option}
            className="capitalize"
            onClick={() => onModeChange(option)}
          >
            {option}
          </ViewTab>
        ))}
      </div>
      <div className="inline-flex shrink-0 items-center gap-1">
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
          onClick={() => onAnchorDateChange(getTodayDate())}
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
      {toolbarAccessory}
      {showSettingsButton ? (
        <CalendarSettingsButton
          colorMode={colorMode}
          onColorModeChange={onColorModeChange}
          timeInterval={timeInterval}
          onTimeIntervalChange={onTimeIntervalChange}
          maxAllDayEvents={maxAllDayEvents}
          onMaxAllDayEventsChange={onMaxAllDayEventsChange}
          weekDayCount={weekDayCount}
          onWeekDayCountChange={onWeekDayCountChange}
          showWeekDayCount={mode === "week"}
          showWeekends={showWeekends}
          onShowWeekendsChange={onShowWeekendsChange}
          weekStart={weekStart}
          onWeekStartChange={onWeekStartChange}
          timeZone={timeZone}
          onTimeZoneChange={onTimeZoneChange}
        />
      ) : null}
    </div>
  )
}

function CalendarMonthTimedEntryButton({
  colorMode,
  entry,
  getCalendarItemInteractionProps,
  index,
  isSelected,
  labelsById,
}: {
  colorMode: CalendarColorMode
  entry: MonthCalendarEntry
  getCalendarItemInteractionProps: CalendarItemInteractionPropsGetter
  index: number
  isSelected: boolean
  labelsById: EventAccentLabelLookup
}) {
  const accent = getCalendarItemAccent(entry.item, colorMode, index, labelsById)

  return (
    <button
      data-calendar-timed-event={entry.item.id}
      className={cn(
        "relative flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-md py-1 pr-2 pl-[14px] text-left text-[12px] transition-colors",
        isSelected
          ? "bg-[color:var(--cal-accent)] text-white shadow-sm"
          : "bg-[color:var(--cal-accent-tint)] text-foreground hover:bg-[color:var(--cal-accent-tint-hover)]"
      )}
      style={getCalendarItemStyle(accent)}
      {...getCalendarItemInteractionProps(entry.item.id)}
    >
      {!isSelected ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-[color:var(--cal-accent)]"
        />
      ) : null}
      {entry.timeLabel ? (
        <span
          className={cn(
            "shrink-0 text-[11px]",
            isSelected ? "text-white/85" : "text-fg-3"
          )}
        >
          {entry.timeLabel}
        </span>
      ) : null}
      <span className="truncate">{entry.item.title}</span>
    </button>
  )
}

function CalendarMonthDayCell({
  allDayAreaHeight,
  anchorDate,
  colorMode,
  day,
  dayKey,
  getCalendarItemInteractionProps,
  handleMonthBlankClick,
  handleMonthBlankDoubleClick,
  labelsById,
  openDayFromMonth,
  rowCapacity,
  selectedItemId,
  timedEntries,
}: {
  allDayAreaHeight: number
  anchorDate: Date
  colorMode: CalendarColorMode
  day: Date
  dayKey: string
  getCalendarItemInteractionProps: CalendarItemInteractionPropsGetter
  handleMonthBlankClick: (event: MouseEvent<HTMLDivElement>) => void
  handleMonthBlankDoubleClick: (
    event: MouseEvent<HTMLDivElement>,
    date: string
  ) => void
  labelsById: EventAccentLabelLookup
  openDayFromMonth: (dayKey: string) => void
  rowCapacity: number
  selectedItemId: string | null
  timedEntries: TimedCalendarEntry[]
}) {
  const entries = getMonthCalendarEntries({ dayKey, timedEntries })
  const { hiddenCount, visibleEntries } = getVisibleMonthTimedEntries(
    entries,
    rowCapacity
  )

  return (
    <div
      className={cn(
        "border-r border-line-soft p-2",
        !isSameMonth(day, anchorDate) && "bg-surface/40 text-fg-4"
      )}
      onClick={handleMonthBlankClick}
      onDoubleClick={(event) => handleMonthBlankDoubleClick(event, dayKey)}
    >
      <div className="mb-2 text-[11px] font-medium">{format(day, "EEE d")}</div>
      <div className="space-y-1" style={{ marginTop: allDayAreaHeight }}>
        {visibleEntries.map((entry, index) => (
          <CalendarMonthTimedEntryButton
            key={entry.item.id}
            colorMode={colorMode}
            entry={entry}
            getCalendarItemInteractionProps={getCalendarItemInteractionProps}
            index={index}
            isSelected={selectedItemId === entry.item.id}
            labelsById={labelsById}
          />
        ))}
        {hiddenCount > 0 ? (
          <button
            type="button"
            data-calendar-more-button
            className="h-[22px] w-full truncate rounded-md px-2 text-left text-[11px] font-medium text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation()
              openDayFromMonth(dayKey)
            }}
          >
            + {hiddenCount} more
          </button>
        ) : null}
      </div>
    </div>
  )
}

function CalendarMonthAllDaySpanButton({
  colorMode,
  columnCount,
  getCalendarItemInteractionProps,
  index,
  labelsById,
  selectedItemId,
  span,
}: {
  colorMode: CalendarColorMode
  columnCount: number
  getCalendarItemInteractionProps: CalendarItemInteractionPropsGetter
  index: number
  labelsById: EventAccentLabelLookup
  selectedItemId: string | null
  span: AllDayCalendarSpan
}) {
  const { accent, isSelected, left, width } = getAllDaySpanRenderModel({
    span,
    index,
    columnCount,
    selectedItemId,
    colorMode,
    labelsById,
  })

  return (
    <button
      data-calendar-all-day-event={span.entry.item.id}
      className={cn(
        "absolute z-10 truncate overflow-hidden rounded-md pr-2 pl-[14px] text-left text-[12px] leading-[26px] font-medium transition-colors",
        isSelected
          ? "bg-[color:var(--cal-accent)] text-white shadow-sm"
          : "bg-[color:var(--cal-accent-tint)] text-foreground hover:bg-[color:var(--cal-accent-tint-hover)]"
      )}
      style={{
        ...getCalendarItemStyle(accent),
        left,
        width,
        top: 30 + getAllDayEventTop(span.rowIndex),
        height: ALL_DAY_EVENT_HEIGHT,
      }}
      {...getCalendarItemInteractionProps(span.entry.item.id)}
    >
      {!isSelected ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-[color:var(--cal-accent)]"
        />
      ) : null}
      {span.entry.item.title}
    </button>
  )
}

function CalendarMonthWeekRow({
  allDayEntries,
  anchorDate,
  collapseAllDayRange,
  colorMode,
  getCalendarItemInteractionProps,
  handleMonthBlankClick,
  handleMonthBlankDoubleClick,
  isAllDayRangeExpanded,
  labelsById,
  maxAllDayEvents,
  monthBaseRowHeight,
  openDayFromMonth,
  selectedItemId,
  timedEntries,
  weekDays,
}: CalendarMonthWeekRowProps) {
  const weekDayKeys = weekDays.map(getDateKey)
  const weekColumnCount = Math.max(1, weekDayKeys.length)
  const weekAllDaySpans = getAllDayCalendarSpans(allDayEntries, weekDayKeys)
  const weekAllDayRangeKey = getAllDayRangeKey(
    `month:${maxAllDayEvents}`,
    weekDayKeys
  )
  const weekAllDayRangeExpanded = isAllDayRangeExpanded(weekAllDayRangeKey)
  const weekAllDayRowCount = getAllDaySpanRowCount(weekAllDaySpans)
  const weekCanCollapseAllDayItems =
    weekAllDayRangeExpanded && weekAllDayRowCount > maxAllDayEvents
  const weekVisibleAllDayRowCount = getVisibleAllDayRowCount({
    expanded: weekAllDayRangeExpanded,
    maxAllDayEvents,
    spans: weekAllDaySpans,
  })
  const weekHiddenAllDayCounts = getAllDayHiddenCounts(
    weekAllDaySpans,
    weekVisibleAllDayRowCount,
    weekDayKeys.length
  )
  const monthAllDayAreaHeight = getAllDayLaneHeightForRows(
    weekVisibleAllDayRowCount,
    hasHiddenAllDayEvents(weekHiddenAllDayCounts) || weekCanCollapseAllDayItems,
    0
  )
  const monthTimedEventRowCapacity = getMonthTimedEventRowCapacity({
    allDayAreaHeight: monthAllDayAreaHeight,
    rowHeight: monthBaseRowHeight,
  })
  const rowMinHeight = Math.max(
    monthBaseRowHeight,
    MONTH_GRID_MIN_ROW_HEIGHT,
    MONTH_DAY_PADDING_Y +
      MONTH_DAY_HEADER_HEIGHT +
      MONTH_DAY_EVENTS_TOP_GAP +
      monthAllDayAreaHeight +
      monthTimedEventRowCapacity *
        (MONTH_TIMED_EVENT_ROW_HEIGHT + MONTH_TIMED_EVENT_ROW_GAP)
  )

  return (
    <div
      className="relative grid border-b border-line-soft"
      style={{
        gridTemplateColumns: `repeat(${weekColumnCount}, minmax(0, 1fr))`,
        minHeight: rowMinHeight,
      }}
    >
      {weekDays.map((day) => {
        const dayKey = getDateKey(day)

        return (
          <CalendarMonthDayCell
            key={dayKey}
            allDayAreaHeight={monthAllDayAreaHeight}
            anchorDate={anchorDate}
            colorMode={colorMode}
            day={day}
            dayKey={dayKey}
            getCalendarItemInteractionProps={getCalendarItemInteractionProps}
            handleMonthBlankClick={handleMonthBlankClick}
            handleMonthBlankDoubleClick={handleMonthBlankDoubleClick}
            labelsById={labelsById}
            openDayFromMonth={openDayFromMonth}
            rowCapacity={monthTimedEventRowCapacity}
            selectedItemId={selectedItemId}
            timedEntries={timedEntries}
          />
        )
      })}
      {weekAllDaySpans
        .filter((span) => span.rowIndex < weekVisibleAllDayRowCount)
        .map((span, index) => (
          <CalendarMonthAllDaySpanButton
            key={span.entry.item.id}
            colorMode={colorMode}
            columnCount={weekColumnCount}
            getCalendarItemInteractionProps={getCalendarItemInteractionProps}
            index={index}
            labelsById={labelsById}
            selectedItemId={selectedItemId}
            span={span}
          />
        ))}
      {weekHiddenAllDayCounts.map((hiddenCount, dayIndex) =>
        hiddenCount > 0 ? (
          <button
            key={`${weekDayKeys[dayIndex]}-more`}
            type="button"
            data-calendar-more-button
            className="absolute z-20 h-[22px] truncate rounded-md px-2 text-left text-[11px] font-medium text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
            style={{
              left: `calc(${(dayIndex / weekColumnCount) * 100}% + 6px)`,
              width: `calc(${100 / weekColumnCount}% - 12px)`,
              top: 30 + getAllDayMoreButtonTop(weekVisibleAllDayRowCount),
            }}
            onClick={() =>
              openDayFromMonth(
                weekDayKeys[dayIndex] ??
                  weekDayKeys[0] ??
                  getDateKey(anchorDate)
              )
            }
          >
            + {hiddenCount} more
          </button>
        ) : null
      )}
      {weekCanCollapseAllDayItems ? (
        <button
          type="button"
          data-calendar-more-button
          className="absolute z-20 h-[22px] truncate rounded-md px-2 text-left text-[11px] font-medium text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
          style={{
            left: "6px",
            width: "calc(100% - 12px)",
            top: 30 + getAllDayMoreButtonTop(weekVisibleAllDayRowCount),
          }}
          onClick={() => collapseAllDayRange(weekAllDayRangeKey)}
        >
          Collapse events
        </button>
      ) : null}
    </div>
  )
}

function CalendarMonthView({
  allDayEntries,
  anchorDate,
  collapseAllDayRange,
  colorMode,
  getCalendarItemInteractionProps,
  handleMonthBlankClick,
  handleMonthBlankDoubleClick,
  isAllDayRangeExpanded,
  labelsById,
  maxAllDayEvents,
  monthBaseRowHeight,
  monthGridRef,
  monthWeeks,
  openDayFromMonth,
  selectedItemId,
  timedEntries,
}: CalendarMonthViewProps) {
  return (
    <div
      ref={monthGridRef}
      className="grid min-h-0 flex-1 overflow-auto overscroll-none"
    >
      {monthWeeks.map((weekDays) => {
        const weekDayKeys = weekDays.map(getDateKey)

        return (
          <CalendarMonthWeekRow
            key={weekDayKeys.join(":")}
            allDayEntries={allDayEntries}
            anchorDate={anchorDate}
            collapseAllDayRange={collapseAllDayRange}
            colorMode={colorMode}
            getCalendarItemInteractionProps={getCalendarItemInteractionProps}
            handleMonthBlankClick={handleMonthBlankClick}
            handleMonthBlankDoubleClick={handleMonthBlankDoubleClick}
            isAllDayRangeExpanded={isAllDayRangeExpanded}
            labelsById={labelsById}
            maxAllDayEvents={maxAllDayEvents}
            monthBaseRowHeight={monthBaseRowHeight}
            openDayFromMonth={openDayFromMonth}
            selectedItemId={selectedItemId}
            timedEntries={timedEntries}
            weekDays={weekDays}
          />
        )
      })}
    </div>
  )
}

function CalendarDayHeader({
  dayColumnsContentWidth,
  dayColumnsGridTemplateColumns,
  dayHeaderScrollRef,
  days,
}: {
  dayColumnsContentWidth: string
  dayColumnsGridTemplateColumns: string
  dayHeaderScrollRef: RefObject<HTMLDivElement | null>
  days: Date[]
}) {
  return (
    <div
      ref={dayHeaderScrollRef}
      className="overflow-hidden border-b border-line-soft bg-background"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: dayColumnsGridTemplateColumns,
          width: dayColumnsContentWidth,
        }}
      >
        {days.map((day) => {
          const dayState = getCalendarDayDisplayState(day)

          return (
            <div
              key={dayState.dayKey}
              className={cn(
                "flex items-center justify-center gap-1.5 border-l border-line-soft px-3 py-2 text-center",
                dayState.isWeekend && "bg-surface-2/30"
              )}
            >
              <span
                className={cn(
                  "text-[12px] font-medium",
                  dayState.isToday ? "text-foreground" : "text-fg-3"
                )}
              >
                {format(day, "EEE")}
              </span>
              <span
                className={cn(
                  "inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-md px-1 text-[12px] leading-none font-semibold",
                  dayState.isToday
                    ? "bg-[color:var(--priority-urgent)] text-white"
                    : "text-foreground"
                )}
              >
                {format(day, "d")}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getCalendarDayDisplayState(day: Date) {
  return {
    dayKey: getDateKey(day),
    isToday: isSameDay(day, new Date()),
    isWeekend: day.getDay() === 0 || day.getDay() === 6,
  }
}

function CalendarAllDaySpanButton({
  colorMode,
  columnCount,
  dayKeys,
  getCalendarItemInteractionProps,
  index,
  isItemEditable,
  labelsById,
  onDragStart,
  selectedItemId,
  span,
}: {
  colorMode: CalendarColorMode
  columnCount: number
  dayKeys: string[]
  getCalendarItemInteractionProps: CalendarItemInteractionPropsGetter
  index: number
  isItemEditable: (item: WorkItem) => boolean
  labelsById: EventAccentLabelLookup
  onDragStart: () => void
  selectedItemId: string | null
  span: AllDayCalendarSpan
}) {
  const { accent, isSelected, left, width } = getAllDaySpanRenderModel({
    span,
    index,
    columnCount,
    selectedItemId,
    colorMode,
    labelsById,
  })
  const startsBeforeView = span.entry.startDate < dayKeys[span.startIndex]
  const endsAfterView = span.entry.endDate > dayKeys[span.endIndex]

  return (
    <button
      data-calendar-all-day-event={span.entry.item.id}
      draggable={isItemEditable(span.entry.item)}
      className={cn(
        "absolute z-10 truncate text-left text-[12px] leading-[26px] font-medium transition-colors",
        "overflow-hidden",
        startsBeforeView ? "rounded-l-none pl-2" : "rounded-l-md pl-[12px]",
        endsAfterView ? "rounded-r-none pr-2" : "rounded-r-md pr-2",
        isItemEditable(span.entry.item) && "cursor-grab active:cursor-grabbing",
        isSelected
          ? "bg-[color:var(--cal-accent)] text-white shadow-sm"
          : "bg-[color:var(--cal-accent-tint)] text-foreground hover:bg-[color:var(--cal-accent-tint-hover)]"
      )}
      style={{
        ...getCalendarItemStyle(accent),
        left,
        width,
        top: getAllDayEventTop(span.rowIndex),
        height: ALL_DAY_EVENT_HEIGHT,
      }}
      onDragStart={(event) => {
        onDragStart()
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/calendar-item", span.entry.item.id)
      }}
      {...getCalendarItemInteractionProps(span.entry.item.id)}
    >
      {!isSelected && !startsBeforeView ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-[color:var(--cal-accent)]"
        />
      ) : null}
      {span.entry.item.title}
    </button>
  )
}

function CalendarAllDayDragPreview({
  colorMode,
  dayKeys,
  dragPreview,
  labelsById,
}: {
  colorMode: CalendarColorMode
  dayKeys: string[]
  dragPreview: CalendarDragPreview | null
  labelsById: EventAccentLabelLookup
}) {
  if (!dragPreview?.isAllDay) {
    return null
  }

  const dayIndex = dayKeys.indexOf(dragPreview.date)

  if (dayIndex === -1) {
    return null
  }

  const accent = getCalendarItemAccent(
    dragPreview.item,
    colorMode,
    0,
    labelsById
  )
  const dayWidthPercent = 100 / dayKeys.length

  return (
    <div
      data-testid="calendar-all-day-drag-preview"
      className="pointer-events-none absolute z-40 truncate rounded-md border border-[color:var(--cal-accent)] bg-[color:var(--cal-accent)]/25 py-0 pr-2 pl-[14px] text-left text-[12px] leading-[26px] font-medium text-foreground shadow-lg ring-2 ring-[color:var(--cal-accent)]/25"
      style={{
        ...getCalendarItemStyle(accent),
        left: `calc(${dayWidthPercent * dayIndex}% + 6px)`,
        width: `calc(${dayWidthPercent}% - 12px)`,
        top: getAllDayEventTop(0),
        height: ALL_DAY_EVENT_HEIGHT,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-[color:var(--cal-accent)]"
      />
      {dragPreview.item.title}
    </div>
  )
}

function CalendarAllDayMoreControls({
  collapseAllDayRange,
  expandAllDayRange,
  hiddenAllDayCounts,
  rangeExpanded,
  rangeKey,
  visibleRowCount,
}: {
  collapseAllDayRange: (rangeKey: string) => void
  expandAllDayRange: (rangeKey: string) => void
  hiddenAllDayCounts: number[]
  rangeExpanded: boolean
  rangeKey: string
  visibleRowCount: number
}) {
  const dayCount = Math.max(1, hiddenAllDayCounts.length)

  return (
    <>
      {hiddenAllDayCounts.map((hiddenCount, dayIndex) =>
        hiddenCount > 0 ? (
          <button
            key={`${dayIndex}-more`}
            type="button"
            data-calendar-more-button
            className="absolute z-20 h-[22px] truncate rounded-md px-2 text-left text-[11px] font-medium text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
            style={{
              left: `calc(${(dayIndex / dayCount) * 100}% + 6px)`,
              width: `calc(${100 / dayCount}% - 12px)`,
              top: getAllDayMoreButtonTop(visibleRowCount),
            }}
            onClick={() => expandAllDayRange(rangeKey)}
          >
            + {hiddenCount} more
          </button>
        ) : null
      )}
      {rangeExpanded ? (
        <button
          type="button"
          data-calendar-more-button
          className="absolute z-20 h-[22px] truncate rounded-md px-2 text-left text-[11px] font-medium text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
          style={{
            left: "6px",
            width: "calc(100% - 12px)",
            top: getAllDayMoreButtonTop(visibleRowCount),
          }}
          onClick={() => collapseAllDayRange(rangeKey)}
        >
          Collapse events
        </button>
      ) : null}
    </>
  )
}

function CalendarAllDayScrollArea({
  allDayLaneHeight,
  allDayRangeExpanded,
  allDayRangeKey,
  collapseAllDayRange,
  colorMode,
  dayAllDayScrollRef,
  dayColumnsContentWidth,
  dayColumnsGridTemplateColumns,
  dayKeys,
  days,
  dragPreview,
  expandAllDayRange,
  getCalendarItemInteractionProps,
  handleAllDayBlankClick,
  handleAllDayBlankDoubleClick,
  handleAllDayDrop,
  hiddenAllDayCounts,
  isItemEditable,
  labelsById,
  onAllDayDragStart,
  selectedItemId,
  visibleAllDayRowCount,
  visibleAllDaySpans,
}: CalendarAllDayScrollAreaProps) {
  return (
    <div
      ref={dayAllDayScrollRef}
      className="overflow-hidden border-b border-line-soft bg-background"
      style={{ minHeight: allDayLaneHeight }}
    >
      <div
        className="relative"
        style={{
          minHeight: allDayLaneHeight,
          width: dayColumnsContentWidth,
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleAllDayDrop}
        onClick={handleAllDayBlankClick}
        onDoubleClick={handleAllDayBlankDoubleClick}
      >
        <div
          className="pointer-events-none absolute inset-0 grid"
          style={{ gridTemplateColumns: dayColumnsGridTemplateColumns }}
        >
          {days.map((day) => (
            <div
              key={getDateKey(day)}
              className={cn(
                "border-l border-line-soft",
                (day.getDay() === 0 || day.getDay() === 6) && "bg-surface-2/30"
              )}
            />
          ))}
        </div>
        {visibleAllDaySpans.map((span, index) => (
          <CalendarAllDaySpanButton
            key={span.entry.item.id}
            colorMode={colorMode}
            columnCount={dayKeys.length}
            dayKeys={dayKeys}
            getCalendarItemInteractionProps={getCalendarItemInteractionProps}
            index={index}
            isItemEditable={isItemEditable}
            labelsById={labelsById}
            onDragStart={onAllDayDragStart}
            selectedItemId={selectedItemId}
            span={span}
          />
        ))}
        <CalendarAllDayDragPreview
          colorMode={colorMode}
          dayKeys={dayKeys}
          dragPreview={dragPreview}
          labelsById={labelsById}
        />
        <CalendarAllDayMoreControls
          collapseAllDayRange={collapseAllDayRange}
          expandAllDayRange={expandAllDayRange}
          hiddenAllDayCounts={hiddenAllDayCounts}
          rangeExpanded={allDayRangeExpanded}
          rangeKey={allDayRangeKey}
          visibleRowCount={visibleAllDayRowCount}
        />
      </div>
    </div>
  )
}

function CalendarTimeRail({
  nowDayIndex,
  nowTop,
  nowWallTime,
  timeRailContentRef,
  timeRows,
}: {
  nowDayIndex: number
  nowTop: number
  nowWallTime: CalendarWallTime
  timeRailContentRef: RefObject<HTMLDivElement | null>
  timeRows: CalendarTimeRow[]
}) {
  return (
    <div className="min-h-0 overflow-hidden border-r border-line-soft bg-background">
      <div
        ref={timeRailContentRef}
        className="relative will-change-transform"
        style={{ height: HOUR_HEIGHT * 24 }}
      >
        {timeRows.map((row) => (
          <div
            key={row.hour}
            className="relative pr-2 text-right text-[11px] font-medium text-fg-4"
            style={{ height: row.height }}
          >
            {row.hour === 0 ? null : (
              <span className="absolute -top-1.5 right-2 bg-background px-1">
                {format(new Date(2026, 0, 1, row.hour), "ha")}
              </span>
            )}
          </div>
        ))}
        {nowDayIndex >= 0 ? (
          <div
            className="pointer-events-none absolute right-1 z-30 -translate-y-1/2 rounded-full bg-[color:var(--priority-urgent)] px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white shadow-sm"
            style={{ top: nowTop }}
          >
            {nowWallTime.time}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CalendarTimedGridBackground({
  days,
  timeRows,
}: {
  days: Date[]
  timeRows: CalendarTimeRow[]
}) {
  return (
    <>
      {days.map((day) => {
        const dayState = getCalendarDayDisplayState(day)

        return (
          <div
            key={dayState.dayKey}
            className={cn(
              "relative border-l border-line-soft",
              dayState.isWeekend && "bg-surface-2/30",
              dayState.isToday && "bg-[color:var(--priority-urgent)]/[0.04]"
            )}
          >
            {timeRows.map((row) => (
              <div
                key={row.hour}
                className="relative border-b border-line-soft"
                style={{ height: row.height }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line-soft/40" />
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

function CalendarNowMarker({
  dayKeys,
  nowDayIndex,
  nowTop,
}: {
  dayKeys: string[]
  nowDayIndex: number
  nowTop: number
}) {
  if (nowDayIndex < 0) {
    return null
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20"
      style={{ top: nowTop }}
    >
      <div className="relative h-px w-full bg-[color:var(--priority-urgent)]">
        <span
          className="absolute -top-1 size-2 -translate-x-1/2 rounded-full bg-[color:var(--priority-urgent)] ring-2 ring-background"
          style={{ left: `${((nowDayIndex + 0.5) / dayKeys.length) * 100}%` }}
        />
      </div>
    </div>
  )
}

function CalendarSelectionPreviewBlock({
  dayKeys,
  selectionPreview,
}: {
  dayKeys: string[]
  selectionPreview: CalendarSelectionPreview | null
}) {
  if (!selectionPreview) {
    return null
  }

  const dayIndex = dayKeys.indexOf(selectionPreview.date)

  if (dayIndex === -1) {
    return null
  }

  const dayWidthPercent = 100 / dayKeys.length
  const top = (selectionPreview.startMinutes / 60) * HOUR_HEIGHT
  const height = Math.max(
    24,
    ((selectionPreview.endMinutes - selectionPreview.startMinutes) / 60) *
      HOUR_HEIGHT
  )

  return (
    <div
      data-testid="calendar-selection-preview"
      className="pointer-events-none absolute z-30 rounded-md border border-primary/45 bg-primary/10 shadow-sm ring-2 ring-primary/10"
      style={{
        left: `calc(${dayWidthPercent * dayIndex}% + 4px)`,
        width: `calc(${dayWidthPercent}% - 8px)`,
        top,
        height,
      }}
    />
  )
}

function CalendarDragPreviewBlock({
  colorMode,
  dayKeys,
  dragPreview,
  labelsById,
  visibleTimedEntries,
}: {
  colorMode: CalendarColorMode
  dayKeys: string[]
  dragPreview: CalendarDragPreview | null
  labelsById: EventAccentLabelLookup
  visibleTimedEntries: TimedCalendarEntry[]
}) {
  if (!dragPreview || dragPreview.isAllDay) {
    return null
  }

  const dayIndex = dayKeys.indexOf(dragPreview.date)

  if (dayIndex === -1) {
    return null
  }

  const accent = getCalendarItemAccent(
    dragPreview.item,
    colorMode,
    Math.max(
      0,
      visibleTimedEntries.findIndex(
        (entry) => entry.item.id === dragPreview.item.id
      )
    ),
    labelsById
  )
  const dayWidthPercent = 100 / dayKeys.length
  const top = (dragPreview.startMinutes / 60) * HOUR_HEIGHT
  const height = Math.max(
    24,
    ((dragPreview.endMinutes - dragPreview.startMinutes) / 60) * HOUR_HEIGHT
  )
  const isShortPreview = height < 38

  return (
    <div
      data-testid="calendar-drag-preview"
      className="pointer-events-none absolute z-40 overflow-hidden rounded-md bg-[color:var(--cal-accent-tint-hover)] text-left text-[12px] text-foreground shadow-lg"
      style={{
        ...getCalendarItemStyle(accent),
        left: `calc(${dayWidthPercent * dayIndex}% + 4px)`,
        width: `calc(${dayWidthPercent}% - 8px)`,
        top,
        height,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-[color:var(--cal-accent)]"
      />
      <div
        className={cn(
          "flex h-full flex-col gap-0.5 py-1 pr-2 pl-[14px]",
          isShortPreview && "py-0.5"
        )}
      >
        <div
          className={cn(
            "truncate leading-tight font-semibold",
            isShortPreview && "text-[11px]"
          )}
        >
          {dragPreview.item.title}
        </div>
        {!isShortPreview ? (
          <div className="truncate text-[11px] leading-tight text-fg-2">
            {formatTimeFromMinutes(dragPreview.startMinutes)} –{" "}
            {formatTimeFromMinutes(dragPreview.endMinutes)}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CalendarTimedGrid({
  beginCalendarSelection,
  beginTimedDrag,
  cancelCalendarSelection,
  cancelDrag,
  colorMode,
  commitCalendarSelection,
  commitDrag,
  convertAllDayItemToTimed,
  dayColumnsContentWidth,
  dayColumnsGridTemplateColumns,
  dayKeys,
  days,
  dragPreview,
  handleTimedGridBlankClick,
  handleTimedGridBlankDoubleClick,
  isItemEditable,
  labelsById,
  nowDayIndex,
  nowTop,
  onSelectItem,
  scheduleHover,
  scheduleHoverDetailClear,
  scheduleTimedMoveDrag,
  selectedItemId,
  selectionPreview,
  suppressNextClickRef,
  timeRows,
  timedEntryLayouts,
  timedGridRef,
  updateCalendarSelection,
  updateDragMovement,
  visibleTimedEntries,
}: {
  beginCalendarSelection: (event: ReactPointerEvent<HTMLDivElement>) => void
  beginTimedDrag: CalendarTimedEntryBlockProps["beginTimedDrag"]
  cancelCalendarSelection: (event: PointerEvent) => boolean
  cancelDrag: (event: PointerEvent) => void
  colorMode: CalendarColorMode
  commitCalendarSelection: (event: PointerEvent) => boolean
  commitDrag: (event: PointerEvent) => void
  convertAllDayItemToTimed: (
    itemId: string,
    clientX: number,
    clientY: number
  ) => void
  dayColumnsContentWidth: string
  dayColumnsGridTemplateColumns: string
  dayKeys: string[]
  days: Date[]
  dragPreview: CalendarDragPreview | null
  handleTimedGridBlankClick: (event: MouseEvent<HTMLDivElement>) => void
  handleTimedGridBlankDoubleClick: (event: MouseEvent<HTMLDivElement>) => void
  isItemEditable: (item: WorkItem) => boolean
  labelsById: EventAccentLabelLookup
  nowDayIndex: number
  nowTop: number
  onSelectItem: (itemId: string) => void
  scheduleHover: (itemId: string, event: MouseEvent<HTMLElement>) => void
  scheduleHoverDetailClear: () => void
  scheduleTimedMoveDrag: CalendarTimedEntryBlockProps["scheduleTimedMoveDrag"]
  selectedItemId: string | null
  selectionPreview: CalendarSelectionPreview | null
  suppressNextClickRef: RefObject<boolean>
  timeRows: CalendarTimeRow[]
  timedEntryLayouts: Map<string, TimedEntryLayout[]>
  timedGridRef: RefObject<HTMLDivElement | null>
  updateCalendarSelection: (event: PointerEvent) => void
  updateDragMovement: (event: PointerEvent) => void
  visibleTimedEntries: TimedCalendarEntry[]
}) {
  return (
    <div
      ref={timedGridRef}
      data-testid="calendar-timed-grid"
      className="relative grid"
      style={{
        gridTemplateColumns: dayColumnsGridTemplateColumns,
        height: HOUR_HEIGHT * 24,
        width: dayColumnsContentWidth,
      }}
      onPointerDown={beginCalendarSelection}
      onPointerMove={(event) => {
        updateCalendarSelection(event.nativeEvent)
        updateDragMovement(event.nativeEvent)
      }}
      onPointerCancel={(event) => {
        cancelCalendarSelection(event.nativeEvent)
        cancelDrag(event.nativeEvent)
      }}
      onPointerUp={(event) => {
        if (commitCalendarSelection(event.nativeEvent)) {
          return
        }
        commitDrag(event.nativeEvent)
      }}
      onClick={handleTimedGridBlankClick}
      onDoubleClick={handleTimedGridBlankDoubleClick}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const itemId = event.dataTransfer.getData("text/calendar-item")

        if (itemId) {
          convertAllDayItemToTimed(itemId, event.clientX, event.clientY)
        }
      }}
    >
      <CalendarTimedGridBackground days={days} timeRows={timeRows} />
      <CalendarNowMarker
        dayKeys={dayKeys}
        nowDayIndex={nowDayIndex}
        nowTop={nowTop}
      />
      <CalendarSelectionPreviewBlock
        dayKeys={dayKeys}
        selectionPreview={selectionPreview}
      />
      {visibleTimedEntries.map((entry, index) => (
        <CalendarTimedEntryBlock
          key={`${entry.item.id}-${entry.date}-${entry.startMinutes}-${entry.endMinutes}`}
          beginTimedDrag={beginTimedDrag}
          colorMode={colorMode}
          dayKeys={dayKeys}
          dragPreview={dragPreview}
          entry={entry}
          index={index}
          isItemEditable={isItemEditable}
          labelsById={labelsById}
          onSelectItem={onSelectItem}
          scheduleHover={scheduleHover}
          scheduleHoverDetailClear={scheduleHoverDetailClear}
          scheduleTimedMoveDrag={scheduleTimedMoveDrag}
          selectedItemId={selectedItemId}
          suppressNextClickRef={suppressNextClickRef}
          timedEntryLayouts={timedEntryLayouts}
        />
      ))}
      <CalendarDragPreviewBlock
        colorMode={colorMode}
        dayKeys={dayKeys}
        dragPreview={dragPreview}
        labelsById={labelsById}
        visibleTimedEntries={visibleTimedEntries}
      />
    </div>
  )
}

function CalendarDayWeekView({
  allDayLaneHeight,
  allDayRangeExpanded,
  allDayRangeKey,
  beginCalendarSelection,
  beginTimedDrag,
  cancelCalendarSelection,
  cancelDrag,
  collapseAllDayRange,
  colorMode,
  commitCalendarSelection,
  commitDrag,
  convertAllDayItemToTimed,
  dayAllDayScrollRef,
  dayBodyScrollRef,
  dayColumnsContentWidth,
  dayColumnsGridTemplateColumns,
  dayHeaderScrollRef,
  dayKeys,
  days,
  dragPreview,
  expandAllDayRange,
  getCalendarItemInteractionProps,
  handleAllDayBlankClick,
  handleAllDayBlankDoubleClick,
  handleAllDayDrop,
  handleDayBodyScroll,
  handleTimedGridBlankClick,
  handleTimedGridBlankDoubleClick,
  hiddenAllDayCounts,
  isItemEditable,
  labelsById,
  nowDayIndex,
  nowTop,
  nowWallTime,
  onAllDayDragStart,
  onSelectItem,
  scheduleHover,
  scheduleHoverDetailClear,
  scheduleTimedMoveDrag,
  selectedItemId,
  selectionPreview,
  suppressNextClickRef,
  timeRailContentRef,
  timeRows,
  timedEntryLayouts,
  timedGridRef,
  updateCalendarSelection,
  updateDragMovement,
  visibleAllDayRowCount,
  visibleAllDaySpans,
  visibleTimedEntries,
}: CalendarAllDaySurfaceProps & {
  allDayLaneHeight: number
  allDayRangeExpanded: boolean
  allDayRangeKey: string
  beginCalendarSelection: (event: ReactPointerEvent<HTMLDivElement>) => void
  beginTimedDrag: CalendarTimedEntryBlockProps["beginTimedDrag"]
  cancelCalendarSelection: (event: PointerEvent) => boolean
  cancelDrag: (event: PointerEvent) => void
  collapseAllDayRange: (rangeKey: string) => void
  colorMode: CalendarColorMode
  commitCalendarSelection: (event: PointerEvent) => boolean
  commitDrag: (event: PointerEvent) => void
  convertAllDayItemToTimed: (
    itemId: string,
    clientX: number,
    clientY: number
  ) => void
  dayAllDayScrollRef: RefObject<HTMLDivElement | null>
  dayBodyScrollRef: RefObject<HTMLDivElement | null>
  dayColumnsContentWidth: string
  dayColumnsGridTemplateColumns: string
  dayHeaderScrollRef: RefObject<HTMLDivElement | null>
  handleDayBodyScroll: (event: ReactUIEvent<HTMLDivElement>) => void
  handleTimedGridBlankClick: (event: MouseEvent<HTMLDivElement>) => void
  handleTimedGridBlankDoubleClick: (event: MouseEvent<HTMLDivElement>) => void
  hiddenAllDayCounts: number[]
  isItemEditable: (item: WorkItem) => boolean
  labelsById: EventAccentLabelLookup
  nowDayIndex: number
  nowTop: number
  nowWallTime: CalendarWallTime
  onAllDayDragStart: () => void
  onSelectItem: (itemId: string) => void
  scheduleHover: (itemId: string, event: MouseEvent<HTMLElement>) => void
  scheduleHoverDetailClear: () => void
  scheduleTimedMoveDrag: CalendarTimedEntryBlockProps["scheduleTimedMoveDrag"]
  selectedItemId: string | null
  selectionPreview: CalendarSelectionPreview | null
  suppressNextClickRef: RefObject<boolean>
  timeRailContentRef: RefObject<HTMLDivElement | null>
  timeRows: CalendarTimeRow[]
  timedEntryLayouts: Map<string, TimedEntryLayout[]>
  timedGridRef: RefObject<HTMLDivElement | null>
  updateCalendarSelection: (event: PointerEvent) => void
  updateDragMovement: (event: PointerEvent) => void
  visibleAllDayRowCount: number
  visibleAllDaySpans: AllDayCalendarSpan[]
  visibleTimedEntries: TimedCalendarEntry[]
}) {
  const timedGridPointerProps = {
    beginCalendarSelection,
    cancelCalendarSelection,
    cancelDrag,
    commitCalendarSelection,
    commitDrag,
    updateCalendarSelection,
    updateDragMovement,
  }
  const timedGridDragProps = {
    beginTimedDrag,
    convertAllDayItemToTimed,
    dragPreview,
    scheduleTimedMoveDrag,
    suppressNextClickRef,
    timedGridRef,
  }
  const timedGridRenderProps = {
    colorMode,
    dayColumnsContentWidth,
    dayColumnsGridTemplateColumns,
    dayKeys,
    days,
    labelsById,
  }
  const timedGridInteractionProps = {
    handleTimedGridBlankClick,
    handleTimedGridBlankDoubleClick,
    isItemEditable,
    onSelectItem,
    scheduleHover,
    scheduleHoverDetailClear,
  }
  const timedGridEntryProps = {
    nowDayIndex,
    nowTop,
    selectedItemId,
    selectionPreview,
    timeRows,
    timedEntryLayouts,
    visibleTimedEntries,
  }

  return (
    <div
      className="grid min-h-0 flex-1 overflow-hidden"
      style={{
        gridTemplateColumns: `${CALENDAR_TIME_AXIS_WIDTH}px minmax(0, 1fr)`,
        gridTemplateRows: `auto auto minmax(0, 1fr)`,
      }}
    >
      <div className="border-r border-b border-line-soft bg-background" />
      <CalendarDayHeader
        dayColumnsContentWidth={dayColumnsContentWidth}
        dayColumnsGridTemplateColumns={dayColumnsGridTemplateColumns}
        dayHeaderScrollRef={dayHeaderScrollRef}
        days={days}
      />
      <div
        data-testid="calendar-all-day-lane"
        className="flex items-start justify-end border-r border-b border-line-soft bg-background px-2 pt-2 text-[10px] font-medium tracking-wider text-fg-4 uppercase"
        style={{ minHeight: allDayLaneHeight }}
      >
        All day
      </div>
      <CalendarAllDayScrollArea
        allDayLaneHeight={allDayLaneHeight}
        allDayRangeExpanded={allDayRangeExpanded}
        allDayRangeKey={allDayRangeKey}
        collapseAllDayRange={collapseAllDayRange}
        colorMode={colorMode}
        dayAllDayScrollRef={dayAllDayScrollRef}
        dayColumnsContentWidth={dayColumnsContentWidth}
        dayColumnsGridTemplateColumns={dayColumnsGridTemplateColumns}
        dayKeys={dayKeys}
        days={days}
        dragPreview={dragPreview}
        expandAllDayRange={expandAllDayRange}
        getCalendarItemInteractionProps={getCalendarItemInteractionProps}
        handleAllDayBlankClick={handleAllDayBlankClick}
        handleAllDayBlankDoubleClick={handleAllDayBlankDoubleClick}
        handleAllDayDrop={handleAllDayDrop}
        hiddenAllDayCounts={hiddenAllDayCounts}
        isItemEditable={isItemEditable}
        labelsById={labelsById}
        onAllDayDragStart={onAllDayDragStart}
        selectedItemId={selectedItemId}
        visibleAllDayRowCount={visibleAllDayRowCount}
        visibleAllDaySpans={visibleAllDaySpans}
      />
      <CalendarTimeRail
        nowDayIndex={nowDayIndex}
        nowTop={nowTop}
        nowWallTime={nowWallTime}
        timeRailContentRef={timeRailContentRef}
        timeRows={timeRows}
      />
      <div
        ref={dayBodyScrollRef}
        data-testid="calendar-day-scroll-container"
        className="min-h-0 overflow-auto overscroll-none"
        onScroll={handleDayBodyScroll}
      >
        <CalendarTimedGrid
          {...timedGridPointerProps}
          {...timedGridDragProps}
          {...timedGridRenderProps}
          {...timedGridInteractionProps}
          {...timedGridEntryProps}
        />
      </div>
    </div>
  )
}

function getHoverAnchorFromElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
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
  const spaceRight = viewportWidth - rect.right
  const spaceLeft = rect.left
  const shouldOpenRight =
    spaceRight >= width + HOVER_DETAIL_MARGIN || spaceRight >= spaceLeft
  const sideLeft = shouldOpenRight
    ? rect.right + HOVER_DETAIL_MARGIN
    : rect.left - width - HOVER_DETAIL_MARGIN

  return {
    left: clampNumber(
      sideLeft,
      HOVER_DETAIL_MARGIN,
      Math.max(HOVER_DETAIL_MARGIN, viewportWidth - width - HOVER_DETAIL_MARGIN)
    ),
    top: clampNumber(
      rect.top + rect.height / 2 - maxHeight / 2,
      HOVER_DETAIL_MARGIN,
      Math.max(
        HOVER_DETAIL_MARGIN,
        viewportHeight - maxHeight - HOVER_DETAIL_MARGIN
      )
    ),
    width,
    maxHeight,
  }
}

function useCalendarHoverDetail({
  isInteractionActive,
  onSelectItem,
}: {
  isInteractionActive: () => boolean
  onSelectItem: (itemId: string) => void
}) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)
  const [hoverAnchor, setHoverAnchor] = useState<HoverDetailAnchor | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  function scheduleHover(itemId: string, event: MouseEvent<HTMLElement>) {
    if (isInteractionActive()) {
      clearHoverDetail()
      return
    }

    const nextAnchor = getHoverAnchorFromElement(event.currentTarget)
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
      onClick: () => onSelectItem(itemId),
      onMouseEnter: (event: MouseEvent<HTMLButtonElement>) =>
        scheduleHover(itemId, event),
      onMouseLeave: scheduleHoverDetailClear,
    }
  }

  return {
    clearHoverDetail,
    clearHoverTimer,
    getCalendarItemInteractionProps,
    hoverAnchor,
    hoveredItemId,
    scheduleHover,
    scheduleHoverDetailClear,
  }
}

function getCalendarVisibleDays({
  anchorDate,
  mode,
  monthWeeks,
  showWeekends,
  weekDayCount,
  weekStart,
}: {
  anchorDate: Date
  mode: CalendarMode
  monthWeeks: Date[][]
  showWeekends: boolean
  weekDayCount: CalendarWeekDayCount
  weekStart: CalendarWeekStart
}) {
  return mode === "month"
    ? monthWeeks.flat()
    : getScrollableDays(anchorDate, mode, weekDayCount, showWeekends, weekStart)
}

function getCalendarScrollAnchorDayKey({
  anchorDate,
  mode,
  showWeekends,
  weekDayCount,
  weekStart,
}: {
  anchorDate: Date
  mode: CalendarMode
  showWeekends: boolean
  weekDayCount: CalendarWeekDayCount
  weekStart: CalendarWeekStart
}) {
  if (mode === "month") {
    return null
  }

  return getDateKey(
    getScrollAnchorDay(anchorDate, mode, weekDayCount, showWeekends, weekStart)
  )
}

function useAllDayRangeExpansion() {
  const [expandedAllDayRangeKeys, setExpandedAllDayRangeKeys] = useState<
    Set<string>
  >(() => new Set())

  function resetAllDayExpansion() {
    setExpandedAllDayRangeKeys((current) =>
      current.size === 0 ? current : new Set()
    )
  }

  function isAllDayRangeExpanded(rangeKey: string) {
    return expandedAllDayRangeKeys.has(rangeKey)
  }

  function expandAllDayRange(rangeKey: string) {
    setExpandedAllDayRangeKeys((current) => {
      if (current.has(rangeKey)) {
        return current
      }

      const next = new Set(current)
      next.add(rangeKey)
      return next
    })
  }

  function collapseAllDayRange(rangeKey: string) {
    setExpandedAllDayRangeKeys((current) => {
      if (!current.has(rangeKey)) {
        return current
      }

      const next = new Set(current)
      next.delete(rangeKey)
      return next
    })
  }

  return {
    collapseAllDayRange,
    expandAllDayRange,
    isAllDayRangeExpanded,
    resetAllDayExpansion,
  }
}

function useCalendarControlledValue<T>(
  controlledValue: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void
) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const setValue = onChange ?? ((nextValue: T) => setInternalValue(nextValue))

  return [controlledValue ?? internalValue, setValue] as const
}

function useCalendarViewControls({
  controlledColorMode,
  controlledMaxAllDayEvents,
  controlledMode,
  controlledShowWeekends,
  controlledTimeInterval,
  controlledTimeZone,
  controlledWeekDayCount,
  controlledWeekStart,
  defaultViewerTimeZone,
  onColorModeChange,
  onMaxAllDayEventsChange,
  onModeChange,
  onShowWeekendsChange,
  onTimeIntervalChange,
  onTimeZoneChange,
  onWeekDayCountChange,
  onWeekStartChange,
}: CalendarViewControlOptions) {
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()))
  const {
    collapseAllDayRange,
    expandAllDayRange,
    isAllDayRangeExpanded,
    resetAllDayExpansion,
  } = useAllDayRangeExpansion()
  const [mode, handleModeChange] = useCalendarControlledValue<CalendarMode>(
    controlledMode,
    "week",
    onModeChange
  )
  const [rawWeekDayCount, setWeekDayCount] =
    useCalendarControlledValue<CalendarWeekDayCount>(
      controlledWeekDayCount,
      7,
      onWeekDayCountChange
    )
  const [showWeekends, setShowWeekends] = useCalendarControlledValue(
    controlledShowWeekends,
    true,
    onShowWeekendsChange
  )
  const [weekStart, setWeekStart] =
    useCalendarControlledValue<CalendarWeekStart>(
      controlledWeekStart,
      "monday",
      onWeekStartChange
    )
  const [colorMode, handleColorModeChange] =
    useCalendarControlledValue<CalendarColorMode>(
      controlledColorMode,
      "status",
      onColorModeChange
    )
  const [timeInterval, handleTimeIntervalChange] =
    useCalendarControlledValue<CalendarTimeInterval>(
      controlledTimeInterval,
      "hour",
      onTimeIntervalChange
    )
  const [rawMaxAllDayEvents, setMaxAllDayEvents] =
    useCalendarControlledValue<number>(
      controlledMaxAllDayEvents,
      3,
      onMaxAllDayEventsChange
    )
  const [rawTimeZone, handleTimeZoneChange] = useCalendarControlledValue(
    controlledTimeZone,
    defaultViewerTimeZone,
    onTimeZoneChange
  )
  const weekDayCount = normalizeWeekDayCount(rawWeekDayCount)
  const monthWeeks = useMemo(
    () => getScrollableMonthWeeks(anchorDate, showWeekends, weekStart),
    [anchorDate, showWeekends, weekStart]
  )
  const visibleMonthWeekCount = useMemo(
    () => getMonthVisibleWeeks(anchorDate, showWeekends, weekStart).length,
    [anchorDate, showWeekends, weekStart]
  )
  const days = useMemo(
    () =>
      getCalendarVisibleDays({
        anchorDate,
        mode,
        monthWeeks,
        showWeekends,
        weekDayCount,
        weekStart,
      }),
    [anchorDate, mode, monthWeeks, showWeekends, weekDayCount, weekStart]
  )
  const dayKeys = useMemo(() => days.map(getDateKey), [days])
  const scrollAnchorDayKey = useMemo(
    () =>
      getCalendarScrollAnchorDayKey({
        anchorDate,
        mode,
        showWeekends,
        weekDayCount,
        weekStart,
      }),
    [anchorDate, mode, showWeekends, weekDayCount, weekStart]
  )
  const maxAllDayEvents = normalizeMaxAllDayEvents(rawMaxAllDayEvents)
  const viewerTimeZone = normalizeTimeZone(rawTimeZone, defaultViewerTimeZone)

  function setCalendarAnchorDate(next: Date | ((current: Date) => Date)) {
    resetAllDayExpansion()
    setAnchorDate((current) => {
      const nextAnchor = typeof next === "function" ? next(current) : next

      return getCalendarWeekendVisibilityAnchorDate({
        anchorDate: nextAnchor,
        mode,
        nextShowWeekends: showWeekends,
      })
    })
  }

  function handleCalendarModeChange(nextMode: CalendarMode) {
    resetAllDayExpansion()
    setAnchorDate((current) =>
      getCalendarWeekendVisibilityAnchorDate({
        anchorDate: current,
        mode: nextMode,
        nextShowWeekends: showWeekends,
      })
    )
    handleModeChange(nextMode)
  }

  function handleMaxAllDayEventsChange(nextMaxAllDayEvents: number) {
    resetAllDayExpansion()
    setMaxAllDayEvents(nextMaxAllDayEvents)
  }

  function handleWeekDayCountChange(nextWeekDayCount: CalendarWeekDayCount) {
    resetAllDayExpansion()
    setWeekDayCount(nextWeekDayCount)
  }

  function handleShowWeekendsChange(nextShowWeekends: boolean) {
    resetAllDayExpansion()
    setAnchorDate((current) =>
      getCalendarWeekendVisibilityAnchorDate({
        anchorDate: current,
        mode,
        nextShowWeekends,
      })
    )
    setShowWeekends(nextShowWeekends)
  }

  function handleWeekStartChange(nextWeekStart: CalendarWeekStart) {
    resetAllDayExpansion()
    setWeekStart(nextWeekStart)
  }

  return {
    anchorDate,
    collapseAllDayRange,
    colorMode,
    dayKeys,
    days,
    expandAllDayRange,
    handleCalendarModeChange,
    handleColorModeChange,
    handleMaxAllDayEventsChange,
    handleShowWeekendsChange,
    handleTimeIntervalChange,
    handleTimeZoneChange,
    handleWeekDayCountChange,
    handleWeekStartChange,
    isAllDayRangeExpanded,
    maxAllDayEvents,
    mode,
    monthWeeks,
    scrollAnchorDayKey,
    setCalendarAnchorDate,
    showWeekends,
    timeInterval,
    viewerTimeZone,
    visibleMonthWeekCount,
    weekDayCount,
    weekStart,
  }
}

export function CalendarView({
  data,
  items,
  editable,
  canEditItem,
  mode: controlledMode,
  onModeChange,
  colorMode: controlledColorMode,
  onColorModeChange,
  timeInterval: controlledTimeInterval,
  onTimeIntervalChange,
  maxAllDayEvents: controlledMaxAllDayEvents,
  onMaxAllDayEventsChange,
  weekDayCount: controlledWeekDayCount,
  onWeekDayCountChange,
  showWeekends: controlledShowWeekends,
  onShowWeekendsChange,
  weekStart: controlledWeekStart,
  onWeekStartChange,
  timeZone: controlledTimeZone,
  onTimeZoneChange,
  createContext,
  allowCreate,
  toolbarAccessory,
  showSettingsButton = true,
}: CalendarViewProps) {
  const currentUser = getUser(data, data.currentUserId)
  const defaultViewerTimeZone = normalizeTimeZone(
    currentUser?.preferences.timeZone,
    getBrowserTimeZone()
  )
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<CalendarDragPreview | null>(
    null
  )
  const [selectionPreview, setSelectionPreview] =
    useState<CalendarSelectionPreview | null>(null)
  const [monthGridHeight, setMonthGridHeight] = useState(0)
  const calendarControls = useCalendarViewControls({
    controlledColorMode,
    controlledMaxAllDayEvents,
    controlledMode,
    controlledShowWeekends,
    controlledTimeInterval,
    controlledTimeZone,
    controlledWeekDayCount,
    controlledWeekStart,
    defaultViewerTimeZone,
    onColorModeChange,
    onMaxAllDayEventsChange,
    onModeChange,
    onShowWeekendsChange,
    onTimeIntervalChange,
    onTimeZoneChange,
    onWeekDayCountChange,
    onWeekStartChange,
  })
  const { anchorDate, dayKeys, days, mode, monthWeeks, scrollAnchorDayKey } =
    calendarControls
  const {
    colorMode,
    maxAllDayEvents,
    showWeekends,
    timeInterval,
    viewerTimeZone,
    visibleMonthWeekCount,
    weekDayCount,
    weekStart,
  } = calendarControls
  const { collapseAllDayRange, expandAllDayRange, isAllDayRangeExpanded } =
    calendarControls
  const {
    handleCalendarModeChange,
    handleColorModeChange,
    handleMaxAllDayEventsChange,
    handleShowWeekendsChange,
    handleTimeIntervalChange,
    handleTimeZoneChange,
    handleWeekDayCountChange,
    handleWeekStartChange,
    setCalendarAnchorDate,
  } = calendarControls
  const monthGridRef = useRef<HTMLDivElement | null>(null)
  const dayBodyScrollRef = useRef<HTMLDivElement | null>(null)
  const dayHeaderScrollRef = useRef<HTMLDivElement | null>(null)
  const dayAllDayScrollRef = useRef<HTMLDivElement | null>(null)
  const timeRailContentRef = useRef<HTMLDivElement | null>(null)
  const timedGridRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<CalendarDragState | null>(null)
  const selectionDraftRef = useRef<CalendarSelectionDraft | null>(null)
  const pendingMoveDragRef = useRef<PendingCalendarMoveDrag | null>(null)
  const suppressNextClickRef = useRef(false)
  const {
    clearHoverDetail,
    clearHoverTimer,
    getCalendarItemInteractionProps,
    hoverAnchor,
    hoveredItemId,
    scheduleHover,
    scheduleHoverDetailClear,
  } = useCalendarHoverDetail({
    isInteractionActive: () =>
      Boolean(
        dragStateRef.current || pendingMoveDragRef.current || dragPreview
      ),
    onSelectItem: setSelectedItemId,
  })
  const dayKeySet = useMemo(() => new Set(dayKeys), [dayKeys])
  const labelsById = useMemo(
    () => createEventAccentLabelLookup(data.labels),
    [data.labels]
  )
  const { allDayEntries, timedEntries } = useMemo(
    () => resolveCalendarEntries(items, viewerTimeZone),
    [items, viewerTimeZone]
  )
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null
  const hoveredItem = items.find((item) => item.id === hoveredItemId) ?? null
  const timeIntervalHours = getCalendarTimeIntervalHours(timeInterval)
  const timeRows = useMemo(
    () =>
      Array.from({ length: Math.ceil(24 / timeIntervalHours) }, (_, index) => ({
        hour: index * timeIntervalHours,
        height: HOUR_HEIGHT * timeIntervalHours,
      })),
    [timeIntervalHours]
  )
  const canCreateCalendarItems = allowCreate ?? Boolean(editable)

  useEffect(() => {
    const element = monthGridRef.current

    if (!element || typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      const nextHeight = entry?.contentRect.height ?? 0
      setMonthGridHeight((current) =>
        Math.abs(current - nextHeight) < 1 ? current : nextHeight
      )
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [mode])

  function isItemEditable(item: WorkItem) {
    return Boolean(editable) && (canEditItem?.(item) ?? true)
  }

  function openCreateWorkItemForSchedule(schedule: CalendarCreateSchedule) {
    if (!canCreateCalendarItems) {
      return
    }

    const createsPrivateWorkItem =
      createContext?.defaultVisibility === "private"
    const hasTimedRange =
      schedule.startMinutes !== undefined &&
      schedule.startMinutes !== null &&
      schedule.endMinutes !== undefined &&
      schedule.endMinutes !== null

    openManagedCreateDialog({
      kind: "workItem",
      defaultTeamId: createContext?.defaultTeamId ?? null,
      defaultProjectId: createsPrivateWorkItem
        ? null
        : (createContext?.defaultProjectId ?? null),
      ...(createsPrivateWorkItem ? { initialType: "task" as const } : {}),
      defaultValues: {
        startDate: schedule.date,
        targetDate: schedule.date,
        ...(hasTimedRange
          ? {
              startTime: formatTimeFromMinutes(schedule.startMinutes ?? 0),
              endTime: formatTimeFromMinutes(schedule.endMinutes ?? 0),
              scheduleTimeZone: viewerTimeZone,
            }
          : {
              startTime: null,
              endTime: null,
              scheduleTimeZone: null,
            }),
        ...(createsPrivateWorkItem
          ? {
              assigneeId: null,
              primaryProjectId: null,
              visibility: "private" as const,
            }
          : createContext?.defaultVisibility
            ? { visibility: createContext.defaultVisibility }
            : {}),
      },
    })
  }

  function closeCalendarDetailFromBlankTarget(target: EventTarget | null) {
    if (isCalendarBlankTarget(target)) {
      setSelectedItemId(null)
    }
  }

  function clearPendingMoveDrag() {
    if (pendingMoveDragRef.current) {
      clearTimeout(pendingMoveDragRef.current.timer)
      pendingMoveDragRef.current = null
    }
  }

  function moveAnchor(direction: -1 | 1) {
    setCalendarAnchorDate((current) =>
      getCalendarNavigationAnchorDate({
        anchorDate: current,
        direction,
        mode,
        showWeekends,
        weekDayCount,
        weekStart,
      })
    )
  }

  function openDayFromMonth(dayKey: string) {
    setCalendarAnchorDate(startOfDay(getDateFromKey(dayKey)))
    handleCalendarModeChange("day")
  }

  function getTimedGridMetrics(): CalendarDragGridMetrics | null {
    const rect = timedGridRef.current?.getBoundingClientRect()

    if (!rect) {
      return null
    }

    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      dayKeys,
    }
  }

  function getPointerSlotFromMetrics(
    clientX: number,
    clientY: number,
    metrics: CalendarDragGridMetrics
  ) {
    const dayWidth = metrics.width / metrics.dayKeys.length
    const dayIndex = Math.max(
      0,
      Math.min(
        metrics.dayKeys.length - 1,
        Math.floor((clientX - metrics.left) / dayWidth)
      )
    )
    const minutes = snapMinutes(((clientY - metrics.top) / HOUR_HEIGHT) * 60)

    return {
      dayIndex,
      date: metrics.dayKeys[dayIndex],
      minutes: Math.max(
        0,
        Math.min(24 * 60 - MIN_TIMED_DURATION_MINUTES, minutes)
      ),
    }
  }

  function getPointerSlot(clientX: number, clientY: number) {
    const metrics = getTimedGridMetrics()

    return metrics ? getPointerSlotFromMetrics(clientX, clientY, metrics) : null
  }

  function beginCalendarSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !canCreateCalendarItems ||
      !isCalendarBlankTarget(event.target) ||
      event.button !== 0
    ) {
      return
    }

    const slot = getPointerSlot(event.clientX, event.clientY)

    if (!slot) {
      return
    }

    clearHoverDetail()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    selectionDraftRef.current = {
      pointerId: event.pointerId,
      originSlot: slot,
      currentSlot: slot,
      moved: false,
    }
  }

  function updateCalendarSelection(event: PointerEvent) {
    const selection = selectionDraftRef.current

    if (!selection || selection.pointerId !== event.pointerId) {
      return
    }

    const slot = getPointerSlot(event.clientX, event.clientY)

    if (!slot) {
      return
    }

    const movedFarEnough =
      Math.abs(slot.dayIndex - selection.originSlot.dayIndex) > 0 ||
      Math.abs(slot.minutes - selection.originSlot.minutes) >=
        MIN_TIMED_DURATION_MINUTES

    selection.currentSlot = slot
    selection.moved = selection.moved || movedFarEnough

    if (selection.moved) {
      setSelectionPreview(
        getSelectionPreviewFromSlots(selection.originSlot, slot)
      )
    }
  }

  function cancelCalendarSelection(event: PointerEvent) {
    const selection = selectionDraftRef.current

    if (!selection || selection.pointerId !== event.pointerId) {
      return false
    }

    selectionDraftRef.current = null
    setSelectionPreview(null)
    return true
  }

  function commitCalendarSelection(event: PointerEvent) {
    const selection = selectionDraftRef.current

    if (!selection || selection.pointerId !== event.pointerId) {
      return false
    }

    selectionDraftRef.current = null
    setSelectionPreview(null)

    if (selection.moved) {
      suppressNextClickForDrag()
      const nextPreview = getSelectionPreviewFromSlots(
        selection.originSlot,
        selection.currentSlot
      )
      openCreateWorkItemForSchedule(nextPreview)
    }

    return true
  }

  function getDragPreviewForSlot(
    drag: CalendarDragState,
    slot: ReturnType<typeof getPointerSlotFromMetrics>,
    clientY?: number
  ): CalendarDragPreview {
    const dayDelta = slot.dayIndex - drag.originDayIndex
    const baseDate = addDays(
      getDateFromKey(drag.grid.dayKeys[drag.originDayIndex]),
      dayDelta
    )
    const nextDate = getDateKey(baseDate)
    let startMinutes = drag.originStartMinutes
    let endMinutes = drag.originEndMinutes

    if (
      drag.action === "move" &&
      clientY !== undefined &&
      clientY < drag.grid.top
    ) {
      startMinutes = 0
      endMinutes = 0
    } else if (drag.action === "move") {
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

    return {
      action: drag.action,
      item: drag.item,
      date: nextDate,
      startMinutes,
      endMinutes,
      isAllDay:
        drag.action === "move" &&
        clientY !== undefined &&
        clientY < drag.grid.top,
    }
  }

  function setNextDragPreview(nextPreview: CalendarDragPreview | null) {
    setDragPreview((current) => {
      if (
        current &&
        nextPreview &&
        current.action === nextPreview.action &&
        current.item.id === nextPreview.item.id &&
        current.date === nextPreview.date &&
        current.startMinutes === nextPreview.startMinutes &&
        current.endMinutes === nextPreview.endMinutes
      ) {
        return current
      }

      return nextPreview
    })
  }

  function commitDrag(event: PointerEvent) {
    if (pendingMoveDragRef.current?.pointerId === event.pointerId) {
      clearPendingMoveDrag()
    }

    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const slot = getPointerSlotFromMetrics(
      event.clientX,
      event.clientY,
      drag.grid
    )
    const shouldSuppressClick = drag.moved
    const nextPreview = getDragPreviewForSlot(drag, slot, event.clientY)
    dragStateRef.current = null
    setNextDragPreview(null)

    if (shouldSuppressClick) {
      suppressNextClickForDrag()
    }

    if (!slot || !isItemEditable(drag.item)) {
      return
    }

    useAppStore
      .getState()
      .updateWorkItem(
        drag.item.id,
        getCalendarDragWorkItemPatch(drag.item, nextPreview, viewerTimeZone)
      )
  }

  function beginTimedDragFromPointer(
    pointer: {
      clientX: number
      clientY: number
      pointerId: number
    },
    entry: TimedCalendarEntry,
    action: DragAction,
    moved: boolean
  ) {
    if (!isItemEditable(entry.item)) {
      return false
    }

    const grid = getTimedGridMetrics()

    if (!grid) {
      return false
    }

    clearHoverDetail()

    const nextDragState: CalendarDragState = {
      action,
      item: entry.item,
      pointerId: pointer.pointerId,
      originX: pointer.clientX,
      originY: pointer.clientY,
      originStartMinutes: entry.startMinutes,
      originEndMinutes: entry.endMinutes,
      originDayIndex: Math.max(0, grid.dayKeys.indexOf(entry.date)),
      durationMinutes: entry.endMinutes - entry.startMinutes,
      grid,
      moved,
    }
    dragStateRef.current = nextDragState
    setNextDragPreview(
      getDragPreviewForSlot(
        nextDragState,
        {
          dayIndex: Math.max(0, grid.dayKeys.indexOf(entry.date)),
          date: entry.date,
          minutes: entry.startMinutes,
        },
        pointer.clientY
      )
    )

    return true
  }

  function beginTimedDrag(
    event: ReactPointerEvent<HTMLElement>,
    entry: TimedCalendarEntry,
    action: DragAction
  ) {
    clearPendingMoveDrag()
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    beginTimedDragFromPointer(event, entry, action, action !== "move")
  }

  function scheduleTimedMoveDrag(
    event: ReactPointerEvent<HTMLElement>,
    entry: TimedCalendarEntry
  ) {
    if (!isItemEditable(entry.item)) {
      return
    }

    clearPendingMoveDrag()
    clearHoverDetail()
    event.currentTarget.setPointerCapture?.(event.pointerId)

    const pointer = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
    }
    const pendingDrag: PendingCalendarMoveDrag = {
      entry,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      timer: window.setTimeout(() => {
        if (pendingMoveDragRef.current?.pointerId !== pointer.pointerId) {
          return
        }

        pendingMoveDragRef.current = null
        beginTimedDragFromPointer(pointer, entry, "move", true)
      }, DRAG_HOLD_DELAY_MS),
    }

    pendingMoveDragRef.current = pendingDrag
  }

  function maybeStartPendingMoveDrag(event: PointerEvent) {
    const pendingDrag = pendingMoveDragRef.current

    if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) {
      return
    }

    const movedFarEnough =
      Math.abs(event.clientX - pendingDrag.originX) > DRAG_START_TOLERANCE_PX ||
      Math.abs(event.clientY - pendingDrag.originY) > DRAG_START_TOLERANCE_PX

    if (!movedFarEnough) {
      return
    }

    clearPendingMoveDrag()
    beginTimedDragFromPointer(event, pendingDrag.entry, "move", true)
  }

  function updateDragMovement(event: PointerEvent) {
    maybeStartPendingMoveDrag(event)

    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    drag.moved =
      drag.moved ||
      Math.abs(event.clientX - drag.originX) > 3 ||
      Math.abs(event.clientY - drag.originY) > 3

    setNextDragPreview(
      getDragPreviewForSlot(
        drag,
        getPointerSlotFromMetrics(event.clientX, event.clientY, drag.grid),
        event.clientY
      )
    )
  }

  function cancelDrag(event: PointerEvent) {
    if (pendingMoveDragRef.current?.pointerId === event.pointerId) {
      clearPendingMoveDrag()
    }

    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    dragStateRef.current = null
    setNextDragPreview(null)
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

  function handleAllDayBlankClick(event: MouseEvent<HTMLDivElement>) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      return
    }

    closeCalendarDetailFromBlankTarget(event.target)
  }

  function handleAllDayBlankDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (!canCreateCalendarItems || !isCalendarBlankTarget(event.target)) {
      return
    }

    const targetDate = getDayKeyFromHorizontalPosition(
      event.currentTarget,
      event.clientX
    )

    if (targetDate) {
      openCreateWorkItemForSchedule({ date: targetDate })
    }
  }

  function handleTimedGridBlankClick(event: MouseEvent<HTMLDivElement>) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      return
    }

    closeCalendarDetailFromBlankTarget(event.target)
  }

  function handleTimedGridBlankDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (!canCreateCalendarItems || !isCalendarBlankTarget(event.target)) {
      return
    }

    const slot = getPointerSlot(event.clientX, event.clientY)

    if (!slot) {
      return
    }

    openCreateWorkItemForSchedule({
      date: slot.date,
      startMinutes: slot.minutes,
      endMinutes: Math.min(24 * 60 - 1, slot.minutes + 60),
    })
  }

  function handleMonthBlankClick(event: MouseEvent<HTMLDivElement>) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      return
    }

    closeCalendarDetailFromBlankTarget(event.target)
  }

  function handleMonthBlankDoubleClick(
    event: MouseEvent<HTMLDivElement>,
    date: string
  ) {
    if (!canCreateCalendarItems || !isCalendarBlankTarget(event.target)) {
      return
    }

    openCreateWorkItemForSchedule({ date })
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

  function syncDayGridScroll(scrollLeft: number, scrollTop: number) {
    if (dayHeaderScrollRef.current) {
      dayHeaderScrollRef.current.scrollLeft = scrollLeft
    }

    if (dayAllDayScrollRef.current) {
      dayAllDayScrollRef.current.scrollLeft = scrollLeft
    }

    if (timeRailContentRef.current) {
      timeRailContentRef.current.style.transform = `translateY(${-scrollTop}px)`
    }
  }

  function handleDayBodyScroll(event: ReactUIEvent<HTMLDivElement>) {
    syncDayGridScroll(
      event.currentTarget.scrollLeft,
      event.currentTarget.scrollTop
    )
  }

  const visibleAllDayEntries = allDayEntries.filter(
    (entry) =>
      entry.endDate >= dayKeys[0] &&
      entry.startDate <= dayKeys[dayKeys.length - 1]
  )
  const allDaySpans = getAllDayCalendarSpans(visibleAllDayEntries, dayKeys)
  const allDayRangeKey = getAllDayRangeKey(
    `${mode}:${maxAllDayEvents}`,
    dayKeys
  )
  const allDayRangeExpanded = isAllDayRangeExpanded(allDayRangeKey)
  const allDayRowCount = getAllDaySpanRowCount(allDaySpans)
  const canCollapseAllDayItems =
    allDayRangeExpanded && allDayRowCount > maxAllDayEvents
  const visibleAllDayRowCount = getVisibleAllDayRowCount({
    expanded: allDayRangeExpanded,
    maxAllDayEvents,
    spans: allDaySpans,
  })
  const hiddenAllDayCounts = getAllDayHiddenCounts(
    allDaySpans,
    visibleAllDayRowCount,
    dayKeys.length
  )
  const hasHiddenAllDayItems = hasHiddenAllDayEvents(hiddenAllDayCounts)
  const visibleAllDaySpans = allDaySpans.filter(
    (span) => span.rowIndex < visibleAllDayRowCount
  )
  const allDayLaneHeight = getAllDayLaneHeightForRows(
    visibleAllDayRowCount,
    hasHiddenAllDayItems || canCollapseAllDayItems
  )
  const dayColumnsGridTemplateColumns = `repeat(${dayKeys.length}, minmax(0, 1fr))`
  const dayColumnsContentWidth =
    mode === "day"
      ? `${Math.max(1, dayKeys.length) * 100}%`
      : `max(100%, ${dayKeys.length * CALENDAR_DAY_MIN_WIDTH}px)`
  const visibleTimedEntries = timedEntries.filter((entry) =>
    dayKeySet.has(entry.date)
  )
  const timedEntryLayouts = useMemo(() => {
    const map = new Map<string, TimedEntryLayout[]>()
    dayKeys.forEach((dayKey) => {
      const dayEntries = visibleTimedEntries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.date === dayKey)
      map.set(dayKey, layoutTimedEntriesForDay(dayEntries))
    })
    return map
  }, [dayKeys, visibleTimedEntries])
  const nowWallTime = getViewerWallTimeForScheduleDate(
    new Date(),
    viewerTimeZone
  )
  const nowDayIndex = dayKeys.indexOf(nowWallTime.date)
  const nowTop = (getMinutesFromTime(nowWallTime.time) / 60) * HOUR_HEIGHT
  const monthBaseRowHeight =
    monthGridHeight > 0
      ? Math.max(
          MONTH_GRID_MIN_ROW_HEIGHT,
          monthGridHeight / Math.max(1, visibleMonthWeekCount)
        )
      : MONTH_GRID_MIN_ROW_HEIGHT

  useEffect(() => {
    if (mode === "month") {
      const element = monthGridRef.current

      if (!element || monthBaseRowHeight <= 0) {
        return
      }

      element.scrollTop = getScrollableMonthScrollTop(monthBaseRowHeight)
      return
    }

    const element = dayBodyScrollRef.current

    if (!element || !scrollAnchorDayKey || dayKeys.length === 0) {
      return
    }

    const anchorIndex = dayKeys.indexOf(scrollAnchorDayKey)

    if (anchorIndex < 0) {
      return
    }

    const dayWidth = element.scrollWidth / Math.max(1, dayKeys.length)
    const nextScrollLeft = anchorIndex * dayWidth

    element.scrollLeft = nextScrollLeft
    element.scrollTop = 0

    if (dayHeaderScrollRef.current) {
      dayHeaderScrollRef.current.scrollLeft = nextScrollLeft
    }

    if (dayAllDayScrollRef.current) {
      dayAllDayScrollRef.current.scrollLeft = nextScrollLeft
    }

    if (timeRailContentRef.current) {
      timeRailContentRef.current.style.transform = "translateY(0px)"
    }
  }, [
    anchorDate,
    dayKeys,
    mode,
    monthBaseRowHeight,
    scrollAnchorDayKey,
    showWeekends,
    weekDayCount,
    weekStart,
  ])

  const dayWeekRangeProps = {
    allDayLaneHeight,
    allDayRangeExpanded: canCollapseAllDayItems,
    allDayRangeKey,
    hiddenAllDayCounts,
    visibleAllDayRowCount,
    visibleAllDaySpans,
  }
  const dayWeekPointerProps = {
    beginCalendarSelection,
    cancelCalendarSelection,
    commitCalendarSelection,
    updateCalendarSelection,
    updateDragMovement,
  }
  const dayWeekDragProps = {
    beginTimedDrag,
    cancelDrag,
    commitDrag,
    convertAllDayItemToTimed,
    dragPreview,
    scheduleTimedMoveDrag,
  }
  const dayWeekRefProps = {
    dayAllDayScrollRef,
    dayBodyScrollRef,
    dayHeaderScrollRef,
    suppressNextClickRef,
    timeRailContentRef,
    timedGridRef,
  }
  const dayWeekRenderProps = {
    colorMode,
    dayColumnsContentWidth,
    dayColumnsGridTemplateColumns,
    dayKeys,
    days,
    labelsById,
  }
  const dayWeekAllDayInteractionProps = {
    collapseAllDayRange,
    expandAllDayRange,
    getCalendarItemInteractionProps,
    handleAllDayBlankClick,
    handleAllDayBlankDoubleClick,
    handleAllDayDrop,
    handleDayBodyScroll,
    onAllDayDragStart: clearHoverDetail,
  }
  const dayWeekTimedInteractionProps = {
    handleTimedGridBlankClick,
    handleTimedGridBlankDoubleClick,
    isItemEditable,
    onSelectItem: setSelectedItemId,
    scheduleHover,
    scheduleHoverDetailClear,
  }
  const dayWeekEntryProps = {
    nowDayIndex,
    nowTop,
    nowWallTime,
    selectedItemId,
    selectionPreview,
    timeRows,
    timedEntryLayouts,
    visibleTimedEntries,
  }

  return (
    <div
      data-testid="calendar-view"
      className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background"
    >
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <CalendarToolbar
          anchorDate={anchorDate}
          colorMode={colorMode}
          maxAllDayEvents={maxAllDayEvents}
          mode={mode}
          moveAnchor={moveAnchor}
          onAnchorDateChange={setCalendarAnchorDate}
          onColorModeChange={handleColorModeChange}
          onMaxAllDayEventsChange={handleMaxAllDayEventsChange}
          onModeChange={handleCalendarModeChange}
          onShowWeekendsChange={handleShowWeekendsChange}
          onTimeIntervalChange={handleTimeIntervalChange}
          onTimeZoneChange={handleTimeZoneChange}
          onWeekDayCountChange={handleWeekDayCountChange}
          onWeekStartChange={handleWeekStartChange}
          showSettingsButton={showSettingsButton}
          showWeekends={showWeekends}
          timeInterval={timeInterval}
          timeZone={viewerTimeZone}
          toolbarAccessory={toolbarAccessory}
          weekDayCount={weekDayCount}
          weekStart={weekStart}
        />

        {mode === "month" ? (
          <CalendarMonthView
            allDayEntries={allDayEntries}
            anchorDate={anchorDate}
            collapseAllDayRange={collapseAllDayRange}
            colorMode={colorMode}
            getCalendarItemInteractionProps={getCalendarItemInteractionProps}
            handleMonthBlankClick={handleMonthBlankClick}
            handleMonthBlankDoubleClick={handleMonthBlankDoubleClick}
            isAllDayRangeExpanded={isAllDayRangeExpanded}
            labelsById={labelsById}
            maxAllDayEvents={maxAllDayEvents}
            monthBaseRowHeight={monthBaseRowHeight}
            monthGridRef={monthGridRef}
            monthWeeks={monthWeeks}
            openDayFromMonth={openDayFromMonth}
            selectedItemId={selectedItemId}
            timedEntries={timedEntries}
          />
        ) : (
          <CalendarDayWeekView
            {...dayWeekRangeProps}
            {...dayWeekPointerProps}
            {...dayWeekDragProps}
            {...dayWeekRefProps}
            {...dayWeekRenderProps}
            {...dayWeekAllDayInteractionProps}
            {...dayWeekTimedInteractionProps}
            {...dayWeekEntryProps}
          />
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
