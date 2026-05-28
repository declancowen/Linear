const TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

const fallbackTimeZone = "UTC"

export function getBrowserTimeZone() {
  if (typeof Intl === "undefined") {
    return fallbackTimeZone
  }

  return normalizeTimeZone(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    fallbackTimeZone
  )
}

export function getSupportedTimeZones() {
  const supportedValuesOf =
    typeof Intl !== "undefined"
      ? (Intl as unknown as {
          supportedValuesOf?: (key: "timeZone") => string[]
        }).supportedValuesOf
      : undefined

  if (supportedValuesOf) {
    return sortTimeZonesByOffset(
      new Set([fallbackTimeZone, ...supportedValuesOf("timeZone")])
    )
  }

  return sortTimeZonesByOffset([
    "UTC",
    "Europe/London",
    "Europe/Paris",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
  ])
}

export function isValidTimeValue(value: string | null | undefined) {
  return typeof value === "string" && TIME_VALUE_PATTERN.test(value.trim())
}

export function isValidTimeZone(value: string | null | undefined) {
  if (!value) {
    return false
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function normalizeTimeZone(
  value: string | null | undefined,
  fallback = fallbackTimeZone
) {
  return value && isValidTimeZone(value) ? value : fallback
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  )

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone)
  const zonedTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  return (zonedTimestamp - date.getTime()) / 60000
}

function getTimeZoneSortOffsetMinutes(timeZone: string, date: Date) {
  try {
    return Math.round(getTimeZoneOffsetMinutes(date, timeZone))
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function compareTimeZoneNames(firstTimeZone: string, secondTimeZone: string) {
  if (firstTimeZone === fallbackTimeZone) {
    return secondTimeZone === fallbackTimeZone ? 0 : -1
  }

  if (secondTimeZone === fallbackTimeZone) {
    return 1
  }

  return firstTimeZone.localeCompare(secondTimeZone)
}

function sortTimeZonesByOffset(timeZones: Iterable<string>) {
  const date = new Date()

  return Array.from(timeZones).sort((firstTimeZone, secondTimeZone) => {
    const firstOffset = getTimeZoneSortOffsetMinutes(firstTimeZone, date)
    const secondOffset = getTimeZoneSortOffsetMinutes(secondTimeZone, date)

    return (
      firstOffset - secondOffset ||
      compareTimeZoneNames(firstTimeZone, secondTimeZone)
    )
  })
}

function getTimeZoneOffsetLabel(
  timeZone: string,
  date: Date = new Date()
) {
  const offsetMinutes = Math.round(
    getTimeZoneOffsetMinutes(date, normalizeTimeZone(timeZone))
  )
  const sign = offsetMinutes >= 0 ? "+" : "-"
  const absoluteOffset = Math.abs(offsetMinutes)
  const hours = Math.floor(absoluteOffset / 60)
  const minutes = absoluteOffset % 60

  return `UTC${sign}${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`
}

export function formatTimeZoneLabel(
  timeZone: string,
  date: Date = new Date()
) {
  const normalizedTimeZone = normalizeTimeZone(timeZone)

  return `${normalizedTimeZone.replaceAll("_", " ")} (${getTimeZoneOffsetLabel(
    normalizedTimeZone,
    date
  )})`
}

export function zonedWallTimeToUtc(input: {
  date: string
  time: string
  timeZone: string
}) {
  if (!isValidTimeValue(input.time) || !isValidTimeZone(input.timeZone)) {
    return null
  }

  const [year, month, day] = input.date.split("-").map(Number)
  const [hour, minute] = input.time.split(":").map(Number)

  if (
    !year ||
    !month ||
    !day ||
    hour === undefined ||
    minute === undefined
  ) {
    return null
  }

  const wallTimestamp = Date.UTC(year, month - 1, day, hour, minute)
  const firstOffset = getTimeZoneOffsetMinutes(
    new Date(wallTimestamp),
    input.timeZone
  )
  const firstUtcTimestamp = wallTimestamp - firstOffset * 60000
  const secondOffset = getTimeZoneOffsetMinutes(
    new Date(firstUtcTimestamp),
    input.timeZone
  )
  const utcTimestamp =
    firstOffset === secondOffset
      ? firstUtcTimestamp
      : wallTimestamp - secondOffset * 60000

  return new Date(utcTimestamp)
}

export function utcToZonedWallTime(date: Date, timeZone: string) {
  const parts = getZonedParts(date, normalizeTimeZone(timeZone))
  return {
    date: [
      parts.year.toString().padStart(4, "0"),
      parts.month.toString().padStart(2, "0"),
      parts.day.toString().padStart(2, "0"),
    ].join("-"),
    time: [
      parts.hour.toString().padStart(2, "0"),
      parts.minute.toString().padStart(2, "0"),
    ].join(":"),
  }
}
