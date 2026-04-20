import { differenceInCalendarDays, format } from "date-fns"

const DATE_INPUT_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})/
const DEFAULT_CALENDAR_DATE_PATTERN = "dd-MM-yyyy"

export interface DateInputValue {
  year: number
  month: number
  day: number
}

function getDatePrefix(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return DATE_PREFIX_PATTERN.exec(value.trim())?.[1] ?? null
}

export function parseDateInputValue(
  value: string | null | undefined
): DateInputValue | null {
  if (!value) {
    return null
  }

  const match = DATE_INPUT_VALUE_PATTERN.exec(value.trim())

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(Date.UTC(year, month - 1, day))

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

export function parseCalendarDateValue(
  value: string | null | undefined
): DateInputValue | null {
  return parseDateInputValue(getDatePrefix(value))
}

export function getCalendarDate(value: string | null | undefined) {
  const dateValue = parseCalendarDateValue(value)

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
