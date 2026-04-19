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

export function getGroupValueAdornment(field: GroupField | null, value: string) {
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
    const status = value as WorkItem["status"]
    if (status === "done") return "var(--status-done)"
    if (status === "in-progress") return "var(--status-doing)"
    if (status === "todo") return "var(--status-todo)"
    if (status === "cancelled" || status === "duplicate")
      return "var(--status-cancel)"
    if (status === "backlog") return "var(--status-backlog)"
    return null
  }

  if (field === "priority") {
    const priority = value as Priority
    if (priority === "urgent") return "var(--priority-urgent)"
    if (priority === "high") return "var(--priority-high)"
    if (priority === "medium") return "var(--priority-medium)"
    if (priority === "low") return "var(--priority-low)"
    return null
  }

  return null
}

export function computeGroupDoneRatio(items: WorkItem[]): {
  total: number
  done: number
  percent: number
} {
  const total = items.length
  if (total === 0) {
    return { total: 0, done: 0, percent: 0 }
  }

  const done = items.filter((item) => item.status === "done").length
  return { total, done, percent: Math.round((done / total) * 100) }
}
