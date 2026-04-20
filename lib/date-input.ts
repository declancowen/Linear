const DATE_INPUT_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const dateInputLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

export interface DateInputValue {
  year: number
  month: number
  day: number
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

export function formatDateInputLabel(
  value: string | null | undefined,
  emptyLabel: string
) {
  const dateValue = parseDateInputValue(value)

  if (!dateValue) {
    return emptyLabel
  }

  // Date input values are calendar dates, not instants, so format them in UTC.
  return dateInputLabelFormatter.format(
    new Date(Date.UTC(dateValue.year, dateValue.month - 1, dateValue.day))
  )
}
