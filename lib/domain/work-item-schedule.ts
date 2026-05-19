import { getCalendarDatePrefix } from "@/lib/calendar-date"
import {
  isValidTimeValue,
  normalizeTimeZone,
  utcToZonedWallTime,
  zonedWallTimeToUtc,
} from "@/lib/time-zone"

export type WorkItemScheduleInput = {
  startDate?: string | null
  dueDate?: string | null
  targetDate?: string | null
  startTime?: string | null
  endTime?: string | null
  scheduleTimeZone?: string | null
}

export type ResolvedWorkItemSchedule =
  | {
      kind: "timed"
      start: Date
      end: Date
      sourceTimeZone: string
    }
  | {
      kind: "all-day"
      startDate: string
      endDate: string
    }
  | {
      kind: "unscheduled"
    }

function getWorkItemEndDate(item: WorkItemScheduleInput) {
  return item.targetDate ?? item.dueDate ?? null
}

export function getWorkItemScheduleDateRange(item: WorkItemScheduleInput) {
  const startDate = getCalendarDatePrefix(
    item.startDate ?? getWorkItemEndDate(item)
  )
  const endDate = getCalendarDatePrefix(getWorkItemEndDate(item) ?? startDate)

  if (!startDate && !endDate) {
    return null
  }

  const resolvedStartDate = startDate ?? endDate
  const resolvedEndDate = endDate ?? startDate

  if (!resolvedStartDate || !resolvedEndDate) {
    return null
  }

  return resolvedEndDate < resolvedStartDate
    ? { startDate: resolvedStartDate, endDate: resolvedStartDate }
    : { startDate: resolvedStartDate, endDate: resolvedEndDate }
}

export function resolveWorkItemSchedule(
  item: WorkItemScheduleInput,
  viewerTimeZone: string
): ResolvedWorkItemSchedule {
  const range = getWorkItemScheduleDateRange(item)

  if (!range) {
    return { kind: "unscheduled" }
  }

  const scheduleTimeZone = normalizeTimeZone(
    item.scheduleTimeZone,
    viewerTimeZone
  )
  const hasTimedRange =
    range.startDate === range.endDate &&
    isValidTimeValue(item.startTime) &&
    isValidTimeValue(item.endTime)

  if (!hasTimedRange) {
    return {
      kind: "all-day",
      ...range,
    }
  }

  const start = zonedWallTimeToUtc({
    date: range.startDate,
    time: item.startTime!,
    timeZone: scheduleTimeZone,
  })
  const rawEnd = zonedWallTimeToUtc({
    date: range.endDate,
    time: item.endTime!,
    timeZone: scheduleTimeZone,
  })

  if (!start || !rawEnd) {
    return {
      kind: "all-day",
      ...range,
    }
  }

  const end =
    rawEnd.getTime() > start.getTime()
      ? rawEnd
      : new Date(start.getTime() + 30 * 60 * 1000)

  return {
    kind: "timed",
    start,
    end,
    sourceTimeZone: scheduleTimeZone,
  }
}

export function getViewerWallTimeForScheduleDate(
  date: Date,
  viewerTimeZone: string
) {
  return utcToZonedWallTime(date, normalizeTimeZone(viewerTimeZone))
}
