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
import { isProjectAvailableGroupKey } from "@/lib/domain/selectors-internal/work-item-grouping"
import { compareOptionalDescendingValues } from "@/lib/domain/selectors-internal/work-item-ordering"
import { getWorkItemAssigneeIds } from "@/lib/domain/work-item-assignees"

export function getVisibleWorkItems(
  data: AppData,
  params:
    | { teamId: string }
    | { workspaceId: string }
    | { assignedToCurrentUser: true; includeSubscribed?: boolean }
    | { assignedToCurrentUserWithAncestors: true; includeSubscribed?: boolean }
) {
  if (
    "assignedToCurrentUser" in params ||
    "assignedToCurrentUserWithAncestors" in params
  ) {
    const teamIds = new Set(getAccessibleTeams(data).map((team) => team.id))
    const includeSubscribed = params.includeSubscribed ?? false
    const assignedItems = data.workItems.filter((item) =>
      isMyItemsWorkItem(data, item, teamIds, includeSubscribed)
    )

    if ("assignedToCurrentUser" in params) {
      return assignedItems
    }

    const itemsById = new Map(
      data.workItems
        .filter(
          (item) =>
            (getWorkItemVisibility(item) === "private"
              ? isPrivateWorkItemCreatedByCurrentUser(data, item)
              : teamIds.has(item.teamId ?? ""))
        )
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
    return data.workItems.filter(
      (item) =>
        item.teamId === params.teamId && getWorkItemVisibility(item) === "team"
    )
  }

  const teamIds = getAccessibleTeams(data)
    .filter((team) => team.workspaceId === params.workspaceId)
    .map((team) => team.id)

  return data.workItems.filter(
    (item) =>
      teamIds.includes(item.teamId ?? "") &&
      getWorkItemVisibility(item) === "team"
  )
}

function getWorkItemVisibility(item: WorkItem) {
  return item.visibility ?? "team"
}

function isPrivateWorkItemCreatedByCurrentUser(data: AppData, item: WorkItem) {
  return (
    getWorkItemVisibility(item) === "private" &&
    item.creatorId === data.currentUserId &&
    item.workspaceId === data.currentWorkspaceId
  )
}

function isMyItemsWorkItem(
  data: AppData,
  item: WorkItem,
  teamIds: Set<string>,
  includeSubscribed: boolean
) {
  if (getWorkItemVisibility(item) === "private") {
    return isPrivateWorkItemCreatedByCurrentUser(data, item)
  }

  return (
    (getWorkItemAssigneeIds(item).includes(data.currentUserId) ||
      (includeSubscribed && item.subscriberIds.includes(data.currentUserId))) &&
    teamIds.has(item.teamId ?? "")
  )
}

function isAssignedDescendantWorkItem(data: AppData, item: WorkItem) {
  if (getWorkItemVisibility(item) === "private") {
    return isPrivateWorkItemCreatedByCurrentUser(data, item)
  }

  return (
    getWorkItemAssigneeIds(item).includes(data.currentUserId) ||
    item.subscriberIds.includes(data.currentUserId)
  )
}

function isCurrentUserWorkItemAnchor(data: AppData, item: WorkItem) {
  return isAssignedDescendantWorkItem(data, item)
}

function getAncestorIdByItemLevels(
  itemsById: Map<string, WorkItem>,
  item: WorkItem,
  itemLevels: readonly WorkItem["type"][]
) {
  if (itemLevels.length === 0) {
    return null
  }

  let cursor: WorkItem | null = item
  const itemLevelSet = new Set(itemLevels)
  const visitedIds = new Set<string>()

  while (cursor && !visitedIds.has(cursor.id)) {
    if (itemLevelSet.has(cursor.type)) {
      return cursor.id
    }

    visitedIds.add(cursor.id)
    cursor = getParentItem(itemsById, cursor)
  }

  return null
}

export function getDirectChildWorkItems(data: AppData, itemId: string) {
  return data.workItems.filter((item) => item.parentId === itemId)
}

function getSortableDirectChildWorkItems(
  item: WorkItem,
  sourcePool: WorkItem[],
  ordering: OrderingField,
  predicate?: (candidate: WorkItem) => boolean
) {
  const allowedChildTypes = getAllowedChildWorkItemTypesForItem(item)

  if (allowedChildTypes.length !== 1) {
    return []
  }

  return sortItems(
    sourcePool.filter(
      (candidate) =>
        candidate.parentId === item.id &&
        allowedChildTypes.includes(candidate.type) &&
        (!predicate || predicate(candidate))
    ),
    ordering
  )
}

export function getDirectChildWorkItemsForDisplay(
  data: AppData,
  item: WorkItem,
  ordering: OrderingField,
  view?: ViewDefinition,
  sourceItems?: WorkItem[],
  options?: {
    filterChildren?: boolean
    mode?: "direct" | "assigned-descendants"
  }
) {
  const sourcePool = sourceItems ?? data.workItems
  const mode = options?.mode ?? "direct"
  const filterChildren = options?.filterChildren ?? true

  if (mode === "assigned-descendants") {
    const sourceItemsById = new Map(
      sourcePool.map((candidate) => [candidate.id, candidate] as const)
    )
    const parentIsAnchor =
      isCurrentUserWorkItemAnchor(data, item) &&
      (!view ||
        itemMatchesView(data, item, view, {
          ignoreItemLevel: true,
        }))

    if (parentIsAnchor) {
      return getSortableDirectChildWorkItems(
        item,
        sourcePool,
        ordering,
        (candidate) =>
          !filterChildren ||
          !view ||
          itemMatchesView(data, candidate, view, { ignoreItemLevel: true })
      )
    }

    const assignedDescendants = sourcePool.filter((candidate) => {
      if (
        candidate.id === item.id ||
        !isCurrentUserWorkItemAnchor(data, candidate)
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

  return getSortableDirectChildWorkItems(
    item,
    sourcePool,
    ordering,
    (candidate) =>
      !filterChildren ||
      !view ||
      itemMatchesView(data, candidate, view, { ignoreItemLevel: true })
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
    matchesAnyOptionalFilter(view.filters.assigneeIds, [
      ...getWorkItemAssigneeIds(item),
      ...(getWorkItemAssigneeIds(item).length === 0 ? [""] : []),
    ]),
    matchesOptionalFilter(view.filters.creatorIds, item.creatorId),
    matchesAnyOptionalFilter(view.filters.subscriberIds ?? [], [
      ...item.subscriberIds,
    ]),
    matchesOptionalFilter(view.filters.projectIds, item.primaryProjectId ?? ""),
    matchesParentFilter(view.filters.parentIds ?? [], item.parentId),
    matchesOptionalFilter(view.filters.itemTypes, item.type),
    matchesAnyOptionalFilter(view.filters.labelIds, item.labelIds),
    matchesOptionalFilter(
      view.filters.teamIds,
      getWorkItemVisibility(item) === "team" ? item.teamId : ""
    ),
    matchesOptionalFilter(
      view.filters.visibility ?? [],
      getWorkItemVisibility(item)
    ),
    matchesOptionalFilter(view.filters.leadIds, project?.leadId ?? ""),
    matchesOptionalFilter(view.filters.health, project?.health ?? "no-update"),
    matchesCompletionFilter(view.filters.showCompleted, item.status),
  ].every(Boolean)
}

export function workItemMatchesView(
  data: AppData,
  item: WorkItem,
  view: ViewDefinition,
  options?: {
    ignoreItemLevel?: boolean
  }
) {
  return itemMatchesView(data, item, view, options)
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
  const selectedParentIds = parentIds.filter(
    (value) => value !== EMPTY_PARENT_FILTER_VALUE
  )

  if (selectedParentIds.length === 0) {
    return true
  }

  return parentId !== null && selectedParentIds.includes(parentId)
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

function itemMatchesAssignedDescendantContainerView(
  item: WorkItem,
  view: ViewDefinition
) {
  if (view.itemLevel && item.type !== view.itemLevel) {
    return false
  }

  if (
    view.filters.itemTypes.length > 0 &&
    !view.filters.itemTypes.includes(item.type)
  ) {
    return false
  }

  if (
    !matchesOptionalFilter(
      view.filters.visibility ?? [],
      getWorkItemVisibility(item)
    )
  ) {
    return false
  }

  return matchesOptionalFilter(
    view.filters.teamIds,
    getWorkItemVisibility(item) === "team" ? item.teamId : ""
  )
}

function getAssignedDescendantContainerId(
  data: AppData,
  itemsById: Map<string, WorkItem>,
  item: WorkItem,
  view: ViewDefinition
) {
  const containerId = view.itemLevel
    ? getAncestorIdByItemLevel(itemsById, item, view.itemLevel)
    : (getAncestorIdByItemLevels(itemsById, item, view.filters.itemTypes) ??
      getRootAncestorId(itemsById, item))

  if (!containerId) {
    return null
  }

  const container = itemsById.get(containerId)

  if (
    !container ||
    !itemMatchesAssignedDescendantContainerView(container, view)
  ) {
    return null
  }

  return containerId
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

  if (
    view.entityKind === "items" &&
    !view.itemLevel &&
    view.filters.itemTypes.length === 0
  ) {
    return filteredItems.filter((item) => item.parentId === null)
  }

  return filteredItems
}

export function comparePriority(left: Priority, right: Priority) {
  return priorityMeta[right].weight - priorityMeta[left].weight
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

  if (ordering === "count") {
    return comparePriority(left.priority, right.priority)
  }

  return compareOptionalDescendingValues(left[ordering], right[ordering])
}

export function sortItems(items: WorkItem[], ordering: OrderingField) {
  return [...items].sort((left, right) =>
    compareItemsByOrdering(left, right, ordering)
  )
}

type GroupValueGetter = (data: AppData, item: WorkItem) => string

function getLabelGroupValue(data: AppData, item: WorkItem) {
  const primaryLabelId = item.labelIds[0]

  return (
    data.labels.find((label) => label.id === primaryLabelId)?.name ?? "No label"
  )
}

function getCreatorGroupValue(data: AppData, item: WorkItem) {
  return getUser(data, item.creatorId)?.name ?? "Unknown"
}

function formatParentGroupValue(parent: WorkItem) {
  return `${parent.key} · ${parent.title}`
}

function getParentGroupValue(data: AppData, item: WorkItem) {
  const parent = item.parentId ? getWorkItem(data, item.parentId) : null

  return parent ? formatParentGroupValue(parent) : "No parent"
}

const groupValueGetters: Partial<Record<GroupField, GroupValueGetter>> = {
  project: (data, item) =>
    getProject(data, item.primaryProjectId)?.name ?? "No project",
  assignee: (data, item) =>
    getUser(data, getWorkItemAssigneeIds(item)[0])?.name ?? "No assignee",
  label: getLabelGroupValue,
  team: (data, item) =>
    getWorkItemVisibility(item) === "private"
      ? "Private tasks"
      : (getTeam(data, item.teamId)?.name ?? "Unknown team"),
  parent: getParentGroupValue,
  epic: (data, item) => getAncestorGroupValue(data, item, "epic"),
  feature: (data, item) => getAncestorGroupValue(data, item, "feature"),
  type: (_data, item) => item.type,
  kind: (_data, item) => item.type,
  createdBy: getCreatorGroupValue,
  updatedBy: getCreatorGroupValue,
  status: (_data, item) => item.status,
  priority: (_data, item) => item.priority,
}

export function getGroupValue(
  data: AppData,
  item: WorkItem,
  field: GroupField | null
) {
  if (!field) {
    return "all"
  }

  return groupValueGetters[field]?.(data, item) ?? item.priority
}

function getAncestorGroupValue(
  data: AppData,
  item: WorkItem,
  field: "epic" | "feature"
) {
  let cursor: WorkItem | null = item

  while (cursor) {
    if (cursor.type === field) {
      return formatParentGroupValue(cursor)
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
  const sourceItems = getAvailableGroupSourceItems(items, options)
  const project = getAvailableGroupProject(data, options)
  const teamIds = getAvailableGroupTeamIds(sourceItems)
  addAvailableGroupTeamScopes(teamIds, options, project)
  const workspaceIds = getAvailableGroupWorkspaceIds(data, teamIds)
  addAvailableGroupWorkspaceScopes(workspaceIds, project)

  return {
    data,
    options,
    project,
    sourceItems,
    teamIds,
    workspaceIds,
  }
}

function getAvailableGroupSourceItems(
  items: WorkItem[],
  options?: {
    sourceItems?: WorkItem[]
  }
) {
  return options?.sourceItems ?? items
}

function getAvailableGroupProject(
  data: AppData,
  options?: {
    projectId?: string | null
  }
) {
  return options?.projectId ? getProject(data, options.projectId) : null
}

function getAvailableGroupTeamIds(sourceItems: WorkItem[]) {
  return new Set(
    sourceItems
      .map((item) => item.teamId)
      .filter((teamId): teamId is string => teamId !== null)
  )
}

function addAvailableGroupTeamScopes(
  teamIds: Set<string>,
  options: { teamId?: string | null } | undefined,
  project: ReturnType<typeof getAvailableGroupProject>
) {
  if (options?.teamId) {
    teamIds.add(options.teamId)
  }

  if (project?.scopeType === "team") {
    teamIds.add(project.scopeId)
  }
}

function getAvailableGroupWorkspaceIds(data: AppData, teamIds: Set<string>) {
  return new Set(
    [...teamIds]
      .map((teamId) => getTeam(data, teamId)?.workspaceId ?? null)
      .filter((workspaceId): workspaceId is string => workspaceId !== null)
  )
}

function addAvailableGroupWorkspaceScopes(
  workspaceIds: Set<string>,
  project: ReturnType<typeof getAvailableGroupProject>
) {
  if (project?.scopeType === "workspace") {
    workspaceIds.add(project.scopeId)
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
    if (isProjectAvailableGroupKey(project, context)) {
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

function addParentGroupKeys(
  keys: Set<string>,
  context: AvailableGroupKeyContext
) {
  const sourceItemIds = new Set(context.sourceItems.map((item) => item.id))
  const parentIds = new Set<string>()

  context.sourceItems.forEach((item) => {
    if (item.parentId && sourceItemIds.has(item.parentId)) {
      parentIds.add(item.parentId)
    }
  })

  const hasParentlessDisplayItem =
    context.sourceItems.length === 0 ||
    context.sourceItems.some(
      (item) => !item.parentId && !parentIds.has(item.id)
    )

  if (hasParentlessDisplayItem) {
    keys.add("No parent")
  }

  context.sourceItems.forEach((item) => {
    if (parentIds.has(item.id)) {
      keys.add(formatParentGroupValue(item))
    }
  })
}

const availableGroupKeyAppenders: Partial<
  Record<GroupField, GroupKeyAppender>
> = {
  assignee: addAssigneeGroupKeys,
  parent: addParentGroupKeys,
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

  const groupValueItems = field === "parent" ? items : context.sourceItems

  groupValueItems.forEach((item) => {
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
        compareGroupEntries(
          view.grouping,
          view.ordering,
          left,
          right,
          statusOrder
        )
      )
      .map(([groupKey, subgroups]) => [
        groupKey,
        new Map(
          [...subgroups.entries()].sort((left, right) =>
            compareSubgroupEntries(
              view.subGrouping,
              view.ordering,
              left,
              right,
              statusOrder
            )
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

  const availableGroupKeys = new Set(getSelectedGroupFilterKeys(data, view))

  if (
    (view.filters.showEmptyGroups ?? true) &&
    (!hasActiveViewFilters(view) || options?.sourceItems)
  ) {
    getAvailableGroupKeysForItems(data, items, view.grouping, options).forEach(
      (groupKey) => {
        availableGroupKeys.add(groupKey)
      }
    )
  }

  if (view.filters.showEmptyGroups ?? true) {
    availableGroupKeys.forEach((groupKey) => {
      if (!groups.has(groupKey)) {
        groups.set(groupKey, new Map())
      }
    })
  }

  return new Map(
    [...groups.entries()].sort((left, right) =>
      compareGroupEntries(
        view.grouping,
        view.ordering,
        left,
        right,
        statusOrder
      )
    )
  )
}

function getSelectedGroupFilterKeys(data: AppData, view: ViewDefinition) {
  if (view.grouping === "status") {
    return view.filters.status
  }

  if (view.grouping === "priority") {
    return view.filters.priority
  }

  if (view.grouping === "assignee") {
    return view.filters.assigneeIds.map(
      (userId) => getUser(data, userId)?.name ?? "No assignee"
    )
  }

  if (view.grouping === "project") {
    return view.filters.projectIds.map(
      (projectId) => getProject(data, projectId)?.name ?? "No project"
    )
  }

  if (view.grouping === "team") {
    return view.filters.teamIds.map(
      (teamId) => getTeam(data, teamId)?.name ?? "Unknown team"
    )
  }

  if (view.grouping === "type") {
    return view.filters.itemTypes
  }

  if (view.grouping === "label") {
    return view.filters.labelIds.map(
      (labelId) =>
        data.labels.find((label) => label.id === labelId)?.name ?? "No label"
    )
  }

  return []
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
    (view.filters.parentIds?.some(
      (value) => value !== EMPTY_PARENT_FILTER_VALUE
    ) ??
      false) ||
    view.filters.itemTypes.length > 0 ||
    view.filters.labelIds.length > 0 ||
    view.filters.teamIds.length > 0 ||
    !view.filters.showCompleted ||
    !(view.filters.showEmptyGroups ?? true)
  )
}

function getStatusOrderForItems(data: AppData, items: WorkItem[]) {
  if (items.length === 0) {
    return [...workStatuses]
  }

  const teamIds = [
    ...new Set(
      items
        .map((item) => item.teamId)
        .filter((teamId): teamId is string => teamId !== null)
    ),
  ]

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

function countGroupItems(group: Map<string, WorkItem[]>) {
  return [...group.values()].reduce((count, items) => count + items.length, 0)
}

function compareGroupEntries(
  field: GroupField | null,
  ordering: OrderingField,
  left: [string, Map<string, WorkItem[]>],
  right: [string, Map<string, WorkItem[]>],
  statusOrder: WorkStatus[]
) {
  if (ordering === "count") {
    const countComparison = countGroupItems(right[1]) - countGroupItems(left[1])

    if (countComparison !== 0) {
      return countComparison
    }
  }

  return compareGroupKeys(field, left[0], right[0], statusOrder)
}

function compareSubgroupEntries(
  field: GroupField | null,
  ordering: OrderingField,
  left: [string, WorkItem[]],
  right: [string, WorkItem[]],
  statusOrder: WorkStatus[]
) {
  if (ordering === "count") {
    const countComparison = right[1].length - left[1].length

    if (countComparison !== 0) {
      return countComparison
    }
  }

  return compareGroupKeys(field, left[0], right[0], statusOrder)
}

export function getItemAssignees(data: AppData, items: WorkItem[]) {
  const assignees = new Map<string, UserProfile>()

  for (const item of items) {
    for (const assigneeId of getWorkItemAssigneeIds(item)) {
      const user = getUser(data, assigneeId)
      if (user) {
        assignees.set(user.id, user)
      }
    }
  }

  return [...assignees.values()]
}
