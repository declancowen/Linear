import { isAfter } from "date-fns"

import type {
  AppData,
  DisplayProperty,
  GroupField,
  OrderingField,
  Priority,
  Project,
  UserProfile,
  ViewDefinition,
  WorkItem,
  WorkStatus,
} from "@/lib/domain/types"
import {
  getAllowedChildWorkItemTypesForItem,
  isCompletedWorkStatus,
  isExcludedFromWorkStatusRollup,
  priorities,
  priorityMeta,
  workItemTypes,
  workStatuses,
} from "@/lib/domain/types"

import {
  getAccessibleTeams,
  getProject,
  getStatusOrderForTeam,
  getTeam,
  getUser,
  getWorkItem,
} from "@/lib/domain/selectors-internal/core"

export function getVisibleWorkItems(
  data: AppData,
  params:
    | { teamId: string }
    | { workspaceId: string }
    | { assignedToCurrentUser: true }
) {
  if ("assignedToCurrentUser" in params) {
    const teamIds = getAccessibleTeams(data).map((team) => team.id)
    return data.workItems.filter(
      (item) =>
        item.assigneeId === data.currentUserId && teamIds.includes(item.teamId)
    )
  }

  if ("teamId" in params) {
    return data.workItems.filter((item) => item.teamId === params.teamId)
  }

  const teamIds = getAccessibleTeams(data)
    .filter((team) => team.workspaceId === params.workspaceId)
    .map((team) => team.id)

  return data.workItems.filter((item) => teamIds.includes(item.teamId))
}

export function getDirectChildWorkItems(data: AppData, itemId: string) {
  return data.workItems.filter((item) => item.parentId === itemId)
}

export function getDirectChildWorkItemsForDisplay(
  data: AppData,
  item: WorkItem,
  ordering: OrderingField,
  view?: ViewDefinition
) {
  const allowedChildTypes = getAllowedChildWorkItemTypesForItem(item)

  if (allowedChildTypes.length !== 1) {
    return []
  }

  return sortItems(
    data.workItems.filter(
      (candidate) =>
        candidate.parentId === item.id &&
        allowedChildTypes.includes(candidate.type) &&
        (!view || itemMatchesView(data, candidate, view, { ignoreItemLevel: true }))
    ),
    ordering
  )
}

export function getWorkItemChildProgress(data: AppData, itemId: string) {
  const children = getDirectChildWorkItems(data, itemId)
  const includedChildren = children.filter(
    (child) => !isExcludedFromWorkStatusRollup(child.status)
  )
  const completedChildren = includedChildren.filter((child) =>
    isCompletedWorkStatus(child.status)
  )

  return {
    totalChildren: children.length,
    includedChildren: includedChildren.length,
    completedChildren: completedChildren.length,
    excludedChildren: children.length - includedChildren.length,
    percent:
      includedChildren.length === 0
        ? 0
        : Math.round((completedChildren.length / includedChildren.length) * 100),
  }
}

export function itemMatchesView(
  data: AppData,
  item: WorkItem,
  view: ViewDefinition,
  options?: {
    ignoreItemLevel?: boolean
  }
) {
  if (!options?.ignoreItemLevel && view.itemLevel && item.type !== view.itemLevel) {
    return false
  }

  const project = getProject(data, item.primaryProjectId)

  if (
    view.filters.status.length > 0 &&
    !view.filters.status.includes(item.status)
  ) {
    return false
  }

  if (
    view.filters.priority.length > 0 &&
    !view.filters.priority.includes(item.priority)
  ) {
    return false
  }

  if (
    view.filters.assigneeIds.length > 0 &&
    !view.filters.assigneeIds.includes(item.assigneeId ?? "")
  ) {
    return false
  }

  if (
    view.filters.creatorIds.length > 0 &&
    !view.filters.creatorIds.includes(item.creatorId)
  ) {
    return false
  }

  if (
    view.filters.projectIds.length > 0 &&
    !view.filters.projectIds.includes(item.primaryProjectId ?? "")
  ) {
    return false
  }

  if (
    view.filters.itemTypes.length > 0 &&
    !view.filters.itemTypes.includes(item.type)
  ) {
    return false
  }

  if (
    view.filters.labelIds.length > 0 &&
    !item.labelIds.some((labelId) => view.filters.labelIds.includes(labelId))
  ) {
    return false
  }

  if (
    view.filters.teamIds.length > 0 &&
    !view.filters.teamIds.includes(item.teamId)
  ) {
    return false
  }

  if (
    view.filters.leadIds.length > 0 &&
    !view.filters.leadIds.includes(project?.leadId ?? "")
  ) {
    return false
  }

  if (
    view.filters.health.length > 0 &&
    !view.filters.health.includes(project?.health ?? "no-update")
  ) {
    return false
  }

  if (
    !view.filters.showCompleted &&
    (item.status === "done" ||
      item.status === "cancelled" ||
      item.status === "duplicate")
  ) {
    return false
  }

  return true
}

export function getVisibleItemsForView(
  data: AppData,
  items: WorkItem[],
  view: ViewDefinition
) {
  const filteredItems = items.filter((item) => itemMatchesView(data, item, view))

  if (view.entityKind === "items" && !view.itemLevel) {
    return filteredItems.filter((item) => item.parentId === null)
  }

  return filteredItems
}

export function comparePriority(left: Priority, right: Priority) {
  return priorityMeta[right].weight - priorityMeta[left].weight
}

export function sortItems(items: WorkItem[], ordering: OrderingField) {
  return [...items].sort((left, right) => {
    if (ordering === "priority") {
      return comparePriority(left.priority, right.priority)
    }

    if (ordering === "title") {
      return left.title.localeCompare(right.title)
    }

    const leftValue = left[ordering]
    const rightValue = right[ordering]

    if (!leftValue && !rightValue) {
      return 0
    }

    if (!leftValue) {
      return 1
    }

    if (!rightValue) {
      return -1
    }

    return rightValue.localeCompare(leftValue)
  })
}

export function getGroupValue(
  data: AppData,
  item: WorkItem,
  field: GroupField | null
) {
  if (!field) {
    return "all"
  }

  if (field === "project") {
    return getProject(data, item.primaryProjectId)?.name ?? "No project"
  }

  if (field === "assignee") {
    return getUser(data, item.assigneeId)?.name ?? "No assignee"
  }

  if (field === "label") {
    const primaryLabelId = item.labelIds[0]
    return (
      data.labels.find((label) => label.id === primaryLabelId)?.name ??
      "No label"
    )
  }

  if (field === "team") {
    return getTeam(data, item.teamId)?.name ?? "Unknown team"
  }

  if (field === "epic" || field === "feature") {
    let cursor: WorkItem | null = item

    while (cursor) {
      if (cursor.type === field) {
        return `${cursor.key} · ${cursor.title}`
      }

      cursor = cursor.parentId ? getWorkItem(data, cursor.parentId) : null
    }

    return `No ${field}`
  }

  if (field === "type") {
    return item.type
  }

  return item[field]
}

export function getAvailableGroupKeysForItems(
  data: AppData,
  items: WorkItem[],
  field: GroupField | null
) {
  if (!field || items.length === 0) {
    return []
  }

  const keys = new Set<string>()
  const teamIds = new Set(items.map((item) => item.teamId))
  const workspaceIds = new Set(
    [...teamIds]
      .map((teamId) => getTeam(data, teamId)?.workspaceId ?? null)
      .filter((workspaceId): workspaceId is string => workspaceId !== null)
  )

  if (field === "status") {
    getStatusOrderForItems(data, items).forEach((status) => keys.add(status))
  }

  if (field === "priority") {
    priorities.forEach((priority) => keys.add(priority))
  }

  if (field === "assignee") {
    keys.add("No assignee")

    const memberIds = new Set(
      data.teamMemberships
        .filter((membership) => teamIds.has(membership.teamId))
        .map((membership) => membership.userId)
    )

    data.users.forEach((user) => {
      if (memberIds.has(user.id)) {
        keys.add(user.name)
      }
    })
  }

  if (field === "project") {
    keys.add("No project")

    data.projects.forEach((project) => {
      if (
        (project.scopeType === "team" && teamIds.has(project.scopeId)) ||
        (project.scopeType === "workspace" &&
          workspaceIds.has(project.scopeId))
      ) {
        keys.add(project.name)
      }
    })
  }

  if (field === "team") {
    data.teams.forEach((team) => {
      if (workspaceIds.has(team.workspaceId) || teamIds.has(team.id)) {
        keys.add(team.name)
      }
    })
  }

  if (field === "type") {
    workItemTypes.forEach((type) => keys.add(type))
  }

  items.forEach((item) => {
    keys.add(getGroupValue(data, item, field))
  })

  return [...keys]
}

export function buildItemGroups(
  data: AppData,
  items: WorkItem[],
  view: ViewDefinition
) {
  const sortedItems = sortItems(items, view.ordering)
  const groups = new Map<string, Map<string, WorkItem[]>>()

  for (const item of sortedItems) {
    const groupKey = getGroupValue(data, item, view.grouping)
    const subgroupKey = getGroupValue(data, item, view.subGrouping)

    if (!groups.has(groupKey)) {
      groups.set(groupKey, new Map())
    }

    const subgroups = groups.get(groupKey)
    if (!subgroups) {
      continue
    }

    if (!subgroups.has(subgroupKey)) {
      subgroups.set(subgroupKey, [])
    }

    subgroups.get(subgroupKey)?.push(item)
  }

  const statusOrder = getStatusOrderForItems(data, items)

  return new Map(
    [...groups.entries()]
      .sort((left, right) =>
        compareGroupKeys(view.grouping, left[0], right[0], statusOrder)
      )
      .map(([groupKey, subgroups]) => [
        groupKey,
        new Map(
          [...subgroups.entries()].sort((left, right) =>
            compareGroupKeys(view.subGrouping, left[0], right[0], statusOrder)
          )
        ),
      ])
  )
}

export function buildItemGroupsWithEmptyGroups(
  data: AppData,
  items: WorkItem[],
  view: ViewDefinition
) {
  const groups = new Map(buildItemGroups(data, items, view))
  const statusOrder = getStatusOrderForItems(data, items)

  getAvailableGroupKeysForItems(data, items, view.grouping).forEach(
    (groupKey) => {
      if (!groups.has(groupKey)) {
        groups.set(groupKey, new Map())
      }
    }
  )

  return new Map(
    [...groups.entries()].sort((left, right) =>
      compareGroupKeys(view.grouping, left[0], right[0], statusOrder)
    )
  )
}

function getStatusOrderForItems(data: AppData, items: WorkItem[]) {
  if (items.length === 0) {
    return [...workStatuses]
  }

  const teamIds = [...new Set(items.map((item) => item.teamId))]

  if (teamIds.length !== 1) {
    return [...workStatuses]
  }

  return getStatusOrderForTeam(getTeam(data, teamIds[0]))
}

function compareGroupKeys(
  field: GroupField | null,
  left: string,
  right: string,
  statusOrder: WorkStatus[]
) {
  if (field === "status") {
    return (
      statusOrder.indexOf(left as WorkStatus) -
      statusOrder.indexOf(right as WorkStatus)
    )
  }

  if (field === "priority") {
    return comparePriority(left as Priority, right as Priority)
  }

  if (field === "type") {
    const leftIndex = workItemTypes.indexOf(left as WorkItem["type"])
    const rightIndex = workItemTypes.indexOf(right as WorkItem["type"])

    if (leftIndex !== -1 && rightIndex !== -1) {
      return leftIndex - rightIndex
    }
  }

  return left.localeCompare(right)
}

export function getUpcomingItems(data: AppData) {
  return [...data.workItems]
    .filter((item) => item.targetDate)
    .sort((left, right) => {
      if (!left.targetDate || !right.targetDate) {
        return 0
      }

      return left.targetDate.localeCompare(right.targetDate)
    })
}

export function getLateItems(data: AppData) {
  const now = new Date()
  return data.workItems.filter((item) => {
    if (!item.dueDate || item.status === "done") {
      return false
    }

    return isAfter(now, new Date(item.dueDate))
  })
}

export function formatDisplayValue(
  data: AppData,
  item: WorkItem,
  property: DisplayProperty
) {
  if (property === "assignee") {
    return getUser(data, item.assigneeId)?.name ?? "Unassigned"
  }

  if (property === "project") {
    return getProject(data, item.primaryProjectId)?.name ?? "No project"
  }

  if (property === "milestone") {
    return (
      data.milestones.find((milestone) => milestone.id === item.milestoneId)
        ?.name ?? "No milestone"
    )
  }

  if (property === "labels") {
    return item.labelIds
      .map((labelId) => data.labels.find((label) => label.id === labelId)?.name)
      .filter(Boolean)
      .join(", ")
  }

  if (property === "created") {
    return item.createdAt
  }

  if (property === "updated") {
    return item.updatedAt
  }

  if (property === "dueDate") {
    return item.dueDate ?? "No due date"
  }

  if (property === "id") {
    return item.key
  }

  if (property === "type") {
    return item.type
  }

  return item[property]
}

export function getLinkedProjects(data: AppData, item: WorkItem) {
  return item.linkedProjectIds
    .map((projectId) => getProject(data, projectId))
    .filter(Boolean) as Project[]
}

export function getItemAssignees(data: AppData, items: WorkItem[]) {
  const assignees = new Map<string, UserProfile>()

  for (const item of items) {
    const user = getUser(data, item.assigneeId)
    if (user) {
      assignees.set(user.id, user)
    }
  }

  return [...assignees.values()]
}
