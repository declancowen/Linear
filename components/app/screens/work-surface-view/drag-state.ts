import type { DragEndEvent } from "@dnd-kit/core"

import {
  getGroupValue,
  getWorkItemDescendantIds,
} from "@/lib/domain/selectors"
import {
  canParentWorkItemTypeAcceptChild,
  type AppData,
  type ViewDefinition,
  type WorkItem,
} from "@/lib/domain/types"
import type { AppStore } from "@/lib/store/app-store"

import { getPatchForField } from "../shared"

export type WorkSurfaceScope = "board" | "list"

export type RequestConfirmedWorkItemUpdate = (
  itemId: string,
  patch: Parameters<AppStore["updateWorkItem"]>[1]
) => ReturnType<AppStore["updateWorkItem"]>

function parseGroupDropTarget(id: string, scope: WorkSurfaceScope) {
  const [dropScope, groupValue, subgroupValue] = id.split("::")

  if (dropScope === `${scope}-group` && groupValue) {
    return {
      groupValue,
      subgroupValue: undefined,
    }
  }

  if (dropScope === scope && groupValue) {
    return {
      groupValue,
      subgroupValue,
    }
  }

  return null
}

function parseItemDropTarget(id: string, scope: WorkSurfaceScope) {
  const [dropScope, itemId] = id.split("::")

  if (dropScope === `${scope}-item` && itemId) {
    return { itemId }
  }

  return null
}

export function requestWorkSurfaceDragUpdate({
  data,
  editable,
  event,
  itemPool,
  requestUpdate,
  scope,
  view,
}: {
  data: AppData
  editable: boolean
  event: DragEndEvent
  itemPool: WorkItem[]
  requestUpdate: RequestConfirmedWorkItemUpdate
  scope: WorkSurfaceScope
  view: ViewDefinition
}) {
  if (!editable || !event.over) {
    return
  }

  const activeId = String(event.active.id)
  const overId = String(event.over.id)
  const activeItem = itemPool.find((entry) => entry.id === activeId) ?? null

  if (!activeItem) {
    return
  }

  if (
    requestItemTargetDragUpdate({
      data,
      itemPool,
      activeItem,
      overId,
      requestUpdate,
      scope,
      view,
    })
  ) {
    return
  }

  requestGroupTargetDragUpdate({
    data,
    itemPool,
    activeItem,
    overId,
    requestUpdate,
    scope,
    view,
  })
}

function canNestDraggedWorkItem(input: {
  activeItem: WorkItem
  data: AppData
  targetItem: WorkItem
}) {
  return (
    input.activeItem.parentId !== null &&
    canParentWorkItemTypeAcceptChild(
      input.targetItem.type,
      input.activeItem.type
    ) &&
    !getWorkItemDescendantIds(input.data, input.activeItem.id).has(
      input.targetItem.id
    )
  )
}

function getValidItemDropTarget(input: {
  activeItem: WorkItem
  itemPool: WorkItem[]
  itemTarget: ReturnType<typeof parseItemDropTarget>
}) {
  const itemTarget = input.itemTarget

  if (!itemTarget) {
    return null
  }

  const targetItem =
    input.itemPool.find((entry) => entry.id === itemTarget.itemId) ?? null

  if (
    !targetItem ||
    targetItem.id === input.activeItem.id ||
    targetItem.teamId !== input.activeItem.teamId
  ) {
    return null
  }

  return targetItem
}

function buildItemTargetDragPatch(input: {
  activeItem: WorkItem
  data: AppData
  itemPool: WorkItem[]
  targetItem: WorkItem
  view: ViewDefinition
}) {
  const patch = buildGroupedWorkItemPatch({
    data: input.data,
    items: input.itemPool,
    itemId: input.activeItem.id,
    view: input.view,
    groupValue: getGroupValue(input.data, input.targetItem, input.view.grouping),
    subgroupValue: input.view.subGrouping
      ? getGroupValue(input.data, input.targetItem, input.view.subGrouping)
      : undefined,
  })
  const canNestOnTarget = canNestDraggedWorkItem({
    activeItem: input.activeItem,
    data: input.data,
    targetItem: input.targetItem,
  })

  return {
    ...patch,
    parentId: canNestOnTarget ? input.targetItem.id : null,
  }
}

function requestItemTargetDragUpdate({
  data,
  itemPool,
  activeItem,
  overId,
  requestUpdate,
  scope,
  view,
}: {
  data: AppData
  itemPool: WorkItem[]
  activeItem: WorkItem
  overId: string
  requestUpdate: RequestConfirmedWorkItemUpdate
  scope: WorkSurfaceScope
  view: ViewDefinition
}) {
  const itemTarget = parseItemDropTarget(overId, scope)

  if (!itemTarget) {
    return false
  }

  const targetItem = getValidItemDropTarget({
    activeItem,
    itemPool,
    itemTarget,
  })

  if (!targetItem) {
    return true
  }

  requestUpdate(
    activeItem.id,
    buildItemTargetDragPatch({
      activeItem,
      data,
      itemPool,
      targetItem,
      view,
    })
  )

  return true
}

function requestGroupTargetDragUpdate({
  data,
  itemPool,
  activeItem,
  overId,
  requestUpdate,
  scope,
  view,
}: {
  data: AppData
  itemPool: WorkItem[]
  activeItem: WorkItem
  overId: string
  requestUpdate: RequestConfirmedWorkItemUpdate
  scope: WorkSurfaceScope
  view: ViewDefinition
}) {
  const target = parseGroupDropTarget(overId, scope)

  if (!target) {
    return
  }

  requestUpdate(activeItem.id, {
    ...buildGroupedWorkItemPatch({
      data,
      items: itemPool,
      itemId: activeItem.id,
      view,
      groupValue: target.groupValue,
      subgroupValue: target.subgroupValue,
    }),
    parentId: null,
  })
}

function buildGroupedWorkItemPatch({
  data,
  items,
  itemId,
  view,
  groupValue,
  subgroupValue,
}: {
  data: AppData
  items: WorkItem[]
  itemId: string
  view: Pick<ViewDefinition, "grouping" | "subGrouping">
  groupValue: string
  subgroupValue?: string
}) {
  const item = items.find((entry) => entry.id === itemId) ?? null

  return {
    ...getPatchForField(data, item, view.grouping, groupValue),
    ...(subgroupValue === undefined
      ? {}
      : getPatchForField(data, item, view.subGrouping, subgroupValue)),
  }
}
