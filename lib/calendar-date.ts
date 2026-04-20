const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const CALENDAR_DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})/
const CALENDAR_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T.+$/

function padCalendarDateSegment(value: number) {
  return value.toString().padStart(2, "0")
}

function isValidCalendarDatePrefix(value: string) {
  const match = CALENDAR_DATE_PATTERN.exec(value)

  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(Date.UTC(year, month - 1, day))

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  )
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
