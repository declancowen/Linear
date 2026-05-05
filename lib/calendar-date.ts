const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const CALENDAR_DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})/
const CALENDAR_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T.+$/

export interface CalendarDateParts {
  year: number
  month: number
  day: number
}

function padCalendarDateSegment(value: number) {
  return value.toString().padStart(2, "0")
}

export function parseCalendarDateValue(
  value: string | null | undefined
): CalendarDateParts | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  const match = CALENDAR_DATE_PATTERN.exec(trimmed)

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

function isValidCalendarDatePrefix(value: string) {
  return parseCalendarDateValue(value) !== null
}

export function formatLocalCalendarDate(date = new Date()) {
  return [
    date.getFullYear(),
    padCalendarDateSegment(date.getMonth() + 1),
    padCalendarDateSegment(date.getDate()),
  ].join("-")
}

export function addLocalCalendarDays(days: number, date = new Date()) {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  nextDate.setDate(nextDate.getDate() + days)
  return formatLocalCalendarDate(nextDate)
}

export function shiftCalendarDate(
  value: string | null | undefined,
  days: number
) {
  const prefix = getCalendarDatePrefix(value)

  if (!prefix) {
    return null
  }

  const parsed = parseCalendarDateValue(prefix)

  if (!parsed) {
    return null
  }

  return addLocalCalendarDays(
    days,
    new Date(parsed.year, parsed.month - 1, parsed.day)
  )
}

export function getCalendarDatePrefix(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  const prefix = CALENDAR_DATE_PREFIX_PATTERN.exec(trimmed)?.[1] ?? null

  if (!prefix || !isValidCalendarDatePrefix(prefix)) {
    return null
  }

  if (trimmed === prefix) {
    return prefix
  }

  if (!CALENDAR_DATE_TIME_PATTERN.test(trimmed)) {
    return null
  }

  return Number.isNaN(Date.parse(trimmed)) ? null : prefix
}

export function isValidCalendarDateString(value: string | null | undefined) {
  return getCalendarDatePrefix(value) !== null
}
