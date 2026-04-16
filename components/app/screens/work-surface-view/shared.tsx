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
