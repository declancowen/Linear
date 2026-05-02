import type {
  AppData,
  GroupField,
  OrderingField,
  Priority,
  UserProfile,
  ViewDefinition,
  WorkItem,
  WorkStatus,
} from "@/lib/domain/types"
import {
  EMPTY_PARENT_FILTER_VALUE,
  getAllowedWorkItemTypesForTemplate,
  getAllowedChildWorkItemTypesForItem,
  getDefaultWorkItemTypesForTeamExperience,
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
    | { assignedToCurrentUserWithAncestors: true }
) {
  if (
    "assignedToCurrentUser" in params ||
    "assignedToCurrentUserWithAncestors" in params
  ) {
    const teamIds = new Set(getAccessibleTeams(data).map((team) => team.id))
    const assignedItems = data.workItems.filter(
      (item) =>
        item.assigneeId === data.currentUserId && teamIds.has(item.teamId)
    )

    if ("assignedToCurrentUser" in params) {
      return assignedItems
    }

    const itemsById = new Map(
      data.workItems
        .filter((item) => teamIds.has(item.teamId))
        .map((item) => [item.id, item] as const)
    )
    const includedIds = new Set(assignedItems.map((item) => item.id))

    assignedItems.forEach((item) => {
      let parentId = item.parentId

      while (parentId) {
        const parent = itemsById.get(parentId)

        if (!parent) {
          break
        }

        includedIds.add(parent.id)
        parentId = parent.parentId
      }
    })

    return data.workItems.filter((item) => includedIds.has(item.id))
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
  view?: ViewDefinition,
  sourceItems?: WorkItem[],
  options?: {
    mode?: "direct" | "assigned-descendants"
  }
) {
  const sourcePool = sourceItems ?? data.workItems
  const mode = options?.mode ?? "direct"

  if (mode === "assigned-descendants") {
    const sourceItemsById = new Map(
      sourcePool.map((candidate) => [candidate.id, candidate] as const)
    )
    const assignedDescendants = sourcePool.filter((candidate) => {
      if (
        candidate.id === item.id ||
        candidate.assigneeId !== data.currentUserId
      ) {
        return false
      }

      if (
        view &&
        !itemMatchesView(data, candidate, view, {
          ignoreItemLevel: true,
        })
      ) {
        return false
      }

      let parentId = candidate.parentId

      while (parentId) {
        if (parentId === item.id) {
          return true
        }

        parentId = sourceItemsById.get(parentId)?.parentId ?? null
      }

      return false
    })

    if (assignedDescendants.length === 0) {
      return []
    }

    const assignedDescendantIds = new Set(
      assignedDescendants.map((candidate) => candidate.id)
    )
    const ancestorIdsWithAssignedChildren = new Set<string>()

    assignedDescendants.forEach((candidate) => {
      let parentId = candidate.parentId

      while (parentId && parentId !== item.id) {
        if (assignedDescendantIds.has(parentId)) {
          ancestorIdsWithAssignedChildren.add(parentId)
        }

        parentId = sourceItemsById.get(parentId)?.parentId ?? null
      }
    })

    return sortItems(
      assignedDescendants.filter(
        (candidate) => !ancestorIdsWithAssignedChildren.has(candidate.id)
      ),
      ordering
    )
  }

  const allowedChildTypes = getAllowedChildWorkItemTypesForItem(item)

  if (allowedChildTypes.length !== 1) {
    return []
  }

  return sortItems(
    sourcePool.filter(
      (candidate) =>
        candidate.parentId === item.id &&
        allowedChildTypes.includes(candidate.type) &&
        (!view ||
          itemMatchesView(data, candidate, view, { ignoreItemLevel: true }))
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
        : Math.round(
            (completedChildren.length / includedChildren.length) * 100
          ),
  }
}

function itemMatchesView(
  data: AppData,
  item: WorkItem,
  view: ViewDefinition,
  options?: {
    ignoreItemLevel?: boolean
  }
) {
  if (
    !options?.ignoreItemLevel &&
    view.itemLevel &&
    item.type !== view.itemLevel
  ) {
    return false
  }

  const project = getProject(data, item.primaryProjectId)

  return [
    matchesOptionalFilter(view.filters.status, item.status),
    matchesOptionalFilter(view.filters.priority, item.priority),
    matchesOptionalFilter(view.filters.assigneeIds, item.assigneeId ?? ""),
    matchesOptionalFilter(view.filters.creatorIds, item.creatorId),
    matchesOptionalFilter(view.filters.projectIds, item.primaryProjectId ?? ""),
    matchesParentFilter(view.filters.parentIds ?? [], item.parentId),
    matchesOptionalFilter(view.filters.itemTypes, item.type),
    matchesAnyOptionalFilter(view.filters.labelIds, item.labelIds),
    matchesOptionalFilter(view.filters.teamIds, item.teamId),
    matchesOptionalFilter(view.filters.leadIds, project?.leadId ?? ""),
    matchesOptionalFilter(view.filters.health, project?.health ?? "no-update"),
    matchesCompletionFilter(view.filters.showCompleted, item.status),
  ].every(Boolean)
}

function matchesOptionalFilter<T>(values: T[], candidate: T) {
  return values.length === 0 || values.includes(candidate)
}

function matchesAnyOptionalFilter<T>(values: T[], candidates: T[]) {
  return (
    values.length === 0 ||
    candidates.some((candidate) => values.includes(candidate))
  )
}

function matchesParentFilter(parentIds: string[], parentId: string | null) {
  if (parentIds.length === 0) {
    return true
  }

  return parentId === null
    ? parentIds.includes(EMPTY_PARENT_FILTER_VALUE)
    : parentIds.includes(parentId)
}

function matchesCompletionFilter(showCompleted: boolean, status: WorkStatus) {
  return showCompleted || !isCompletedLikeStatus(status)
}

function isCompletedLikeStatus(status: WorkStatus) {
  return status === "done" || status === "cancelled" || status === "duplicate"
}

function getParentItem(
  itemsById: Map<string, WorkItem>,
  item: WorkItem
): WorkItem | null {
  return item.parentId ? (itemsById.get(item.parentId) ?? null) : null
}

function getAncestorIdByItemLevel(
  itemsById: Map<string, WorkItem>,
  item: WorkItem,
  itemLevel: WorkItem["type"]
) {
  let cursor: WorkItem | null = item
  const visitedIds = new Set<string>()

  while (cursor && !visitedIds.has(cursor.id)) {
    if (cursor.type === itemLevel) {
      return cursor.id
    }

    visitedIds.add(cursor.id)
    cursor = getParentItem(itemsById, cursor)
  }

  return null
}

function getRootAncestorId(itemsById: Map<string, WorkItem>, item: WorkItem) {
  let cursor: WorkItem | null = item
  const visitedIds = new Set<string>()

  while (cursor && !visitedIds.has(cursor.id)) {
    if (!cursor.parentId) {
      return cursor.id
    }

    visitedIds.add(cursor.id)
    cursor = getParentItem(itemsById, cursor)
  }

  return null
}

function getAssignedDescendantContainerId(
  data: AppData,
  itemsById: Map<string, WorkItem>,
  item: WorkItem,
  view: ViewDefinition
) {
  if (!itemMatchesView(data, item, view, { ignoreItemLevel: true })) {
    return null
  }

  return view.itemLevel
    ? getAncestorIdByItemLevel(itemsById, item, view.itemLevel)
    : getRootAncestorId(itemsById, item)
}

function getAssignedDescendantContainerIds(
  data: AppData,
  items: WorkItem[],
  matchItems: WorkItem[],
  view: ViewDefinition
) {
  const itemsById = new Map(items.map((item) => [item.id, item] as const))
  const visibleContainerIds = new Set<string>()

  for (const item of matchItems) {
    const containerId = getAssignedDescendantContainerId(
      data,
      itemsById,
      item,
      view
    )

    if (containerId) {
      visibleContainerIds.add(containerId)
    }
  }

  return visibleContainerIds
}

export function getVisibleItemsForView(
  data: AppData,
  items: WorkItem[],
  view: ViewDefinition,
  options?: {
    matchItems?: WorkItem[]
    childDisplayMode?: "direct" | "assigned-descendants"
  }
) {
  if (
    options?.matchItems &&
    options.childDisplayMode === "assigned-descendants"
  ) {
    // Match filters against the assigned descendants, then lift matches back to
    // the container rows the surface renders.
    const visibleContainerIds = getAssignedDescendantContainerIds(
      data,
      items,
      options.matchItems,
      view
    )

    return items.filter((item) => visibleContainerIds.has(item.id))
  }

  const filteredItems = (options?.matchItems ?? items).filter((item) =>
    itemMatchesView(data, item, view)
  )

  if (view.entityKind === "items" && !view.itemLevel) {
    return filteredItems.filter((item) => item.parentId === null)
  }

  return filteredItems
}

export function comparePriority(left: Priority, right: Priority) {
  return priorityMeta[right].weight - priorityMeta[left].weight
}

function compareOptionalDescendingValues(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined
) {
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
}

function compareItemsByOrdering(
  left: WorkItem,
  right: WorkItem,
  ordering: OrderingField
) {
  if (ordering === "priority") {
    return comparePriority(left.priority, right.priority)
  }

  if (ordering === "title") {
    return left.title.localeCompare(right.title)
  }

  return compareOptionalDescendingValues(left[ordering], right[ordering])
}

export function sortItems(items: WorkItem[], ordering: OrderingField) {
  return [...items].sort((left, right) =>
    compareItemsByOrdering(left, right, ordering)
  )
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
    return getAncestorGroupValue(data, item, field)
  }

  if (field === "type") {
    return item.type
  }

  return item[field]
}

function getAncestorGroupValue(
  data: AppData,
  item: WorkItem,
  field: "epic" | "feature"
) {
  let cursor: WorkItem | null = item

  while (cursor) {
    if (cursor.type === field) {
      return `${cursor.key} · ${cursor.title}`
    }

    cursor = cursor.parentId ? getWorkItem(data, cursor.parentId) : null
  }

  return `No ${field}`
}

function getAvailableGroupKeyContext(
  data: AppData,
  items: WorkItem[],
  options?: {
    sourceItems?: WorkItem[]
    teamId?: string | null
    projectId?: string | null
  }
) {
  const sourceItems = options?.sourceItems ?? items
  const teamIds = new Set(sourceItems.map((item) => item.teamId))
  const project = options?.projectId
    ? getProject(data, options.projectId)
    : null

  if (options?.teamId) {
    teamIds.add(options.teamId)
  }

  if (project?.scopeType === "team") {
    teamIds.add(project.scopeId)
  }

  const workspaceIds = new Set(
    [...teamIds]
      .map((teamId) => getTeam(data, teamId)?.workspaceId ?? null)
      .filter((workspaceId): workspaceId is string => workspaceId !== null)
  )

  if (project?.scopeType === "workspace") {
    workspaceIds.add(project.scopeId)
  }

  return {
    data,
    options,
    project,
    sourceItems,
    teamIds,
    workspaceIds,
  }
}

type AvailableGroupKeyContext = ReturnType<typeof getAvailableGroupKeyContext>
type GroupKeyAppender = (
  keys: Set<string>,
  context: AvailableGroupKeyContext
) => void

function addStatusGroupKeys(
  keys: Set<string>,
  context: AvailableGroupKeyContext
) {
  const statusOrder =
    context.sourceItems.length > 0
      ? getStatusOrderForItems(context.data, context.sourceItems)
      : context.options?.teamId
        ? getStatusOrderForTeam(getTeam(context.data, context.options.teamId))
        : [...workStatuses]

  statusOrder.forEach((status) => keys.add(status))
}

function addAssigneeGroupKeys(
  keys: Set<string>,
  context: AvailableGroupKeyContext
) {
  keys.add("No assignee")

  const memberIds = new Set(
    context.data.teamMemberships
      .filter((membership) => context.teamIds.has(membership.teamId))
      .map((membership) => membership.userId)
  )

  context.data.users.forEach((user) => {
    if (memberIds.has(user.id)) {
      keys.add(user.name)
    }
  })
}

function addProjectGroupKeys(
  keys: Set<string>,
  context: AvailableGroupKeyContext
) {
  keys.add("No project")

  context.data.projects.forEach((project) => {
    if (
      (project.scopeType === "team" && context.teamIds.has(project.scopeId)) ||
      (project.scopeType === "workspace" &&
        context.workspaceIds.has(project.scopeId))
    ) {
      keys.add(project.name)
    }
  })
}

function addTeamGroupKeys(
  keys: Set<string>,
  context: AvailableGroupKeyContext
) {
  context.data.teams.forEach((team) => {
    if (
      context.workspaceIds.has(team.workspaceId) ||
      context.teamIds.has(team.id)
    ) {
      keys.add(team.name)
    }
  })
}

function addTypeGroupKeys(
  keys: Set<string>,
  context: AvailableGroupKeyContext
) {
  const allowedTypeKeys = new Set<WorkItem["type"]>()

  if (context.project) {
    getAllowedWorkItemTypesForTemplate(context.project.templateType).forEach(
      (type) => allowedTypeKeys.add(type)
    )
  }

  context.teamIds.forEach((teamId) => {
    getDefaultWorkItemTypesForTeamExperience(
      getTeam(context.data, teamId)?.settings.experience
    ).forEach((type) => allowedTypeKeys.add(type))
  })

  const allowedTypes =
    allowedTypeKeys.size > 0 ? [...allowedTypeKeys] : [...workItemTypes]

  allowedTypes.forEach((type) => keys.add(type))
}

const availableGroupKeyAppenders: Partial<
  Record<GroupField, GroupKeyAppender>
> = {
  assignee: addAssigneeGroupKeys,
  priority: (keys) => priorities.forEach((priority) => keys.add(priority)),
  project: addProjectGroupKeys,
  status: addStatusGroupKeys,
  team: addTeamGroupKeys,
  type: addTypeGroupKeys,
}

function getAvailableGroupKeysForItems(
  data: AppData,
  items: WorkItem[],
  field: GroupField | null,
  options?: {
    sourceItems?: WorkItem[]
    teamId?: string | null
    projectId?: string | null
  }
) {
  if (!field) {
    return []
  }

  const keys = new Set<string>()
  const context = getAvailableGroupKeyContext(data, items, options)

  availableGroupKeyAppenders[field]?.(keys, context)

  context.sourceItems.forEach((item) => {
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
  view: ViewDefinition,
  options?: {
    sourceItems?: WorkItem[]
    teamId?: string | null
    projectId?: string | null
  }
) {
  const groups = new Map(buildItemGroups(data, items, view))
  const statusSourceItems = options?.sourceItems ?? items
  const statusOrder =
    statusSourceItems.length > 0
      ? getStatusOrderForItems(data, statusSourceItems)
      : options?.teamId
        ? getStatusOrderForTeam(getTeam(data, options.teamId))
        : [...workStatuses]

  if (!hasActiveViewFilters(view)) {
    getAvailableGroupKeysForItems(data, items, view.grouping, options).forEach(
      (groupKey) => {
        if (!groups.has(groupKey)) {
          groups.set(groupKey, new Map())
        }
      }
    )
  }

  return new Map(
    [...groups.entries()].sort((left, right) =>
      compareGroupKeys(view.grouping, left[0], right[0], statusOrder)
    )
  )
}

function hasActiveViewFilters(view: ViewDefinition) {
  return (
    view.filters.status.length > 0 ||
    view.filters.priority.length > 0 ||
    view.filters.assigneeIds.length > 0 ||
    view.filters.creatorIds.length > 0 ||
    view.filters.leadIds.length > 0 ||
    view.filters.health.length > 0 ||
    view.filters.milestoneIds.length > 0 ||
    view.filters.relationTypes.length > 0 ||
    view.filters.projectIds.length > 0 ||
    (view.filters.parentIds?.length ?? 0) > 0 ||
    view.filters.itemTypes.length > 0 ||
    view.filters.labelIds.length > 0 ||
    view.filters.teamIds.length > 0 ||
    !view.filters.showCompleted
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
