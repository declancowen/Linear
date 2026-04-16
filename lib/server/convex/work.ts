import { api } from "@/convex/_generated/api"
import type {
  GroupField,
  OrderingField,
  Priority,
  WorkItemType,
  WorkStatus,
} from "@/lib/domain/types"

import { getConvexServerClient, withServerToken } from "./core"

export async function updateWorkItemServer(input: {
  currentUserId: string
  itemId: string
  patch: {
    status?:
      | "backlog"
      | "todo"
      | "in-progress"
      | "done"
      | "cancelled"
      | "duplicate"
    priority?: "none" | "low" | "medium" | "high" | "urgent"
    assigneeId?: string | null
    parentId?: string | null
    primaryProjectId?: string | null
    labelIds?: string[]
    startDate?: string | null
    dueDate?: string | null
    targetDate?: string | null
  }
}) {
  return getConvexServerClient().mutation(
    api.app.updateWorkItem,
    withServerToken(input)
  )
}

export async function createLabelServer(input: {
  currentUserId: string
  name: string
  color?: string
}) {
  return getConvexServerClient().mutation(
    api.app.createLabel,
    withServerToken(input)
  )
}

export async function deleteWorkItemServer(input: {
  currentUserId: string
  itemId: string
}) {
  return getConvexServerClient().mutation(
    api.app.deleteWorkItem,
    withServerToken(input)
  )
}

export async function updateViewConfigServer(input: {
  currentUserId: string
  viewId: string
  layout?: "list" | "board" | "timeline"
  grouping?: GroupField
  subGrouping?: GroupField | null
  ordering?: OrderingField
  showCompleted?: boolean
}) {
  return getConvexServerClient().mutation(
    api.app.updateViewConfig,
    withServerToken(input)
  )
}

export async function toggleViewDisplayPropertyServer(input: {
  currentUserId: string
  viewId: string
  property:
    | "id"
    | "type"
    | "status"
    | "assignee"
    | "priority"
    | "project"
    | "dueDate"
    | "milestone"
    | "labels"
    | "created"
    | "updated"
}) {
  return getConvexServerClient().mutation(
    api.app.toggleViewDisplayProperty,
    withServerToken(input)
  )
}

export async function toggleViewHiddenValueServer(input: {
  currentUserId: string
  viewId: string
  key: "groups" | "subgroups"
  value: string
}) {
  return getConvexServerClient().mutation(
    api.app.toggleViewHiddenValue,
    withServerToken(input)
  )
}

export async function toggleViewFilterValueServer(input: {
  currentUserId: string
  viewId: string
  key:
    | "status"
    | "priority"
    | "assigneeIds"
    | "projectIds"
    | "itemTypes"
    | "labelIds"
  value: string
}) {
  return getConvexServerClient().mutation(
    api.app.toggleViewFilterValue,
    withServerToken(input)
  )
}

export async function clearViewFiltersServer(input: {
  currentUserId: string
  viewId: string
}) {
  return getConvexServerClient().mutation(
    api.app.clearViewFilters,
    withServerToken(input)
  )
}

export async function shiftTimelineItemServer(input: {
  currentUserId: string
  itemId: string
  nextStartDate: string
}) {
  return getConvexServerClient().mutation(
    api.app.shiftTimelineItem,
    withServerToken(input)
  )
}

export async function createWorkItemServer(input: {
  currentUserId: string
  teamId: string
  type: WorkItemType
  title: string
  parentId?: string | null
  primaryProjectId: string | null
  assigneeId: string | null
  status?: WorkStatus
  priority: Priority
  labelIds?: string[]
}) {
  return getConvexServerClient().mutation(
    api.app.createWorkItem,
    withServerToken(input)
  )
}

export async function backfillWorkItemModelServer() {
  return getConvexServerClient().mutation(
    api.app.backfillWorkItemModel,
    withServerToken({})
  )
}
