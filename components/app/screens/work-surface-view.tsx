"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { CSS } from "@dnd-kit/utilities"
import {
  closestCorners,
  pointerWithin,
  DndContext,
  DragOverlay,
  PointerSensor,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  CaretDown,
  CaretRight,
  Plus,
  TreeStructure,
} from "@phosphor-icons/react"

import {
  buildItemGroupsWithEmptyGroups,
  getDirectChildWorkItemsForDisplay,
  getGroupValue,
  getTeam,
  getUser,
  getWorkItemDescendantIds,
  getWorkItemChildProgress,
} from "@/lib/domain/selectors"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { getCalendarDateDayOffset } from "@/lib/date-input"
import {
  canParentWorkItemTypeAcceptChild,
  getDisplayLabelForWorkItemType,
  getDisplayPluralLabelForWorkItemType,
  type AppData,
  type DisplayProperty,
  type ViewDefinition,
  type WorkItem,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { StatusRing } from "@/components/ui/template-primitives"

import {
  IssueActionMenu,
  IssueContextMenu,
  stopMenuEvent,
  stopDragPropagation,
} from "./work-item-menus"
import { WorkItemAssigneeAvatar, WorkItemTypeBadge } from "./work-item-ui"
import { getPatchForField, LabelColorDot } from "./shared"
import { InlineWorkItemPropertyControl } from "./work-item-inline-property-control"
import { getContainerItemsForDisplay } from "./helpers"
import {
  getGroupAccentVar,
  getGroupValueAdornment,
  getGroupValueLabel,
} from "./work-surface-view/shared"
import {
  formatWorkSurfaceDueDate,
  formatWorkSurfaceTimestamp,
} from "./date-presentation"
export { TimelineView } from "./work-surface-view/timeline-view"
import { cn } from "@/lib/utils"

const DRAG_START_DISTANCE_PX = 6
const META_CHIP_CLASS =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2 text-[11px] text-fg-2"
const META_TEXT_CLASS = "shrink-0 text-[11.5px] text-fg-3 tabular-nums"

function useHoldToDragSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_START_DISTANCE_PX,
      },
    })
  )
}

type DraggableBindings = Pick<
  ReturnType<typeof useDraggable>,
  "attributes" | "listeners"
>

type ChildDisplayMode = "direct" | "assigned-descendants"

function CollapseCaret({
  open,
  className,
}: {
  open: boolean
  className?: string
}) {
  return open ? (
    <CaretDown className={className} weight="fill" />
  ) : (
    <CaretRight className={className} weight="fill" />
  )
}

function parseGroupDropTarget(id: string, scope: "board" | "list") {
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

function parseItemDropTarget(id: string, scope: "board" | "list") {
  const [dropScope, itemId] = id.split("::")

  if (dropScope === `${scope}-item` && itemId) {
    return { itemId }
  }

  return null
}

function prioritizeItemDropTargets(
  collisions: Collision[],
  scope: "board" | "list"
) {
  const itemPrefix = `${scope}-item::`
  const itemCollisions = collisions.filter((collision) =>
    String(collision.id).startsWith(itemPrefix)
  )

  return itemCollisions.length > 0 ? itemCollisions : collisions
}

function createWorkSurfaceCollisionDetection(
  scope: "board" | "list"
): CollisionDetection {
  return (args) => {
    const pointerCollisions = pointerWithin(args)

    if (pointerCollisions.length > 0) {
      return prioritizeItemDropTargets(pointerCollisions, scope)
    }

    return prioritizeItemDropTargets(closestCorners(args), scope)
  }
}

const boardCollisionDetection = createWorkSurfaceCollisionDetection("board")
const listCollisionDetection = createWorkSurfaceCollisionDetection("list")

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

function buildCreateDefaultsForGroup({
  data,
  items,
  view,
  groupValue,
  subgroupValue,
}: {
  data: AppData
  items: WorkItem[]
  view: Pick<ViewDefinition, "grouping" | "subGrouping">
  groupValue: string
  subgroupValue?: string
}) {
  const baseItem = items[0] ?? null
  const groupedPatch = {
    ...getPatchForField(data, baseItem, view.grouping, groupValue),
    ...(subgroupValue === undefined
      ? {}
      : getPatchForField(data, baseItem, view.subGrouping, subgroupValue)),
  }

  return {
    status: groupedPatch.status,
    priority: groupedPatch.priority,
    assigneeId: groupedPatch.assigneeId,
    primaryProjectId: groupedPatch.primaryProjectId,
    labelIds: groupedPatch.labelIds,
    parentId: null,
  }
}

function GroupPill({
  label,
  accentVar,
  adornment,
}: {
  label: string
  accentVar?: string | null
  adornment: ReactNode
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-foreground">
      {accentVar ? (
        <span
          aria-hidden
          className="inline-block h-3.5 w-[3px] rounded-full"
          style={{ background: accentVar }}
        />
      ) : null}
      {adornment}
      <span className="truncate">{label}</span>
    </span>
  )
}

type ChildProgressRollup = ReturnType<typeof getWorkItemChildProgress>

function getChildProgressRollup(
  data: AppData,
  item: WorkItem
): ChildProgressRollup | null {
  const progress = getWorkItemChildProgress(data, item.id)
  return progress.totalChildren > 0 ? progress : null
}

function WorkItemProgressProperty({
  progress,
  variant,
  className,
}: {
  progress: ChildProgressRollup | null
  variant: "list" | "board"
  className?: string
}) {
  if (!progress) {
    return null
  }

  return (
    <span
      className={cn(
        variant === "list"
          ? "inline-flex shrink-0 items-center gap-2"
          : "inline-flex min-w-[140px] flex-1 basis-full items-center gap-2",
        className
      )}
      aria-label={`Child progress ${progress.percent}%`}
    >
      <span
        aria-hidden
        className={cn(
          "h-1 overflow-hidden rounded-full bg-surface-3",
          variant === "list" ? "w-[52px]" : "min-w-0 flex-1"
        )}
      >
        <span
          className="block h-full rounded-full bg-status-done transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </span>
      <span className="w-9 text-right text-[11.5px] text-fg-3 tabular-nums">
        {progress.percent}%
      </span>
    </span>
  )
}

function WorkItemChildCount({
  count,
  className,
}: {
  count: number
  className?: string
}) {
  if (count <= 0) {
    return null
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11.5px] text-fg-4 tabular-nums",
        className
      )}
    >
      <TreeStructure className="size-3" />
      {count}
    </span>
  )
}

function getDisplayedChildCountLabel(
  data: AppData,
  parentItem: WorkItem,
  childItems: WorkItem[]
) {
  if (childItems.length === 0) {
    return null
  }

  const team = getTeam(data, parentItem.teamId)
  const childTypes = [...new Set(childItems.map((child) => child.type))]

  if (childTypes.length !== 1) {
    return `${childItems.length} ${childItems.length === 1 ? "item" : "items"}`
  }

  const [childType] = childTypes
  const label =
    childItems.length === 1
      ? getDisplayLabelForWorkItemType(childType, team?.settings.experience)
      : getDisplayPluralLabelForWorkItemType(
          childType,
          team?.settings.experience
        )

  return `${childItems.length} ${label.toLowerCase()}`
}

function getDisplayedChildCountOverride(
  childItems: WorkItem[],
  childDisplayMode: ChildDisplayMode
) {
  if (childDisplayMode === "assigned-descendants") {
    return childItems.length
  }

  return childItems.length > 0 ? childItems.length : undefined
}

function renderWorkItemDisplayProperty({
  data,
  item,
  property,
  variant,
  childProgress,
  dueDateLabel,
  isOverdue,
  isSoon,
}: {
  data: AppData
  item: WorkItem
  property: DisplayProperty
  variant: "list" | "board"
  childProgress: ChildProgressRollup | null
  dueDateLabel: string | null
  isOverdue: boolean
  isSoon: boolean
}) {
  if (property === "id") {
    return (
      <span className="shrink-0 font-mono text-[11.5px] tracking-[0.01em] text-fg-3">
        {item.key}
      </span>
    )
  }

  if (property === "status") {
    return (
      <InlineWorkItemPropertyControl
        data={data}
        item={item}
        property="status"
        variant="surface"
      />
    )
  }

  if (property === "type") {
    return (
      <WorkItemTypeBadge
        data={data}
        item={item}
        className="h-5 px-2 text-[11px] text-fg-2"
      />
    )
  }

  if (property === "priority") {
    return (
      <InlineWorkItemPropertyControl
        data={data}
        item={item}
        property="priority"
        variant="surface"
      />
    )
  }

  if (property === "progress") {
    return (
      <WorkItemProgressProperty progress={childProgress} variant={variant} />
    )
  }

  if (property === "project") {
    return (
      <InlineWorkItemPropertyControl
        data={data}
        item={item}
        property="project"
        variant="surface"
      />
    )
  }

  if (property === "milestone") {
    const milestone = data.milestones.find(
      (entry) => entry.id === item.milestoneId
    )

    if (!milestone) {
      return null
    }

    return <span className={META_CHIP_CLASS}>{milestone.name}</span>
  }

  if (property === "labels") {
    if (item.labelIds.length === 0) {
      return null
    }

    return item.labelIds
      .slice(0, variant === "board" ? 3 : 2)
      .map((labelId) => {
        const label = data.labels.find((entry) => entry.id === labelId)

        if (!label) {
          return null
        }

        return (
          <span key={labelId} className={META_CHIP_CLASS}>
            <LabelColorDot color={label.color} className="size-[7px]" />
            {label.name}
          </span>
        )
      })
      .filter(Boolean)
  }

  if (property === "dueDate") {
    if (!dueDateLabel) {
      return null
    }

    return (
      <span
        className={cn(
          META_TEXT_CLASS,
          isOverdue && "text-[color:var(--priority-urgent)]",
          !isOverdue && isSoon && "text-[color:var(--priority-high)]"
        )}
      >
        {dueDateLabel}
      </span>
    )
  }

  if (property === "created") {
    const createdAt = formatWorkSurfaceTimestamp(item.createdAt, "Created")

    return createdAt ? (
      <span className={META_TEXT_CLASS}>{createdAt}</span>
    ) : null
  }

  if (property === "updated") {
    const updatedAt = formatWorkSurfaceTimestamp(item.updatedAt, "Updated")

    return updatedAt ? (
      <span className={META_TEXT_CLASS}>{updatedAt}</span>
    ) : null
  }

  if (property === "assignee") {
    return (
      <InlineWorkItemPropertyControl
        data={data}
        item={item}
        property="assignee"
        variant="surface"
      />
    )
  }

  return null
}

function renderWorkItemDisplayProperties({
  data,
  item,
  displayProps,
  variant,
  childProgress,
  dueDateLabel,
  isOverdue,
  isSoon,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  variant: "list" | "board"
  childProgress: ChildProgressRollup | null
  dueDateLabel: string | null
  isOverdue: boolean
  isSoon: boolean
}) {
  return Array.from(new Set(displayProps)).flatMap((property) => {
    const rendered = renderWorkItemDisplayProperty({
      data,
      item,
      property,
      variant,
      childProgress,
      dueDateLabel,
      isOverdue,
      isSoon,
    })

    if (!rendered) {
      return []
    }

    return Array.isArray(rendered)
      ? rendered.map((entry, index) => ({
          key: `${property}-${index}`,
          node: entry,
        }))
      : [{ key: property, node: rendered }]
  })
}

export function BoardView({
  data,
  items,
  scopedItems,
  view,
  editable,
  childDisplayMode = "direct",
}: {
  data: AppData
  items: WorkItem[]
  scopedItems?: WorkItem[]
  view: ViewDefinition
  editable: boolean
  childDisplayMode?: ChildDisplayMode
}) {
  const groups = [
    ...buildItemGroupsWithEmptyGroups(data, items, view).entries(),
  ]
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [activeDragPreviewKind, setActiveDragPreviewKind] = useState<
    "card" | "child" | null
  >(null)
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set())
  const sensors = useHoldToDragSensors()
  const itemPool = scopedItems ?? data.workItems
  const hiddenGroups = groups.filter(([groupName]) =>
    view.hiddenState.groups.includes(groupName)
  )
  const visibleGroups = groups.filter(
    ([groupName]) => !view.hiddenState.groups.includes(groupName)
  )
  const showChildItems = Boolean(view.showChildItems)

  function toggleExpandedItem(itemId: string) {
    setExpandedItemIds((current) => {
      const next = new Set(current)

      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }

      return next
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id))
    setActiveDragPreviewKind(
      event.active.data.current?.previewKind === "child" ? "child" : "card"
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null)
    setActiveDragPreviewKind(null)

    if (!editable || !event.over) {
      return
    }

    const activeId = String(event.active.id)
    const overId = String(event.over.id)
    const activeItem = itemPool.find((entry) => entry.id === activeId) ?? null

    if (!activeItem) {
      return
    }

    const itemTarget = parseItemDropTarget(overId, "board")

    if (itemTarget) {
      const targetItem =
        itemPool.find((entry) => entry.id === itemTarget.itemId) ?? null

      if (
        !targetItem ||
        targetItem.id === activeItem.id ||
        targetItem.teamId !== activeItem.teamId
      ) {
        return
      }

      const patch = buildGroupedWorkItemPatch({
        data,
        items: itemPool,
        itemId: activeItem.id,
        view,
        groupValue: getGroupValue(data, targetItem, view.grouping),
        subgroupValue: view.subGrouping
          ? getGroupValue(data, targetItem, view.subGrouping)
          : undefined,
      })
      const canNestOnTarget =
        activeItem.parentId !== null &&
        canParentWorkItemTypeAcceptChild(targetItem.type, activeItem.type) &&
        !getWorkItemDescendantIds(data, activeItem.id).has(targetItem.id)

      useAppStore.getState().updateWorkItem(activeItem.id, {
        ...patch,
        parentId: canNestOnTarget ? targetItem.id : null,
      })
      return
    }

    const target = parseGroupDropTarget(overId, "board")

    if (!target) {
      return
    }

    const patch = buildGroupedWorkItemPatch({
      data,
      items: itemPool,
      itemId: activeItem.id,
      view,
      groupValue: target.groupValue,
      subgroupValue: target.subgroupValue,
    })

    useAppStore.getState().updateWorkItem(activeItem.id, {
      ...patch,
      parentId: null,
    })
  }

  function openCreateForGroup({
    groupValue,
    subgroupValue,
    laneItems,
  }: {
    groupValue: string
    subgroupValue?: string
    laneItems: WorkItem[]
  }) {
    const defaultValues = buildCreateDefaultsForGroup({
      data,
      items: laneItems,
      view,
      groupValue,
      subgroupValue,
    })

    openManagedCreateDialog({
      kind: "workItem",
      defaultTeamId:
        laneItems[0]?.teamId ?? items[0]?.teamId ?? scopedItems?.[0]?.teamId ?? null,
      defaultProjectId: defaultValues.primaryProjectId ?? null,
      defaultValues,
    })
  }

  const activeItem = itemPool.find((item) => item.id === activeItemId) ?? null

  return (
    <DndContext
      collisionDetection={boardCollisionDetection}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragCancel={() => {
        setActiveItemId(null)
        setActiveDragPreviewKind(null)
      }}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="h-full w-full">
        <div className="flex h-full min-w-max items-stretch gap-3 px-4 pt-3.5 pb-8">
          {visibleGroups.map(([groupName, subgroups]) => {
            const groupItems = Array.from(subgroups.values()).flat()
            const groupCount = groupItems.length
            const groupLabel = getGroupValueLabel(view.grouping, groupName)
            const groupAccentVar = getGroupAccentVar(view.grouping, groupName)

            return (
              <div
                key={groupName}
                className="flex w-[296px] shrink-0 flex-col rounded-xl border border-line-soft bg-bg-sunken"
              >
                <BoardGroupHeader
                  id={`board-group::${groupName}`}
                  accentVar={groupAccentVar}
                  groupLabel={groupLabel}
                  groupCount={groupCount}
                />
                <div
                  aria-hidden
                  className="mx-3 h-0.5 rounded-full opacity-60"
                  style={{
                    background: groupAccentVar ?? "var(--text-3)",
                  }}
                />
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2">
                  {Array.from(subgroups.entries()).map(
                    ([subgroupName, subItems]) => {
                      const hidden =
                        view.hiddenState.subgroups.includes(subgroupName)
                      if (hidden) return null

                      return (
                        <div key={`${groupName}-${subgroupName}`}>
                          {view.subGrouping ? (
                            <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                              {getGroupValueLabel(
                                view.subGrouping,
                                subgroupName
                              )}
                            </div>
                          ) : null}
                          <BoardDropLane
                            id={`board::${groupName}::${subgroupName}`}
                          >
                            {getContainerItemsForDisplay(
                              subItems,
                              items,
                              showChildItems
                            ).map((item) => {
                              const childItems = showChildItems
                                ? getDirectChildWorkItemsForDisplay(
                                    data,
                                    item,
                                    view.ordering,
                                    view,
                                    scopedItems,
                                    {
                                      mode: childDisplayMode,
                                    }
                                  )
                                : []

                              return (
                                <DraggableWorkCard
                                  key={item.id}
                                  item={item}
                                  data={data}
                                  displayProps={view.displayProps}
                                  childCountOverride={getDisplayedChildCountOverride(
                                    childItems,
                                    childDisplayMode
                                  )}
                                  details={
                                    showChildItems ? (
                                      <WorkItemChildDisclosure
                                        data={data}
                                        item={item}
                                        childItems={childItems}
                                        editable={editable}
                                        expanded={expandedItemIds.has(item.id)}
                                        onToggle={() =>
                                          toggleExpandedItem(item.id)
                                        }
                                      />
                                    ) : null
                                  }
                                />
                              )
                            })}
                            {editable ? (
                              <button
                                type="button"
                                className="flex items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-[12px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
                                onClick={() =>
                                  openCreateForGroup({
                                    groupValue: groupName,
                                    subgroupValue: subgroupName,
                                    laneItems: subItems,
                                  })
                                }
                              >
                                <Plus className="size-3.5" />
                                <span>Add item</span>
                              </button>
                            ) : null}
                          </BoardDropLane>
                        </div>
                      )
                    }
                  )}
                  {subgroups.size === 0 ? (
                    editable ? (
                      <BoardDropLane
                        id={`board::${groupName}`}
                        className="min-h-24 flex-1"
                      >
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-[12px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
                          onClick={() =>
                            openCreateForGroup({
                              groupValue: groupName,
                              laneItems: groupItems,
                            })
                          }
                        >
                          <Plus className="size-3.5" />
                          <span>Add item</span>
                        </button>
                      </BoardDropLane>
                    ) : (
                      <div className="rounded-[6px] border-[1.5px] border-dashed border-line px-3 py-3.5 text-center text-[12px] text-fg-4">
                        No items
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {hiddenGroups.length > 0 ? (
        <div className="border-t border-line-soft px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Hidden columns
            </span>
            {hiddenGroups.map(([groupName]) => (
              <button
                key={groupName}
                className="rounded-md border border-line px-2 py-0.5 text-xs hover:bg-surface-3"
                onClick={() =>
                  useAppStore
                    .getState()
                    .toggleViewHiddenValue(view.id, "groups", groupName)
                }
              >
                {getGroupValueLabel(view.grouping, groupName)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <DragOverlay>
        {activeItem ? (
          activeDragPreviewKind === "child" ? (
            <div className="w-[280px] rounded-md border border-line bg-surface shadow-sm">
              <BoardChildItemRow
                item={activeItem}
                assignee={
                  activeItem.assigneeId
                    ? getUser(data, activeItem.assigneeId)
                    : null
                }
                interactive={false}
              />
            </div>
          ) : (
            <div className="w-[280px]">
              <BoardCardBody
                data={data}
                item={activeItem}
                displayProps={view.displayProps}
              />
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export function ListView({
  data,
  items,
  scopedItems,
  view,
  editable,
  childDisplayMode = "direct",
}: {
  data: AppData
  items: WorkItem[]
  scopedItems?: WorkItem[]
  view: ViewDefinition
  editable: boolean
  childDisplayMode?: ChildDisplayMode
}) {
  const groups = [
    ...buildItemGroupsWithEmptyGroups(data, items, view).entries(),
  ]
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set())
  const sensors = useHoldToDragSensors()
  const itemPool = scopedItems ?? data.workItems
  const showChildItems = Boolean(view.showChildItems)

  function toggleGroup(groupName: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id))
  }

  function toggleExpandedItem(itemId: string) {
    setExpandedItemIds((current) => {
      const next = new Set(current)

      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }

      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null)

    if (!editable || !event.over) {
      return
    }

    const activeId = String(event.active.id)
    const overId = String(event.over.id)
    const activeItem = itemPool.find((entry) => entry.id === activeId) ?? null

    if (!activeItem) {
      return
    }

    const itemTarget = parseItemDropTarget(overId, "list")

    if (itemTarget) {
      const targetItem =
        itemPool.find((entry) => entry.id === itemTarget.itemId) ?? null

      if (
        !targetItem ||
        targetItem.id === activeItem.id ||
        targetItem.teamId !== activeItem.teamId
      ) {
        return
      }

      const patch = buildGroupedWorkItemPatch({
        data,
        items: itemPool,
        itemId: activeItem.id,
        view,
        groupValue: getGroupValue(data, targetItem, view.grouping),
        subgroupValue: view.subGrouping
          ? getGroupValue(data, targetItem, view.subGrouping)
          : undefined,
      })
      const canNestOnTarget =
        activeItem.parentId !== null &&
        canParentWorkItemTypeAcceptChild(targetItem.type, activeItem.type) &&
        !getWorkItemDescendantIds(data, activeItem.id).has(targetItem.id)

      useAppStore.getState().updateWorkItem(activeItem.id, {
        ...patch,
        parentId: canNestOnTarget ? targetItem.id : null,
      })
      return
    }

    const target = parseGroupDropTarget(overId, "list")

    if (!target) {
      return
    }

    const patch = buildGroupedWorkItemPatch({
      data,
      items: itemPool,
      itemId: activeItem.id,
      view,
      groupValue: target.groupValue,
      subgroupValue: target.subgroupValue,
    })

    useAppStore.getState().updateWorkItem(activeItem.id, {
      ...patch,
      parentId: null,
    })
  }

  function openCreateForGroup({
    groupValue,
    subgroupValue,
    laneItems,
  }: {
    groupValue: string
    subgroupValue?: string
    laneItems: WorkItem[]
  }) {
    const defaultValues = buildCreateDefaultsForGroup({
      data,
      items: laneItems,
      view,
      groupValue,
      subgroupValue,
    })

    openManagedCreateDialog({
      kind: "workItem",
      defaultTeamId:
        laneItems[0]?.teamId ?? items[0]?.teamId ?? scopedItems?.[0]?.teamId ?? null,
      defaultProjectId: defaultValues.primaryProjectId ?? null,
      defaultValues,
    })
  }

  const activeItem = itemPool.find((item) => item.id === activeItemId) ?? null

  return (
    <DndContext
      collisionDetection={listCollisionDetection}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveItemId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col pb-10">
        {groups.map(([groupName, subgroups]) => {
          if (view.hiddenState.groups.includes(groupName)) {
            return null
          }

          const groupItems = Array.from(subgroups.values()).flat()
          const groupCount = groupItems.length
          const isExpandable = groupCount > 0
          const isCollapsed = collapsedGroups.has(groupName)
          const groupLabel = getGroupValueLabel(view.grouping, groupName)
          const groupAdornment = getGroupValueAdornment(
            view.grouping,
            groupName
          )
          const groupAccentVar = getGroupAccentVar(view.grouping, groupName)

          return (
            <div key={groupName}>
              <ListGroupHeader
                id={`list-group::${groupName}`}
                accentVar={groupAccentVar}
                groupAdornment={groupAdornment}
                groupCount={groupCount}
                groupLabel={groupLabel}
                isCollapsed={isCollapsed}
                isExpandable={isExpandable}
                onClick={() => {
                  if (!isExpandable) {
                    return
                  }

                  toggleGroup(groupName)
                }}
              />

              {isExpandable && !isCollapsed ? (
                <div className="flex flex-col">
                  {Array.from(subgroups.entries()).map(
                    ([subgroupName, subItems]) => {
                      if (view.hiddenState.subgroups.includes(subgroupName)) {
                        return null
                      }

                      return (
                        <div key={`${groupName}-${subgroupName}`}>
                          {view.subGrouping ? (
                            <div className="px-11 py-1.5 text-[11px] font-medium tracking-[0.04em] text-fg-3 uppercase">
                              {getGroupValueLabel(
                                view.subGrouping,
                                subgroupName
                              )}
                            </div>
                          ) : null}
                          <ListDropLane
                            id={`list::${groupName}::${subgroupName}`}
                          >
                            {getContainerItemsForDisplay(
                              subItems,
                              items,
                              showChildItems
                            ).flatMap((item) => {
                              const children = showChildItems
                                ? getDirectChildWorkItemsForDisplay(
                                    data,
                                    item,
                                    view.ordering,
                                    view,
                                    scopedItems,
                                    {
                                      mode: childDisplayMode,
                                    }
                                  )
                                : []
                              const hasChildren = children.length > 0
                              const isExpanded = expandedItemIds.has(item.id)
                              const parentRow = editable ? (
                                <DraggableListRow
                                  key={item.id}
                                  data={data}
                                  item={item}
                                  displayProps={view.displayProps}
                                  depth={0}
                                  hasChildren={hasChildren}
                                  childCountOverride={getDisplayedChildCountOverride(
                                    children,
                                    childDisplayMode
                                  )}
                                  expanded={isExpanded}
                                  onToggleExpanded={() =>
                                    toggleExpandedItem(item.id)
                                  }
                                />
                              ) : (
                                <ListRow
                                  key={item.id}
                                  data={data}
                                  item={item}
                                  displayProps={view.displayProps}
                                  depth={0}
                                  hasChildren={hasChildren}
                                  childCountOverride={getDisplayedChildCountOverride(
                                    children,
                                    childDisplayMode
                                  )}
                                  expanded={isExpanded}
                                  onToggleExpanded={() =>
                                    toggleExpandedItem(item.id)
                                  }
                                />
                              )

                              if (!isExpanded || !hasChildren) {
                                return [parentRow]
                              }

                              return [
                                parentRow,
                                ...children.map((child) => (
                                  editable ? (
                                    <DraggableListRow
                                      key={child.id}
                                      data={data}
                                      item={child}
                                      displayProps={view.displayProps}
                                      depth={1}
                                    />
                                  ) : (
                                    <ListRow
                                      key={child.id}
                                      data={data}
                                      item={child}
                                      displayProps={view.displayProps}
                                      depth={1}
                                    />
                                  )
                                )),
                              ]
                            })}
                            {editable ? (
                              <button
                                type="button"
                                className="ml-[38px] flex items-center gap-2 px-2.5 py-2 text-[12px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
                                onClick={() =>
                                  openCreateForGroup({
                                    groupValue: groupName,
                                    subgroupValue: subgroupName,
                                    laneItems: subItems,
                                  })
                                }
                              >
                                <Plus className="size-3.5" />
                                <span>Add item</span>
                              </button>
                            ) : null}
                          </ListDropLane>
                        </div>
                      )
                    }
                  )}
                  {subgroups.size === 0 ? (
                    editable ? (
                      <ListDropLane
                        id={`list::${groupName}`}
                        className="min-h-10"
                      >
                        <button
                          type="button"
                          className="ml-[38px] flex items-center gap-2 px-2.5 py-2 text-[12px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
                          onClick={() =>
                            openCreateForGroup({
                              groupValue: groupName,
                              laneItems: groupItems,
                            })
                          }
                        >
                          <Plus className="size-3.5" />
                          <span>Add item</span>
                        </button>
                      </ListDropLane>
                    ) : (
                      <div className="px-11 py-3 text-xs text-muted-foreground">
                        No items
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}

        {view.hiddenState.groups.length > 0 ? (
          <div className="border-t border-line-soft px-4 py-3">
            <div className="mb-2 text-xs text-muted-foreground">
              Hidden rows
            </div>
            {view.hiddenState.groups.map((groupName) => (
              <button
                key={groupName}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-3"
                onClick={() =>
                  useAppStore
                    .getState()
                    .toggleViewHiddenValue(view.id, "groups", groupName)
                }
              >
                {getGroupValueAdornment(view.grouping, groupName)}
                <span>{getGroupValueLabel(view.grouping, groupName)}</span>
                <span className="ml-auto text-xs text-muted-foreground">0</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="w-full max-w-4xl rounded-md border border-line bg-surface shadow-sm">
            <ListRowBody
              data={data}
              item={activeItem}
              displayProps={view.displayProps}
              depth={0}
              interactive={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function ListGroupHeader({
  id,
  accentVar,
  groupAdornment,
  groupCount,
  groupLabel,
  isCollapsed,
  isExpandable,
  onClick,
}: {
  id: string
  accentVar?: string | null
  groupAdornment: ReactNode
  groupCount: number
  groupLabel: string
  isCollapsed: boolean
  isExpandable: boolean
  onClick: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className="sticky top-0 z-[2] bg-transparent"
    >
      <button
        type="button"
        aria-disabled={!isExpandable}
        className={cn(
          "flex w-full items-center gap-2.5 px-5 pt-2 pb-1.5 pl-3.5 text-left",
          isExpandable ? "group/grp" : "cursor-default"
        )}
        onClick={onClick}
      >
        <span className="grid size-5 shrink-0 place-items-center text-fg-3">
          {isExpandable ? (
            <CollapseCaret open={!isCollapsed} className="size-3" />
          ) : (
            <span aria-hidden className="size-3" />
          )}
        </span>
        <div
          className={cn(
            "flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-[min(var(--radius-md),12px)] border border-line bg-surface px-3.5 shadow-[0_1px_0_0_oklch(0.18_0_0/0.03)] transition-colors",
            isOver
              ? "border-fg-4 bg-surface-2"
              : isExpandable
                ? "group-hover/grp:bg-surface-3"
                : null
          )}
        >
          <GroupPill
            label={groupLabel}
            accentVar={accentVar}
            adornment={groupAdornment}
          />
          <span className="text-[12px] text-fg-3 tabular-nums">
            {groupCount}
          </span>
        </div>
      </button>
    </div>
  )
}

function ListDropLane({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children?: ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col transition-colors",
        className,
        isOver && "bg-surface-2"
      )}
    >
      {children}
    </div>
  )
}

function ListRowBody({
  data,
  item,
  displayProps,
  depth,
  childCountOverride,
  interactive = true,
  hasChildren = false,
  expanded = false,
  onToggleExpanded,
  isDropTarget = false,
  dragAttributes,
  dragListeners,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  depth: number
  childCountOverride?: number
  interactive?: boolean
  hasChildren?: boolean
  expanded?: boolean
  onToggleExpanded?: () => void
  isDropTarget?: boolean
  dragAttributes?: DraggableBindings["attributes"]
  dragListeners?: DraggableBindings["listeners"]
}) {
  const dueDateLabel =
    displayProps.includes("dueDate") && item.dueDate
      ? formatWorkSurfaceDueDate(item.dueDate)
      : null
  const daysUntilDue = dueDateLabel
    ? getCalendarDateDayOffset(item.dueDate)
    : null
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0
  const isSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 5
  const childProgress = getChildProgressRollup(data, item)
  const subCount = childCountOverride ?? childProgress?.totalChildren ?? 0
  const idProperty = renderWorkItemDisplayProperty({
    data,
    item,
    property: "id",
    variant: "list",
    childProgress,
    dueDateLabel,
    isOverdue,
    isSoon,
  })
  const visibleProperties = renderWorkItemDisplayProperties({
    data,
    item,
    displayProps: displayProps.filter((property) => property !== "id"),
    variant: "list",
    childProgress,
    dueDateLabel,
    isOverdue,
    isSoon,
  })
  const disclosureSlotClass = depth === 0 ? "size-5" : "size-4"

  const linkedContent = (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden px-2.5">
      {idProperty}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <div className="truncate text-[13px] text-foreground">{item.title}</div>
        <WorkItemChildCount count={subCount} />
      </div>
    </div>
  )

  const body = (
    <div
      className={cn(
        "group/row relative transition-colors hover:bg-surface-2",
        isDropTarget && "bg-surface-2"
      )}
      {...dragAttributes}
      {...dragListeners}
    >
      <div
        className="flex min-h-[34px] items-center gap-2.5 pr-5"
        style={{ paddingLeft: 14 + depth * 24 }}
      >
        <div className="flex items-center justify-center">
          <span aria-hidden className="size-4" />
        </div>
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? "Collapse sub-issues" : "Expand sub-issues"}
            aria-expanded={expanded}
            className={cn(
              "inline-grid place-items-center rounded-sm text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
              disclosureSlotClass
            )}
            onPointerDown={stopDragPropagation}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onToggleExpanded?.()
            }}
          >
            <CollapseCaret open={expanded} className="size-3" />
          </button>
        ) : (
          <span aria-hidden className={disclosureSlotClass} />
        )}
        {interactive ? (
          <Link
            href={`/items/${item.id}`}
            className="flex min-w-0 flex-1 items-center overflow-hidden"
          >
            {linkedContent}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center overflow-hidden">
            {linkedContent}
          </div>
        )}
        {visibleProperties.length > 0 ? (
          <div className="flex shrink-0 items-center gap-1.5 overflow-hidden pr-10">
            {visibleProperties.map(({ key, node }) => (
              <span key={key} className="contents">
                {node}
              </span>
            ))}
          </div>
        ) : interactive ? (
          <div className="pr-10" />
        ) : null}
        {interactive ? (
          <div className="absolute top-1/2 right-3.5 -translate-y-1/2 opacity-0 transition-opacity group-hover/row:opacity-100">
            <IssueActionMenu
              data={data}
              item={item}
              triggerClassName="rounded-md border border-line bg-surface px-1.5 py-0.5 shadow-sm hover:bg-surface-3"
            />
          </div>
        ) : null}
      </div>
    </div>
  )

  return interactive ? (
    <IssueContextMenu data={data} item={item}>
      {body}
    </IssueContextMenu>
  ) : (
    body
  )
}

function ListRow({
  data,
  item,
  displayProps,
  depth,
  childCountOverride,
  hasChildren,
  expanded,
  onToggleExpanded,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  depth: number
  childCountOverride?: number
  hasChildren?: boolean
  expanded?: boolean
  onToggleExpanded?: () => void
}) {
  return (
    <ListRowBody
      data={data}
      item={item}
      displayProps={displayProps}
      depth={depth}
      childCountOverride={childCountOverride}
      hasChildren={hasChildren}
      expanded={expanded}
      onToggleExpanded={onToggleExpanded}
    />
  )
}

function DraggableListRow({
  data,
  item,
  displayProps,
  depth,
  childCountOverride,
  hasChildren,
  expanded,
  onToggleExpanded,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  depth: number
  childCountOverride?: number
  hasChildren?: boolean
  expanded?: boolean
  onToggleExpanded?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } =
    useDraggable({
      id: item.id,
    })
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({
    id: `list-item::${item.id}`,
  })

  function setNodeRef(node: HTMLDivElement | null) {
    setDraggableNodeRef(node)
    setDroppableNodeRef(node)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging ? "opacity-60" : "opacity-100")}
    >
      <ListRowBody
        data={data}
        item={item}
        displayProps={displayProps}
        depth={depth}
        childCountOverride={childCountOverride}
        hasChildren={hasChildren}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        isDropTarget={isOver && !isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  )
}

function BoardGroupHeader({
  id,
  accentVar,
  groupLabel,
  groupCount,
}: {
  id: string
  accentVar?: string | null
  groupLabel: string
  groupCount: number
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/col flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 transition-colors",
        isOver && "bg-surface-2"
      )}
    >
      <div className="flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.01em] text-foreground">
        <span
          aria-hidden
          className="inline-block size-2 rounded-full"
          style={{ background: accentVar ?? "var(--text-3)" }}
        />
        <span>{groupLabel}</span>
        <span className="text-[11.5px] font-normal text-fg-3 tabular-nums">
          {groupCount}
        </span>
      </div>
    </div>
  )
}

function BoardDropLane({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children?: ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-8 flex-col gap-1.5 rounded-md p-0 transition-colors",
        className,
        isOver && "bg-accent-bg/40"
      )}
    >
      {children}
    </div>
  )
}

function DraggableWorkCard({
  data,
  item,
  displayProps,
  childCountOverride,
  details,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  childCountOverride?: number
  details?: ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } =
    useDraggable({
      id: item.id,
    })
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({
    id: `board-item::${item.id}`,
  })

  function setNodeRef(node: HTMLDivElement | null) {
    setDraggableNodeRef(node)
    setDroppableNodeRef(node)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging ? "opacity-60" : "opacity-100")}
    >
      <BoardCardBody
        data={data}
        item={item}
        displayProps={displayProps}
        childCountOverride={childCountOverride}
        details={details}
        isDropTarget={isOver && !isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  )
}

function BoardCardBody({
  data,
  item,
  displayProps,
  childCountOverride,
  details,
  isDropTarget = false,
  dragAttributes,
  dragListeners,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  childCountOverride?: number
  details?: ReactNode
  isDropTarget?: boolean
  dragAttributes?: DraggableBindings["attributes"]
  dragListeners?: DraggableBindings["listeners"]
}) {
  const dueDateLabel =
    displayProps.includes("dueDate") && item.dueDate
      ? formatWorkSurfaceDueDate(item.dueDate)
      : null
  const daysUntilDue = dueDateLabel
    ? getCalendarDateDayOffset(item.dueDate)
    : null
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0
  const isSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 5
  const childProgress = getChildProgressRollup(data, item)
  const subCount = childCountOverride ?? childProgress?.totalChildren ?? 0
  const idProperty = renderWorkItemDisplayProperty({
    data,
    item,
    property: "id",
    variant: "board",
    childProgress,
    dueDateLabel,
    isOverdue,
    isSoon,
  })
  const visibleProperties = renderWorkItemDisplayProperties({
    data,
    item,
    displayProps: displayProps.filter((property) => property !== "id"),
    variant: "board",
    childProgress,
    dueDateLabel,
    isOverdue,
    isSoon,
  })
  const itemHref = `/items/${item.id}`

  return (
    <IssueContextMenu data={data} item={item}>
      <div
        className={cn(
          "group/card relative flex touch-none cursor-grab flex-col gap-2 rounded-[8px] border border-line bg-surface px-3 py-2.5 transition-all hover:border-[color:var(--text-4)] hover:shadow-sm active:cursor-grabbing",
          isDropTarget && "border-fg-4 bg-surface-2"
        )}
        {...dragAttributes}
        {...dragListeners}
      >
        <Link
          href={itemHref}
          aria-label={`Open ${item.title}`}
          className="absolute inset-0 rounded-[8px] focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
        />
        <div className="pointer-events-none relative z-10 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {idProperty ? <div className="mb-1">{idProperty}</div> : null}
            <div className="min-w-0">
              <div className="flex min-w-0 items-start gap-1.5">
                <div className="min-w-0 text-[13.5px] leading-[1.4] font-medium text-foreground">
                  {item.title}
                </div>
                <WorkItemChildCount count={subCount} className="pt-0.5" />
              </div>
            </div>
          </div>
          <div
            className="pointer-events-auto opacity-0 transition-opacity group-hover/card:opacity-100"
            onPointerDown={stopDragPropagation}
            onClick={stopMenuEvent}
        >
          <div className="flex items-center gap-1">
            <IssueActionMenu
              data={data}
              item={item}
              triggerClassName="rounded-sm p-0.5 hover:bg-surface-3"
            />
          </div>
        </div>
        </div>
        <div className="pointer-events-none relative z-10 flex min-w-0 flex-col gap-2">
          {visibleProperties.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-fg-3">
              {visibleProperties.map(({ key, node }) => (
                <span key={key} className="pointer-events-auto contents">
                  {node}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {details ? (
          <div
            className="pointer-events-auto relative z-10"
            onPointerDown={stopDragPropagation}
            onClick={stopMenuEvent}
          >
            {details}
          </div>
        ) : null}
      </div>
    </IssueContextMenu>
  )
}

function WorkItemChildDisclosure({
  data,
  item,
  childItems,
  editable,
  expanded,
  onToggle,
}: {
  data: AppData
  item: WorkItem
  childItems: WorkItem[]
  editable: boolean
  expanded: boolean
  onToggle: () => void
}) {
  if (childItems.length === 0) {
    return null
  }

  const childCountLabel = getDisplayedChildCountLabel(data, item, childItems)

  if (!childCountLabel) {
    return null
  }

  return (
    <div className="mt-1 rounded-md bg-surface-2 p-2">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-[11.5px] font-medium text-fg-3 transition-colors hover:text-foreground"
        onPointerDown={stopDragPropagation}
        onClick={onToggle}
      >
        <CollapseCaret open={expanded} className="size-3" />
        <span>{childCountLabel}</span>
      </button>
      {expanded ? (
        <div className="mt-1.5 flex flex-col gap-1">
          {childItems.map((child) => {
            const childAssignee = child.assigneeId
              ? getUser(data, child.assigneeId)
              : null

            return editable ? (
              <DraggableBoardChildItem
                key={child.id}
                item={child}
                assignee={childAssignee}
              />
            ) : (
              <Link
                key={child.id}
                href={`/items/${child.id}`}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] transition-colors hover:bg-surface-3"
              >
                <StatusRing status={child.status} className="size-2.5" />
                <span className="shrink-0 text-[11px] text-fg-3">
                  {child.key}
                </span>
                <span className="min-w-0 flex-1 truncate text-fg-2">
                  {child.title}
                </span>
                {childAssignee ? (
                  <WorkItemAssigneeAvatar
                    user={childAssignee}
                    className="size-4"
                  />
                ) : null}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function DraggableBoardChildItem({
  item,
  assignee,
}: {
  item: WorkItem
  assignee: ReturnType<typeof getUser> | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } =
    useDraggable({
      id: item.id,
      data: {
        previewKind: "child",
      },
    })
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({
    id: `board-item::${item.id}`,
  })

  function setNodeRef(node: HTMLAnchorElement | null) {
    setDraggableNodeRef(node)
    setDroppableNodeRef(node)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && "opacity-60")}
    >
      <BoardChildItemRow
        item={item}
        assignee={assignee}
        interactive
        href={`/items/${item.id}`}
        isDropTarget={isOver && !isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  )
}

function BoardChildItemRow({
  item,
  assignee,
  interactive,
  href,
  isDropTarget = false,
  dragAttributes,
  dragListeners,
}: {
  item: WorkItem
  assignee: ReturnType<typeof getUser> | null
  interactive: boolean
  href?: string
  isDropTarget?: boolean
  dragAttributes?: DraggableBindings["attributes"]
  dragListeners?: DraggableBindings["listeners"]
}) {
  const className = cn(
    "flex touch-none cursor-grab items-center gap-2 rounded-md px-1.5 py-1 text-[12px] transition-colors hover:bg-surface-3 active:cursor-grabbing",
    isDropTarget && "bg-surface-3"
  )

  const content = (
    <>
      <StatusRing status={item.status} className="size-2.5" />
      <span className="shrink-0 text-[11px] text-fg-3">{item.key}</span>
      <span className="min-w-0 flex-1 truncate text-fg-2">{item.title}</span>
      {assignee ? (
        <WorkItemAssigneeAvatar user={assignee} className="size-4" />
      ) : null}
    </>
  )

  if (!interactive || !href) {
    return (
      <div className={className}>
        {content}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={className}
      {...dragAttributes}
      {...dragListeners}
    >
      {content}
    </Link>
  )
}
