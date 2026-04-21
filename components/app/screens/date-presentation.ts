import { format } from "date-fns"

import { getCalendarDate } from "@/lib/date-input"

function getDisplayPatternForDueDate(date: Date, now: Date) {
  return date.getFullYear() === now.getFullYear() ? "d MMMM" : "d MMMM yyyy"
}

function getDisplayPatternForTimestamp(date: Date, now: Date) {
  return date.getFullYear() < now.getFullYear() ? "d MMMM yyyy" : "d MMMM"
}

export function formatWorkSurfaceDueDate(
  value: string | null | undefined,
  now = new Date()
) {
  const date = getCalendarDate(value)

  if (!date) {
    return null
  }

  return `Due ${format(date, getDisplayPatternForDueDate(date, now))}`
}

export function formatWorkSurfaceTimestamp(
  value: string | null | undefined,
  label: "Created" | "Updated",
  now = new Date()
) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return `${label} ${format(date, getDisplayPatternForTimestamp(date, now))}`
}

export function formatWorkItemDetailDate(value: string | null | undefined) {
  const date = getCalendarDate(value)

  return date ? format(date, "EEEE, d MMMM yyyy") : "—"
}
