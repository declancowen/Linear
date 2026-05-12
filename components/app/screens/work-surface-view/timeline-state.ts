import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
  subDays,
} from "date-fns"

import type { AppData, WorkItem } from "@/lib/domain/types"

export type TimelineRangeDraft = {
  itemId: string
  startDate: Date
  endDate: Date
}

export type TimelineWeek = {
  label: string
  span: number
}

function parseDateOnlyValue(value: string | null | undefined, fallback: Date) {
  if (!value) {
    return startOfDay(fallback)
  }

  return startOfDay(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function toDateOnlyIsoString(date: Date) {
  return `${format(startOfDay(date), "yyyy-MM-dd")}T00:00:00.000Z`
}

export function getTimelineRange(item: WorkItem, fallback: Date) {
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

export function getTimelineMovePatchForDrag({
  activeId,
  data,
  dragOffset,
  editable,
  overId,
  timelineStart,
}: {
  activeId: string
  data: AppData
  dragOffset: { itemId: string; offsetDays: number } | null
  editable: boolean
  overId: string | null
  timelineStart: Date
}) {
  if (!editable || !overId) {
    return null
  }

  const activeItem = data.workItems.find((entry) => entry.id === activeId)
  const [scope, , date] = overId.split("::")

  if (!activeItem || scope !== "timeline") {
    return null
  }

  const offsetDays = getTimelineDragOffsetDays(dragOffset, activeId)
  const nextStartDate = subDays(startOfDay(new Date(date)), offsetDays)

  return {
    itemId: activeId,
    patch: buildTimelineMovePatch(activeItem, nextStartDate, timelineStart),
  }
}

function getTimelineDragOffsetDays(
  dragOffset: { itemId: string; offsetDays: number } | null,
  activeId: string
) {
  return dragOffset?.itemId === activeId ? dragOffset.offsetDays : 0
}

export function buildTimelineResizePatch(
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

export function buildTimelineWeeks(days: Date[]) {
  const weeks: TimelineWeek[] = []
  let currentWeekLabel = ""
  let currentSpan = 0

  for (const day of days) {
    const weekOfYear = format(day, "'W'ww")

    if (weekOfYear !== currentWeekLabel && currentWeekLabel) {
      weeks.push(buildTimelineWeek(days, day, currentSpan))
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

  return weeks
}

function buildTimelineWeek(days: Date[], nextDay: Date, span: number) {
  return {
    label:
      format(subDays(nextDay, span), "MMM d") +
      " – " +
      format(subDays(nextDay, 1), "MMM d"),
    span,
  }
}
