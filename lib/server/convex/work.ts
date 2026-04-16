import { api } from "@/convex/_generated/api"
import type {
  GroupField,
  OrderingField,
  Priority,
  WorkItemType,
  WorkStatus,
} from "@/lib/domain/types"
import { coerceApplicationError } from "@/lib/server/application-errors"

import { getConvexServerClient, withServerToken } from "./core"

const WORK_ITEM_MUTATION_ERROR_MAPPINGS = [
  {
    match: "Work item not found",
    status: 404,
    code: "WORK_ITEM_NOT_FOUND",
  },
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Assignee must belong to the selected team",
    status: 400,
    code: "WORK_ITEM_ASSIGNEE_INVALID",
  },
  {
    match: "One or more labels are invalid",
    status: 400,
    code: "WORK_ITEM_LABELS_INVALID",
  },
  {
    match: "Project not found",
    status: 404,
    code: "PROJECT_NOT_FOUND",
  },
  {
    match: "Project must belong to the same team or workspace",
    status: 400,
    code: "WORK_ITEM_PROJECT_SCOPE_INVALID",
  },
  {
    match: "Work item type is not allowed for the selected project template",
    status: 400,
    code: "WORK_ITEM_PROJECT_TEMPLATE_INVALID",
  },
  {
    match:
      "A work item type in this hierarchy is not allowed for the selected project template",
    status: 400,
    code: "WORK_ITEM_PROJECT_TEMPLATE_HIERARCHY_INVALID",
  },
  {
    match: "Parent item not found",
    status: 404,
    code: "WORK_ITEM_PARENT_NOT_FOUND",
  },
  {
    match: "Parent item must belong to the same team",
    status: 400,
    code: "WORK_ITEM_PARENT_SCOPE_INVALID",
  },
  {
    match: "An item cannot be its own parent",
    status: 400,
    code: "WORK_ITEM_PARENT_SELF_REFERENCE",
  },
  {
    match: "Parent item type cannot contain this child type",
    status: 400,
    code: "WORK_ITEM_PARENT_TYPE_INVALID",
  },
  {
    match: "Parent item would create a cycle",
    status: 409,
    code: "WORK_ITEM_PARENT_CYCLE",
  },
  {
    match: (message: string) =>
      message === "Your current role is read-only" ||
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "WORK_ITEM_ACCESS_DENIED",
  },
  {
    match: /disabled for this team$/,
    status: 400,
    code: "WORK_ITEM_CREATION_DISABLED",
  },
] as const

const SHIFT_TIMELINE_ITEM_ERROR_MAPPINGS = [
  ...WORK_ITEM_MUTATION_ERROR_MAPPINGS,
  {
    match: "Work item is not scheduled",
    status: 400,
    code: "WORK_ITEM_SCHEDULE_MISSING",
  },
] as const

const VIEW_MUTATION_ERROR_MAPPINGS = [
  {
    match: "View not found",
    status: 404,
    code: "VIEW_NOT_FOUND",
  },
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "One or more labels are invalid",
    status: 400,
    code: "VIEW_LABELS_INVALID",
  },
  {
    match: (message: string) =>
      message === "You do not have access to this view" ||
      message === "Your current role is read-only" ||
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "VIEW_ACCESS_DENIED",
  },
] as const

const LABEL_MUTATION_ERROR_MAPPINGS = [
  {
    match: "User not found",
    status: 404,
    code: "ACCOUNT_NOT_FOUND",
  },
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: (message: string) =>
      message === "Your current role is read-only" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "LABEL_ACCESS_DENIED",
  },
  {
    match: "Label name is required",
    status: 400,
    code: "LABEL_NAME_REQUIRED",
  },
] as const

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
  try {
    return await getConvexServerClient().mutation(
      api.app.updateWorkItem,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...WORK_ITEM_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function createLabelServer(input: {
  currentUserId: string
  workspaceId: string
  name: string
  color?: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.createLabel,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...LABEL_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function deleteWorkItemServer(input: {
  currentUserId: string
  itemId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.deleteWorkItem,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...WORK_ITEM_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
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
  try {
    return await getConvexServerClient().mutation(
      api.app.updateViewConfig,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
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
  try {
    return await getConvexServerClient().mutation(
      api.app.toggleViewDisplayProperty,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function toggleViewHiddenValueServer(input: {
  currentUserId: string
  viewId: string
  key: "groups" | "subgroups"
  value: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.toggleViewHiddenValue,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
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
  try {
    return await getConvexServerClient().mutation(
      api.app.toggleViewFilterValue,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function clearViewFiltersServer(input: {
  currentUserId: string
  viewId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.clearViewFilters,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function shiftTimelineItemServer(input: {
  currentUserId: string
  itemId: string
  nextStartDate: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.shiftTimelineItem,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...SHIFT_TIMELINE_ITEM_ERROR_MAPPINGS]) ??
      error
    )
  }
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
  try {
    return await getConvexServerClient().mutation(
      api.app.createWorkItem,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...WORK_ITEM_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}
