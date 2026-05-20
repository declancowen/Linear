import type { CSSProperties } from "react"

import type { GroupField, WorkItem } from "@/lib/domain/types"

export type EventAccentMode =
  | "status"
  | "priority"
  | "label"
  | "project"
  | "auto"

export type EventAccentLabelLookup = Map<string, { color: string }>
type EventAccentLabel = {
  color: string
  id: string
}

const STATUS_ACCENTS: Record<WorkItem["status"], string> = {
  backlog: "var(--status-backlog)",
  todo: "var(--status-todo)",
  "in-progress": "var(--status-doing)",
  done: "var(--status-done)",
  cancelled: "var(--status-cancelled)",
  duplicate: "var(--status-duplicate)",
}

const PRIORITY_ACCENTS: Record<WorkItem["priority"], string> = {
  none: "var(--status-backlog)",
  low: "var(--priority-low)",
  medium: "var(--priority-medium)",
  high: "var(--priority-high)",
  urgent: "var(--priority-urgent)",
}

const PROJECT_ACCENTS = [
  "var(--cal-event-blue)",
  "var(--cal-event-indigo)",
  "var(--cal-event-violet)",
  "var(--cal-event-pink)",
  "var(--cal-event-rose)",
  "var(--cal-event-amber)",
  "var(--cal-event-green)",
  "var(--cal-event-teal)",
]

const LABEL_TOKEN_ACCENTS: Record<string, string> = {
  rose: "var(--label-1)",
  red: "var(--label-1)",
  amber: "var(--label-2)",
  orange: "var(--label-2)",
  yellow: "var(--label-2)",
  emerald: "var(--label-3)",
  green: "var(--label-3)",
  teal: "var(--label-3)",
  blue: "var(--label-4)",
  cyan: "var(--label-4)",
  sky: "var(--label-4)",
  indigo: "var(--label-5)",
  violet: "var(--label-5)",
  purple: "var(--label-5)",
  pink: "var(--label-5)",
}

const LABEL_FALLBACK_ACCENTS = [
  "var(--label-1)",
  "var(--label-2)",
  "var(--label-3)",
  "var(--label-4)",
  "var(--label-5)",
]

function getStableToneIndex(value: string) {
  return Array.from(value).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  )
}

function getProjectAccent(item: WorkItem, fallbackIndex: number) {
  const projectId = item.primaryProjectId ?? item.linkedProjectIds[0]
  const toneIndex = projectId ? getStableToneIndex(projectId) : fallbackIndex

  return PROJECT_ACCENTS[toneIndex % PROJECT_ACCENTS.length]
}

function resolveLabelAccentColor(
  color: string | null | undefined,
  fallbackIndex: number
) {
  if (!color) {
    return LABEL_FALLBACK_ACCENTS[fallbackIndex % LABEL_FALLBACK_ACCENTS.length]
  }

  const normalized = color.trim().toLowerCase()

  if (LABEL_TOKEN_ACCENTS[normalized]) {
    return LABEL_TOKEN_ACCENTS[normalized]
  }

  if (
    color.startsWith("var(") ||
    color.startsWith("#") ||
    color.startsWith("oklch(") ||
    color.startsWith("rgb(") ||
    color.startsWith("hsl(")
  ) {
    return color
  }

  return LABEL_FALLBACK_ACCENTS[fallbackIndex % LABEL_FALLBACK_ACCENTS.length]
}

function getLabelAccent(
  item: WorkItem,
  labelsById: EventAccentLabelLookup | null | undefined,
  fallbackIndex: number
) {
  const labelId = item.labelIds[0]
  const label = labelId && labelsById ? labelsById.get(labelId) : undefined

  return resolveLabelAccentColor(label?.color, fallbackIndex)
}

export function getEventAccent(
  item: WorkItem,
  mode: EventAccentMode,
  fallbackIndex: number,
  labelsById: EventAccentLabelLookup | null | undefined
) {
  if (mode === "priority") {
    return PRIORITY_ACCENTS[item.priority]
  }

  if (mode === "label") {
    return getLabelAccent(item, labelsById, fallbackIndex)
  }

  if (mode === "project") {
    return getProjectAccent(item, fallbackIndex)
  }

  return STATUS_ACCENTS[item.status]
}

export function createEventAccentLabelLookup(
  labels: EventAccentLabel[]
): EventAccentLabelLookup {
  const map = new Map<string, { color: string }>()

  for (const label of labels) {
    map.set(label.id, { color: label.color })
  }

  return map
}

export function resolveEventAccentModeFromGrouping(
  grouping: GroupField | null | undefined
): EventAccentMode {
  if (
    grouping === "status" ||
    grouping === "priority" ||
    grouping === "label"
  ) {
    return grouping
  }

  return "project"
}

export function getEventAccentStyle(accent: string): CSSProperties {
  return {
    "--cal-accent": accent,
    "--cal-accent-tint": `color-mix(in srgb, ${accent} 22%, var(--background))`,
    "--cal-accent-tint-hover": `color-mix(in srgb, ${accent} 32%, var(--background))`,
  } as CSSProperties
}
