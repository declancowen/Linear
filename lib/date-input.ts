import { differenceInCalendarDays, format } from "date-fns"

import {
  getCalendarDatePrefix,
  parseCalendarDateValue as parseCalendarDateParts,
  type CalendarDateParts,
} from "@/lib/calendar-date"

const DEFAULT_CALENDAR_DATE_PATTERN = "dd-MM-yyyy"

export type DateInputValue = CalendarDateParts

export function parseDateInputValue(
  value: string | null | undefined
): DateInputValue | null {
  return parseCalendarDateParts(value)
}

function parseCalendarDateInputValue(
  value: string | null | undefined
): DateInputValue | null {
  return parseDateInputValue(getCalendarDatePrefix(value))
}

export function getCalendarDate(value: string | null | undefined) {
  const dateValue = parseCalendarDateInputValue(value)

  return dateValue
    ? new Date(dateValue.year, dateValue.month - 1, dateValue.day)
    : null
}

export function formatDateInputLabel(
  value: string | null | undefined,
  emptyLabel: string
) {
  return formatCalendarDateLabel(value, emptyLabel)
}

export function formatCalendarDateLabel(
  value: string | null | undefined,
  emptyLabel: string,
  pattern = DEFAULT_CALENDAR_DATE_PATTERN
) {
  const date = getCalendarDate(value)
  return date ? format(date, pattern) : emptyLabel
}

export function getCalendarDateDayOffset(
  value: string | null | undefined,
  now = new Date()
) {
  const date = getCalendarDate(value)

  if (!date) {
    return null
  }

  return differenceInCalendarDays(
    date,
    new Date(now.getFullYear(), now.getMonth(), now.getDate())
  )
}
