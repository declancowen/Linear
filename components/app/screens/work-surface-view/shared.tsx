"use client"

import {
  getDisplayLabelForWorkItemType,
  priorityMeta,
  statusMeta,
  type GroupField,
  type Priority,
  type WorkItem,
  type WorkItemType,
} from "@/lib/domain/types"

import { StatusIcon } from "../shared"

const STATUS_GROUP_ACCENT_BY_VALUE: Record<string, string> = {
  backlog: "var(--status-backlog)",
  canceled: "var(--priority-urgent)",
  cancelled: "var(--priority-urgent)",
  done: "var(--status-done)",
  duplicate: "var(--status-cancel)",
  "in progress": "var(--status-doing)",
  "in-progress": "var(--status-doing)",
  todo: "var(--status-todo)",
}

const PRIORITY_GROUP_ACCENT_BY_VALUE: Partial<Record<Priority, string>> = {
  urgent: "var(--priority-urgent)",
  high: "var(--priority-high)",
  medium: "var(--priority-medium)",
  low: "var(--priority-low)",
}

export function getGroupValueLabel(field: GroupField | null, value: string) {
  if (!field) {
    return "All"
  }

  if (field === "status") {
    return statusMeta[value as WorkItem["status"]]?.label ?? value
  }

  if (field === "priority") {
    return priorityMeta[value as Priority]?.label ?? value
  }

  if (field === "type") {
    return getDisplayLabelForWorkItemType(value as WorkItemType, null)
  }

  return value
}

export function getGroupValueAdornment(
  field: GroupField | null,
  value: string
) {
  if (field === "status") {
    return <StatusIcon status={value as WorkItem["status"]} />
  }

  return null
}

export function getGroupAccentVar(
  field: GroupField | null,
  value: string
): string | null {
  if (field === "status") {
    return STATUS_GROUP_ACCENT_BY_VALUE[value.trim().toLowerCase()] ?? null
  }

  if (field === "priority") {
    return PRIORITY_GROUP_ACCENT_BY_VALUE[value as Priority] ?? null
  }

  return null
}
