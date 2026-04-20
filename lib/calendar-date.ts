function padCalendarDateSegment(value: number) {
  return value.toString().padStart(2, "0")
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
