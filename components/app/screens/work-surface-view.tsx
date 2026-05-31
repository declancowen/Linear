"use client"

import { AppLink, useAppRouter } from "@/lib/browser/app-navigation"
import {
  memo,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
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
  SidebarSimple,
  TreeStructure,
} from "@phosphor-icons/react"

import {
  buildItemGroups,
  buildItemGroupsWithEmptyGroups,
  getDirectChildWorkItemsForDisplay,
  getTeam,
  getUser,
  getWorkItem,
  getWorkItemChildProgress,
} from "@/lib/domain/selectors"
import { openManagedCreateDialog } from "@/lib/browser/dialog-transitions"
import { getCalendarDateDayOffset } from "@/lib/date-input"
import {
  getDisplayLabelForWorkItemType,
  getDisplayPluralLabelForWorkItemType,
  type AppData,
  type BuiltinDisplayProperty,
  type DisplayProperty,
  type TeamExperienceType,
  type ViewDefinition,
  type WorkItem,
  type WorkItemVisibility,
  getCustomPropertyIdFromDisplayReference,
} from "@/lib/domain/types"
import { isCustomPropertyDefinitionForWorkItem } from "@/lib/domain/labels"
import { getWorkItemAssigneeIds } from "@/lib/domain/work-item-assignees"
import { useAppStore } from "@/lib/store/app-store"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusRing } from "@/components/ui/template-primitives"

import {
  IssueActionMenu,
  IssueContextMenu,
  stopMenuEvent,
  stopDragPropagation,
} from "./work-item-menus"
import { WorkItemAssigneeAvatar, WorkItemTypeBadge } from "./work-item-ui"
import { getCreateDefaultsForField, LabelColorDot } from "./shared"
import { InlineWorkItemPropertyControl } from "./work-item-inline-property-control"
import { CustomPropertyValueControl } from "./custom-property-controls"
import { getContainerItemsForDisplay } from "./helpers"
import { useWorkItemProjectCascadeConfirmation } from "./use-work-item-project-cascade-confirmation"
import {
  getGroupAccentVar,
  getGroupValueAdornment,
  getGroupValueLabel,
} from "./work-surface-view/shared"
import {
  formatWorkSurfaceDueDate,
  formatWorkSurfaceTimestamp,
} from "./date-presentation"
import { BoardChildItemRow } from "./work-surface-view/board-child-item-row"
import {
  requestWorkSurfaceDragUpdate,
  type RequestConfirmedWorkItemUpdate,
  type WorkSurfaceScope,
} from "./work-surface-view/drag-state"
export { TimelineView } from "./work-surface-view/timeline-view"
export {
  CalendarSettingsButton,
  CalendarView,
  type CalendarColorMode,
  type CalendarMode,
  type CalendarTimeInterval,
  type CalendarViewControls,
  type CalendarWeekDayCount,
  type CalendarWeekStart,
} from "./work-surface-view/calendar-view"
import { cn } from "@/lib/utils"

const DRAG_HOLD_DELAY_MS = 160
const DRAG_HOLD_TOLERANCE_PX = 8
const META_CHIP_CLASS =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2 text-[11px] text-fg-2"
const META_TEXT_CLASS = "shrink-0 text-[11.5px] text-fg-3 tabular-nums"

function useHoldToDragSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: DRAG_HOLD_DELAY_MS,
        tolerance: DRAG_HOLD_TOLERANCE_PX,
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

function prioritizeItemDropTargets(
  collisions: Collision[],
  scope: WorkSurfaceScope
) {
  const itemPrefix = `${scope}-item::`
  const itemCollisions = collisions.filter((collision) =>
    String(collision.id).startsWith(itemPrefix)
  )

  return itemCollisions.length > 0 ? itemCollisions : collisions
}

function createWorkSurfaceCollisionDetection(
  scope: WorkSurfaceScope
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

function toggleSetMember<T>(
  setValues: Dispatch<SetStateAction<Set<T>>>,
  value: T
) {
  setValues((current) => {
    const next = new Set(current)

    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }

    return next
  })
}

function getWorkSurfaceGroups({
  createContext,
  data,
  editable,
  items,
  scopedItems,
  view,
}: {
  createContext?: WorkSurfaceCreateContext
  data: AppData
  editable: boolean
  items: WorkItem[]
  scopedItems?: WorkItem[]
  view: ViewDefinition
}) {
  const sourceItems = scopedItems ?? items
  const groupedItems = getParentGroupedDisplayItems(items, sourceItems, view)

  return [
    ...(editable
      ? buildItemGroupsWithEmptyGroups(data, groupedItems, view, {
          sourceItems,
          teamId: createContext?.defaultTeamId,
          projectId: createContext?.defaultProjectId,
        })
      : buildItemGroups(data, groupedItems, view)
    ).entries(),
  ]
}

function isParentGroupingField(field: ViewDefinition["grouping"] | null) {
  return field === "parent"
}

function getParentIdsWithChildren(sourceItems: WorkItem[]) {
  const sourceItemIds = new Set(sourceItems.map((item) => item.id))
  const parentIds = new Set<string>()

  sourceItems.forEach((item) => {
    if (item.parentId && sourceItemIds.has(item.parentId)) {
      parentIds.add(item.parentId)
    }
  })

  return parentIds
}

function getParentGroupedDisplayItems(
  items: WorkItem[],
  sourceItems: WorkItem[],
  view: ViewDefinition
) {
  if (
    !isParentGroupingField(view.grouping) &&
    !isParentGroupingField(view.subGrouping)
  ) {
    return items
  }

  const parentIds = getParentIdsWithChildren(sourceItems)

  if (parentIds.size === 0) {
    return items
  }

  return items.filter((item) => !parentIds.has(item.id))
}

function getParentGroupValueForItem(item: WorkItem) {
  return `${item.key} · ${item.title}`
}

function getParentGroupItem({
  data,
  field,
  groupItems,
  sourceItems,
  value,
}: {
  data: AppData
  field: ViewDefinition["grouping"] | null
  groupItems: WorkItem[]
  sourceItems: WorkItem[]
  value: string
}) {
  if (!isParentGroupingField(field) || value === "No parent") {
    return null
  }

  for (const item of groupItems) {
    const parent =
      item.parentId !== null ? getWorkItem(data, item.parentId) : null

    if (parent && getParentGroupValueForItem(parent) === value) {
      return parent
    }
  }

  return (
    sourceItems.find((item) => getParentGroupValueForItem(item) === value) ??
    data.workItems.find((item) => getParentGroupValueForItem(item) === value) ??
    null
  )
}

type CreateDefaultsForFieldResult = ReturnType<typeof getCreateDefaultsForField>

function getSubgroupCreateDefaults({
  data,
  baseItem,
  subgroupValue,
  teamId,
  view,
}: {
  data: AppData
  baseItem: WorkItem | null
  subgroupValue?: string
  teamId: string | null
  view: Pick<ViewDefinition, "subGrouping">
}): CreateDefaultsForFieldResult | null {
  if (subgroupValue === undefined) {
    return null
  }

  return getCreateDefaultsForField(
    data,
    baseItem,
    view.subGrouping,
    subgroupValue,
    { teamId }
  )
}

function mergeCreateDefaultPatches(
  groupDefaults: CreateDefaultsForFieldResult,
  subgroupDefaults: CreateDefaultsForFieldResult | null
) {
  return {
    ...groupDefaults.patch,
    ...(subgroupDefaults?.patch ?? {}),
  }
}

function getCreateDefaultTeamId({
  baseItem,
  createContext,
  groupDefaults,
  subgroupDefaults,
}: {
  baseItem: WorkItem | null
  createContext?: WorkSurfaceCreateContext
  groupDefaults: CreateDefaultsForFieldResult
  subgroupDefaults: CreateDefaultsForFieldResult | null
}) {
  return (
    subgroupDefaults?.defaultTeamId ??
    groupDefaults.defaultTeamId ??
    baseItem?.teamId ??
    createContext?.defaultTeamId ??
    null
  )
}

function getCreateDefaultValues({
  createContext,
  groupedPatch,
}: {
  createContext?: WorkSurfaceCreateContext
  groupedPatch: CreateDefaultsForFieldResult["patch"]
}) {
  const createsPrivateWorkItem = createContext?.defaultVisibility === "private"

  return {
    status: groupedPatch.status,
    priority: groupedPatch.priority,
    assigneeId: createsPrivateWorkItem ? null : groupedPatch.assigneeId,
    assigneeIds:
      !createsPrivateWorkItem && groupedPatch.assigneeId
        ? [groupedPatch.assigneeId]
        : [],
    primaryProjectId: createsPrivateWorkItem
      ? null
      : groupedPatch.primaryProjectId !== undefined
        ? groupedPatch.primaryProjectId
        : (createContext?.defaultProjectId ?? null),
    labelIds: groupedPatch.labelIds,
    parentId: groupedPatch.parentId ?? null,
    visibility: createContext?.defaultVisibility,
  }
}

function buildCreateDefaultsForGroup({
  data,
  items,
  view,
  groupValue,
  subgroupValue,
  createContext,
}: {
  data: AppData
  items: WorkItem[]
  view: Pick<ViewDefinition, "grouping" | "subGrouping">
  groupValue: string
  subgroupValue?: string
  createContext?: WorkSurfaceCreateContext
}) {
  const baseItem = items[0] ?? null
  const teamId = baseItem?.teamId ?? createContext?.defaultTeamId ?? null
  const groupDefaults = getCreateDefaultsForField(
    data,
    baseItem,
    view.grouping,
    groupValue,
    { teamId }
  )
  const subgroupDefaults = getSubgroupCreateDefaults({
    data,
    baseItem,
    subgroupValue,
    teamId,
    view,
  })
  const groupedPatch = mergeCreateDefaultPatches(
    groupDefaults,
    subgroupDefaults
  )

  return {
    defaultTeamId: getCreateDefaultTeamId({
      baseItem,
      createContext,
      groupDefaults,
      subgroupDefaults,
    }),
    initialType:
      subgroupDefaults?.initialType ?? groupDefaults.initialType ?? null,
    defaultValues: getCreateDefaultValues({
      createContext,
      groupedPatch,
    }),
  }
}

function openCreateDialogForWorkSurfaceGroup({
  createContext,
  data,
  groupValue,
  items,
  laneItems,
  scopedItems,
  subgroupValue,
  view,
}: {
  createContext?: WorkSurfaceCreateContext
  data: AppData
  groupValue: string
  items: WorkItem[]
  laneItems: WorkItem[]
  scopedItems?: WorkItem[]
  subgroupValue?: string
  view: Pick<ViewDefinition, "grouping" | "subGrouping">
}) {
  const createDefaults = buildCreateDefaultsForGroup({
    data,
    items: laneItems,
    view,
    groupValue,
    subgroupValue,
    createContext,
  })

  openManagedCreateDialog({
    kind: "workItem",
    defaultTeamId:
      createDefaults.defaultTeamId ??
      laneItems[0]?.teamId ??
      items[0]?.teamId ??
      scopedItems?.[0]?.teamId ??
      createContext?.defaultTeamId ??
      null,
    defaultProjectId: createDefaults.defaultValues.primaryProjectId,
    initialType: createDefaults.initialType,
    defaultValues: createDefaults.defaultValues,
  })
}

type WorkSurfaceCreateContext = {
  defaultTeamId?: string | null
  defaultProjectId?: string | null
  defaultVisibility?: WorkItemVisibility
}

type WorkSurfaceViewProps = {
  data: AppData
  items: WorkItem[]
  scopedItems?: WorkItem[]
  view: ViewDefinition
  editable: boolean
  groupingExperience?: TeamExperienceType | null
  childDisplayMode?: ChildDisplayMode
  createContext?: WorkSurfaceCreateContext
  onToggleHiddenValue?: (key: "groups" | "subgroups", value: string) => void
}

type OpenCreateForGroupInput = {
  groupValue: string
  subgroupValue?: string
  laneItems: WorkItem[]
}

function createWorkSurfaceGroupCreateHandler(input: {
  createContext?: WorkSurfaceCreateContext
  data: AppData
  items: WorkItem[]
  scopedItems?: WorkItem[]
  view: ViewDefinition
}) {
  return function openCreateForGroup({
    groupValue,
    subgroupValue,
    laneItems,
  }: OpenCreateForGroupInput) {
    openCreateDialogForWorkSurfaceGroup({
      createContext: input.createContext,
      data: input.data,
      groupValue,
      items: input.items,
      laneItems,
      scopedItems: input.scopedItems,
      subgroupValue,
      view: input.view,
    })
  }
}

function useWorkSurfaceDragController({
  data,
  editable,
  itemPool,
  onDragCancel,
  onDragStart,
  requestUpdate,
  scope,
  view,
}: {
  data: AppData
  editable: boolean
  itemPool: WorkItem[]
  onDragCancel?: () => void
  onDragStart?: (event: DragStartEvent) => void
  requestUpdate: RequestConfirmedWorkItemUpdate
  scope: WorkSurfaceScope
  view: ViewDefinition
}) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const sensors = useHoldToDragSensors()

  function handleDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id))
    onDragStart?.(event)
  }

  function completeDrag() {
    setActiveItemId(null)
    onDragCancel?.()
  }

  function handleDragCancel() {
    completeDrag()
  }

  function handleDragEnd(event: DragEndEvent) {
    try {
      requestWorkSurfaceDragUpdate({
        data,
        editable,
        event,
        itemPool,
        requestUpdate,
        scope,
        view,
      })
    } finally {
      completeDrag()
    }
  }

  return {
    activeItem: itemPool.find((item) => item.id === activeItemId) ?? null,
    handleDragCancel,
    handleDragEnd,
    handleDragStart,
    sensors,
  }
}

function useWorkSurfaceInteractionState({
  data,
  editable,
  onDragCancel,
  onDragStart,
  scopedItems,
  scope,
  view,
}: Pick<WorkSurfaceViewProps, "data" | "editable" | "scopedItems" | "view"> & {
  onDragCancel?: () => void
  onDragStart?: (event: DragStartEvent) => void
  scope: WorkSurfaceScope
}) {
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set())
  const itemPool = scopedItems ?? data.workItems
  const { requestUpdate: requestConfirmedWorkItemUpdate, confirmationDialog } =
    useWorkItemProjectCascadeConfirmation()
  const dragController = useWorkSurfaceDragController({
    data,
    editable,
    itemPool,
    onDragCancel,
    onDragStart,
    requestUpdate: requestConfirmedWorkItemUpdate,
    scope,
    view,
  })

  return {
    ...dragController,
    confirmationDialog,
    expandedItemIds,
    setExpandedItemIds,
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

type WorkItemDisplayPropertyContext = {
  data: AppData
  item: WorkItem
  property: DisplayProperty
  variant: "list" | "board"
  childProgress: ChildProgressRollup | null
  dueDateLabel: string | null
  isOverdue: boolean
  isSoon: boolean
}

type WorkItemDisplayPropertyRenderer = (
  context: WorkItemDisplayPropertyContext
) => ReactNode | ReactNode[] | null

function renderWorkItemIdProperty({ item }: WorkItemDisplayPropertyContext) {
  return (
    <span className="shrink-0 font-mono text-[11.5px] tracking-[0.01em] text-fg-3">
      {item.key}
    </span>
  )
}

function renderInlineWorkItemProperty(
  context: WorkItemDisplayPropertyContext,
  property: "status" | "priority" | "project" | "assignee"
) {
  return (
    <InlineWorkItemPropertyControl
      data={context.data}
      item={context.item}
      property={property}
      variant="surface"
    />
  )
}

function renderWorkItemTypeProperty({
  data,
  item,
}: WorkItemDisplayPropertyContext) {
  return (
    <WorkItemTypeBadge
      data={data}
      item={item}
      className="h-5 px-2 text-[11px] text-fg-2"
    />
  )
}

function renderWorkItemProgressProperty({
  childProgress,
  variant,
}: WorkItemDisplayPropertyContext) {
  return <WorkItemProgressProperty progress={childProgress} variant={variant} />
}

function renderWorkItemMilestoneProperty({
  data,
  item,
}: WorkItemDisplayPropertyContext) {
  const milestone = data.milestones.find(
    (entry) => entry.id === item.milestoneId
  )

  if (!milestone) {
    return null
  }

  return <span className={META_CHIP_CLASS}>{milestone.name}</span>
}

function renderWorkItemParentProperty({
  data,
  item,
}: WorkItemDisplayPropertyContext) {
  if (!item.parentId) {
    return null
  }

  const parent = getWorkItem(data, item.parentId)

  if (!parent) {
    return null
  }

  return (
    <span className={cn(META_CHIP_CLASS, "max-w-full min-w-0")}>
      <TreeStructure className="size-3 shrink-0" />
      <span className="truncate">
        {parent.key} · {parent.title}
      </span>
    </span>
  )
}

function renderWorkItemLabelsProperty({
  data,
  item,
  variant,
}: WorkItemDisplayPropertyContext) {
  if ((item.visibility ?? "team") === "private" || item.labelIds.length === 0) {
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

function renderWorkItemDueDateProperty({
  dueDateLabel,
  isOverdue,
  isSoon,
}: WorkItemDisplayPropertyContext) {
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

function renderWorkItemCreatedProperty({
  item,
}: WorkItemDisplayPropertyContext) {
  const createdAt = formatWorkSurfaceTimestamp(item.createdAt, "Created")

  return createdAt ? <span className={META_TEXT_CLASS}>{createdAt}</span> : null
}

function renderWorkItemUpdatedProperty({
  item,
}: WorkItemDisplayPropertyContext) {
  const updatedAt = formatWorkSurfaceTimestamp(item.updatedAt, "Updated")

  return updatedAt ? <span className={META_TEXT_CLASS}>{updatedAt}</span> : null
}

const workItemDisplayPropertyRenderers: Partial<
  Record<BuiltinDisplayProperty, WorkItemDisplayPropertyRenderer>
> = {
  id: renderWorkItemIdProperty,
  status: (context) => renderInlineWorkItemProperty(context, "status"),
  type: renderWorkItemTypeProperty,
  priority: (context) => renderInlineWorkItemProperty(context, "priority"),
  progress: renderWorkItemProgressProperty,
  project: (context) => renderInlineWorkItemProperty(context, "project"),
  parent: renderWorkItemParentProperty,
  milestone: renderWorkItemMilestoneProperty,
  labels: renderWorkItemLabelsProperty,
  dueDate: renderWorkItemDueDateProperty,
  created: renderWorkItemCreatedProperty,
  updated: renderWorkItemUpdatedProperty,
  assignee: (context) => renderInlineWorkItemProperty(context, "assignee"),
}

function isDisplayCustomPropertyDefinition(
  context: WorkItemDisplayPropertyContext,
  entry: AppData["customPropertyDefinitions"][number],
  customPropertyId: string
) {
  return (
    entry.id === customPropertyId &&
    isCustomPropertyDefinitionForWorkItem(
      entry,
      context.item,
      context.data.currentUserId
    )
  )
}

function getDisplayCustomPropertyDefinition(
  context: WorkItemDisplayPropertyContext,
  customPropertyId: string
) {
  return context.data.customPropertyDefinitions.find((entry) =>
    isDisplayCustomPropertyDefinition(context, entry, customPropertyId)
  )
}

function getDisplayCustomPropertyValue(
  context: WorkItemDisplayPropertyContext,
  propertyId: string
) {
  return (
    context.data.customPropertyValues.find(
      (entry) =>
        entry.workItemId === context.item.id && entry.propertyId === propertyId
    ) ?? null
  )
}

function renderCustomWorkItemDisplayProperty(
  context: WorkItemDisplayPropertyContext,
  customPropertyId: string
) {
  const definition = getDisplayCustomPropertyDefinition(
    context,
    customPropertyId
  )

  if (!definition) {
    return null
  }

  const value = getDisplayCustomPropertyValue(context, definition.id)

  if (!value) {
    return null
  }

  return (
    <CustomPropertyValueControl
      data={context.data}
      definition={definition}
      item={context.item}
      value={value}
      editable
      variant="chip"
    />
  )
}

function renderBuiltinWorkItemDisplayProperty(
  context: WorkItemDisplayPropertyContext
) {
  return (
    workItemDisplayPropertyRenderers[
      context.property as BuiltinDisplayProperty
    ]?.(context) ?? null
  )
}

function renderWorkItemDisplayProperty(
  context: WorkItemDisplayPropertyContext
) {
  const customPropertyId = getCustomPropertyIdFromDisplayReference(
    context.property
  )

  if (customPropertyId) {
    return renderCustomWorkItemDisplayProperty(context, customPropertyId)
  }

  return renderBuiltinWorkItemDisplayProperty(context)
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

function useMemoizedWorkSurfaceGroups({
  createContext,
  data,
  editable,
  items,
  scopedItems,
  view,
}: Pick<
  WorkSurfaceViewProps,
  "createContext" | "data" | "editable" | "items" | "scopedItems" | "view"
>) {
  return useMemo(
    () =>
      getWorkSurfaceGroups({
        createContext,
        data,
        editable,
        items,
        scopedItems,
        view,
      }),
    [createContext, data, editable, items, scopedItems, view]
  )
}

export function BoardView({
  data,
  items,
  scopedItems,
  view,
  editable,
  groupingExperience,
  childDisplayMode = "direct",
  createContext,
  onToggleHiddenValue,
}: WorkSurfaceViewProps) {
  const groups = useMemoizedWorkSurfaceGroups({
    createContext,
    data,
    editable,
    items,
    scopedItems,
    view,
  })
  const [activeDragPreviewKind, setActiveDragPreviewKind] = useState<
    "card" | "child" | null
  >(null)
  const {
    activeItem,
    confirmationDialog,
    expandedItemIds,
    handleDragCancel,
    handleDragEnd,
    handleDragStart,
    sensors,
    setExpandedItemIds,
  } = useWorkSurfaceInteractionState({
    data,
    editable,
    onDragCancel: () => setActiveDragPreviewKind(null),
    onDragStart: (event) =>
      setActiveDragPreviewKind(
        event.active.data.current?.previewKind === "child" ? "child" : "card"
      ),
    scopedItems,
    scope: "board",
    view,
  })
  const hiddenGroups = groups.filter(([groupName]) =>
    view.hiddenState.groups.includes(groupName)
  )
  const visibleGroups = groups.filter(
    ([groupName]) => !view.hiddenState.groups.includes(groupName)
  )
  const showChildItems = Boolean(view.showChildItems)
  const sourceItems = scopedItems ?? items
  const displayItems = getParentGroupedDisplayItems(items, sourceItems, view)

  function toggleExpandedItem(itemId: string) {
    toggleSetMember(setExpandedItemIds, itemId)
  }

  const openCreateForGroup = createWorkSurfaceGroupCreateHandler({
    createContext,
    data,
    items,
    scopedItems,
    view,
  })

  return (
    <DndContext
      collisionDetection={boardCollisionDetection}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="h-full w-full">
        <div className="flex h-full min-w-max items-stretch gap-3 px-4 pt-3.5 pb-8">
          {visibleGroups.map(([groupName, subgroups]) => {
            const groupItems = Array.from(subgroups.values()).flat()
            const groupCount = groupItems.length
            const parentGroupItem = getParentGroupItem({
              data,
              field: view.grouping,
              groupItems,
              sourceItems,
              value: groupName,
            })
            const groupLabel = getGroupValueLabel(view.grouping, groupName, {
              view,
              groupingExperience,
            })
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
                  data={data}
                  displayProps={view.displayProps}
                  parentItem={parentGroupItem}
                />
                <div
                  aria-hidden
                  className="mx-3 h-0.5 rounded-full opacity-60"
                  style={{
                    background: groupAccentVar ?? "var(--text-3)",
                  }}
                />
                <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2">
                  {Array.from(subgroups.entries()).map(
                    ([subgroupName, subItems]) => {
                      const hidden =
                        view.hiddenState.subgroups.includes(subgroupName)
                      if (hidden) return null
                      const parentSubgroupItem = getParentGroupItem({
                        data,
                        field: view.subGrouping,
                        groupItems: subItems,
                        sourceItems,
                        value: subgroupName,
                      })

                      return (
                        <div key={`${groupName}-${subgroupName}`}>
                          {view.subGrouping ? (
                            <BoardSubgroupHeader
                              data={data}
                              displayProps={view.displayProps}
                              groupCount={subItems.length}
                              groupLabel={getGroupValueLabel(
                                view.subGrouping,
                                subgroupName,
                                {
                                  view,
                                  groupingExperience,
                                }
                              )}
                              parentItem={parentSubgroupItem}
                            />
                          ) : null}
                          <BoardDropLane
                            id={`board::${groupName}::${subgroupName}`}
                          >
                            {getContainerItemsForDisplay(
                              subItems,
                              displayItems,
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
                                      filterChildren: false,
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
                  onToggleHiddenValue
                    ? onToggleHiddenValue("groups", groupName)
                    : useAppStore
                        .getState()
                        .toggleViewHiddenValue(view.id, "groups", groupName)
                }
              >
                {getGroupValueLabel(view.grouping, groupName, {
                  view,
                  groupingExperience,
                })}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {confirmationDialog}

      <DragOverlay>
        {activeItem ? (
          activeDragPreviewKind === "child" ? (
            <div className="w-[280px] rounded-md border border-line bg-surface shadow-sm">
              <BoardChildItemRow
                item={activeItem}
                assignee={
                  (activeItem.visibility ?? "team") !== "private" &&
                  getWorkItemAssigneeIds(activeItem)[0]
                    ? getUser(data, getWorkItemAssigneeIds(activeItem)[0])
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
  groupingExperience,
  childDisplayMode = "direct",
  createContext,
  onToggleHiddenValue,
}: WorkSurfaceViewProps) {
  const groups = useMemoizedWorkSurfaceGroups({
    createContext,
    data,
    editable,
    items,
    scopedItems,
    view,
  })
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const {
    activeItem,
    confirmationDialog,
    expandedItemIds,
    handleDragCancel,
    handleDragEnd,
    handleDragStart,
    sensors,
    setExpandedItemIds,
  } = useWorkSurfaceInteractionState({
    data,
    editable,
    scopedItems,
    scope: "list",
    view,
  })
  const showChildItems = Boolean(view.showChildItems)
  const sourceItems = scopedItems ?? items
  const displayItems = getParentGroupedDisplayItems(items, sourceItems, view)

  function toggleGroup(groupName: string) {
    toggleSetMember(setCollapsedGroups, groupName)
  }

  function toggleExpandedItem(itemId: string) {
    toggleSetMember(setExpandedItemIds, itemId)
  }

  const openCreateForGroup = createWorkSurfaceGroupCreateHandler({
    createContext,
    data,
    items,
    scopedItems,
    view,
  })

  return (
    <DndContext
      collisionDetection={listCollisionDetection}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col pb-10">
        {groups.map(([groupName, subgroups]) => {
          if (view.hiddenState.groups.includes(groupName)) {
            return null
          }

          const groupItems = Array.from(subgroups.values()).flat()
          const groupCount = groupItems.length
          const parentGroupItem = getParentGroupItem({
            data,
            field: view.grouping,
            groupItems,
            sourceItems,
            value: groupName,
          })
          const isExpandable = groupCount > 0 || editable
          const isCollapsed = collapsedGroups.has(groupName)
          const groupLabel = getGroupValueLabel(view.grouping, groupName, {
            view,
            groupingExperience,
          })
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
                data={data}
                displayProps={view.displayProps}
                isCollapsed={isCollapsed}
                isExpandable={isExpandable}
                parentItem={parentGroupItem}
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
                      const parentSubgroupItem = getParentGroupItem({
                        data,
                        field: view.subGrouping,
                        groupItems: subItems,
                        sourceItems,
                        value: subgroupName,
                      })

                      return (
                        <div key={`${groupName}-${subgroupName}`}>
                          {view.subGrouping ? (
                            <ListSubgroupHeader
                              data={data}
                              displayProps={view.displayProps}
                              groupCount={subItems.length}
                              groupLabel={getGroupValueLabel(
                                view.subGrouping,
                                subgroupName,
                                {
                                  view,
                                  groupingExperience,
                                }
                              )}
                              parentItem={parentSubgroupItem}
                            />
                          ) : null}
                          <ListDropLane
                            id={`list::${groupName}::${subgroupName}`}
                          >
                            {getContainerItemsForDisplay(
                              subItems,
                              displayItems,
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
                                      filterChildren: false,
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
                                ...children.map((child) =>
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
                                ),
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
                  onToggleHiddenValue
                    ? onToggleHiddenValue("groups", groupName)
                    : useAppStore
                        .getState()
                        .toggleViewHiddenValue(view.id, "groups", groupName)
                }
              >
                {getGroupValueAdornment(view.grouping, groupName)}
                <span>
                  {getGroupValueLabel(view.grouping, groupName, {
                    view,
                    groupingExperience,
                  })}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">0</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {confirmationDialog}

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
  data,
  displayProps,
  groupAdornment,
  groupCount,
  groupLabel,
  isCollapsed,
  isExpandable,
  parentItem,
  onClick,
}: {
  id: string
  accentVar?: string | null
  data: AppData
  displayProps: DisplayProperty[]
  groupAdornment: ReactNode
  groupCount: number
  groupLabel: string
  isCollapsed: boolean
  isExpandable: boolean
  parentItem?: WorkItem | null
  onClick: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  if (parentItem) {
    return (
      <div
        ref={setNodeRef}
        className="sticky top-0 z-[2] bg-[color:color-mix(in_oklch,var(--background)_92%,transparent)] backdrop-blur-[6px]"
      >
        <div className="flex w-full items-center gap-2.5 px-5 pt-2 pb-1.5 pl-3.5 text-left">
          <button
            type="button"
            aria-disabled={!isExpandable}
            aria-label={
              isCollapsed ? `Expand ${groupLabel}` : `Collapse ${groupLabel}`
            }
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-sm text-fg-3 focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none",
              isExpandable ? "hover:bg-surface-3" : "cursor-default"
            )}
            onClick={() => {
              if (isExpandable) {
                onClick()
              }
            }}
          >
            {isExpandable ? (
              <CollapseCaret open={!isCollapsed} className="size-3" />
            ) : (
              <span aria-hidden className="size-3" />
            )}
          </button>
          <div
            className={cn(
              "flex min-h-10 min-w-0 flex-1 items-center rounded-[min(var(--radius-md),12px)] border border-line bg-surface px-3.5 py-1.5 shadow-[0_1px_0_0_oklch(0.18_0_0/0.03)] transition-colors",
              isOver && "border-fg-4 bg-surface-2"
            )}
          >
            <ParentGroupItemSummary
              accentVar={accentVar}
              data={data}
              displayProps={displayProps}
              groupCount={groupCount}
              item={parentItem}
              variant="list"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className="sticky top-0 z-[2] bg-[color:color-mix(in_oklch,var(--background)_92%,transparent)] backdrop-blur-[6px]"
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

function ListSubgroupHeader({
  data,
  displayProps,
  groupCount,
  groupLabel,
  parentItem,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  groupCount: number
  groupLabel: string
  parentItem?: WorkItem | null
}) {
  if (parentItem) {
    return (
      <div className="px-11 py-1.5">
        <div className="flex min-h-9 min-w-0 items-center rounded-md border border-line-soft bg-surface px-3 py-1.5">
          <ParentGroupItemSummary
            data={data}
            displayProps={displayProps}
            groupCount={groupCount}
            item={parentItem}
            variant="list"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="px-11 py-1.5 text-[11px] font-medium tracking-[0.04em] text-fg-3 uppercase">
      {groupLabel}
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

type ListRowBodyProps = {
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
}

type ListRowProps = Omit<
  ListRowBodyProps,
  "dragAttributes" | "dragListeners" | "interactive" | "isDropTarget"
>

function getWorkSurfaceItemDisplayState({
  childCountOverride,
  data,
  displayProps,
  item,
  variant,
}: Pick<
  ListRowBodyProps,
  "childCountOverride" | "data" | "displayProps" | "item"
> & {
  variant: "board" | "list"
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

  return {
    childProgress,
    dueDateLabel,
    idProperty: renderWorkItemDisplayProperty({
      data,
      item,
      property: "id",
      variant,
      childProgress,
      dueDateLabel,
      isOverdue,
      isSoon,
    }),
    subCount: childCountOverride ?? childProgress?.totalChildren ?? 0,
    visibleProperties: renderWorkItemDisplayProperties({
      data,
      item,
      displayProps: displayProps.filter((property) => property !== "id"),
      variant,
      childProgress,
      dueDateLabel,
      isOverdue,
      isSoon,
    }),
  }
}

function getListRowDisplayState({
  childCountOverride,
  data,
  displayProps,
  item,
}: Pick<
  ListRowBodyProps,
  "childCountOverride" | "data" | "displayProps" | "item"
>) {
  return getWorkSurfaceItemDisplayState({
    childCountOverride,
    data,
    displayProps,
    item,
    variant: "list",
  })
}

function ParentGroupItemSummary({
  accentVar,
  data,
  displayProps,
  groupCount,
  item,
  variant,
}: {
  accentVar?: string | null
  data: AppData
  displayProps: DisplayProperty[]
  groupCount: number
  item: WorkItem
  variant: "board" | "list"
}) {
  const { idProperty, visibleProperties } = getWorkSurfaceItemDisplayState({
    data,
    displayProps,
    item,
    variant,
  })

  return (
    <div
      data-testid={`parent-group-summary-${item.id}`}
      className={cn(
        "min-w-0 flex-1",
        variant === "board"
          ? "flex flex-col gap-1.5"
          : "flex items-center gap-2.5"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          aria-hidden
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ background: accentVar ?? "var(--text-3)" }}
        />
        <AppLink
          href={`/items/${item.id}`}
          aria-label={`Open parent ${item.title}`}
          className="flex min-w-0 items-center gap-1.5 rounded-sm focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
        >
          {idProperty}
          <span
            className={cn(
              "truncate font-medium text-foreground",
              variant === "board" ? "text-[12.5px]" : "text-[13px]"
            )}
          >
            {item.title}
          </span>
        </AppLink>
        <AppLink
          href={`/items/${item.id}`}
          aria-label={`Open ${item.title}`}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-fg-3 uppercase transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
        >
          <SidebarSimple className="size-3" />
          <span>Open</span>
        </AppLink>
        <span className="shrink-0 text-[11.5px] font-normal text-fg-3 tabular-nums">
          {groupCount}
        </span>
      </div>
      {visibleProperties.length > 0 ? (
        <div
          className={cn(
            "flex min-w-0 items-center gap-1.5 text-[11.5px] text-fg-3",
            variant === "board" ? "flex-wrap pl-4" : "shrink-0 overflow-hidden"
          )}
        >
          {visibleProperties.map(({ key, node }) => (
            <span key={key} className="contents">
              {node}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ListRowDisclosure({
  expanded,
  hasChildren,
  slotClassName,
  onToggleExpanded,
}: {
  expanded: boolean
  hasChildren: boolean
  slotClassName: string
  onToggleExpanded?: () => void
}) {
  if (!hasChildren) {
    return <span aria-hidden className={slotClassName} />
  }

  return (
    <button
      type="button"
      aria-label={expanded ? "Collapse sub-issues" : "Expand sub-issues"}
      aria-expanded={expanded}
      className={cn(
        "inline-grid place-items-center rounded-sm text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground",
        slotClassName
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
  )
}

function ListRowLinkedContent({
  idProperty,
  item,
  subCount,
}: {
  idProperty: ReactNode
  item: WorkItem
  subCount: number
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden px-2.5">
      {idProperty}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <div className="truncate text-[13px] text-foreground">{item.title}</div>
        <WorkItemChildCount count={subCount} />
      </div>
    </div>
  )
}

function ListRowLinkSlot({
  children,
  interactive,
  itemId,
}: {
  children: ReactNode
  interactive: boolean
  itemId: string
}) {
  if (!interactive) {
    return (
      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
        {children}
      </div>
    )
  }

  return (
    <AppLink
      href={`/items/${itemId}`}
      className="flex min-w-0 flex-1 items-center overflow-hidden"
    >
      {children}
    </AppLink>
  )
}

function ListRowDisplayProperties({
  interactive,
  visibleProperties,
}: {
  interactive: boolean
  visibleProperties: ReturnType<typeof renderWorkItemDisplayProperties>
}) {
  if (visibleProperties.length === 0) {
    return interactive ? <div className="pr-10" /> : null
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-hidden pr-10">
      {visibleProperties.map(({ key, node }) => (
        <span key={key} className="contents">
          {node}
        </span>
      ))}
    </div>
  )
}

function ListRowHoverActions({
  data,
  interactive,
  item,
}: {
  data: AppData
  interactive: boolean
  item: WorkItem
}) {
  if (!interactive) {
    return null
  }

  return (
    <div className="absolute top-1/2 right-3.5 -translate-y-1/2 opacity-0 transition-opacity group-hover/row:opacity-100">
      <IssueActionMenu
        data={data}
        item={item}
        triggerClassName="rounded-md border border-line bg-surface px-1.5 py-0.5 shadow-sm hover:bg-surface-3"
      />
    </div>
  )
}

function ListRowContextMenuSlot({
  children,
  data,
  interactive,
  item,
}: {
  children: ReactNode
  data: AppData
  interactive: boolean
  item: WorkItem
}) {
  const router = useAppRouter()

  return interactive ? (
    <IssueContextMenu
      data={data}
      item={item}
      onEditItem={() => router.push(`/items/${item.id}`)}
    >
      {children}
    </IssueContextMenu>
  ) : (
    children
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
}: ListRowBodyProps) {
  const { idProperty, subCount, visibleProperties } = getListRowDisplayState({
    childCountOverride,
    data,
    displayProps,
    item,
  })
  const disclosureSlotClass = depth === 0 ? "size-5" : "size-4"

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
        <ListRowDisclosure
          expanded={expanded}
          hasChildren={hasChildren}
          slotClassName={disclosureSlotClass}
          onToggleExpanded={onToggleExpanded}
        />
        <ListRowLinkSlot interactive={interactive} itemId={item.id}>
          <ListRowLinkedContent
            idProperty={idProperty}
            item={item}
            subCount={subCount}
          />
        </ListRowLinkSlot>
        <ListRowDisplayProperties
          interactive={interactive}
          visibleProperties={visibleProperties}
        />
        <ListRowHoverActions
          data={data}
          interactive={interactive}
          item={item}
        />
      </div>
    </div>
  )

  return (
    <ListRowContextMenuSlot data={data} interactive={interactive} item={item}>
      {body}
    </ListRowContextMenuSlot>
  )
}

const ListRow = memo(function ListRow(props: ListRowProps) {
  return <ListRowBody {...props} />
})

function DraggableWorkSurfaceItem({
  children,
  dropId,
  itemId,
}: {
  children: (
    args: DraggableBindings & {
      isDropTarget: boolean
    }
  ) => ReactNode
  dropId: string
  itemId: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: itemId,
  })
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({
    id: dropId,
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
      {children({
        attributes,
        listeners,
        isDropTarget: isOver && !isDragging,
      })}
    </div>
  )
}

function DraggableListRow(props: ListRowProps) {
  const { item } = props

  return (
    <DraggableWorkSurfaceItem itemId={item.id} dropId={`list-item::${item.id}`}>
      {({ attributes, isDropTarget, listeners }) => (
        <ListRowBody
          {...props}
          isDropTarget={isDropTarget}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      )}
    </DraggableWorkSurfaceItem>
  )
}

function BoardGroupHeader({
  id,
  accentVar,
  data,
  displayProps,
  groupLabel,
  groupCount,
  parentItem,
}: {
  id: string
  accentVar?: string | null
  data: AppData
  displayProps: DisplayProperty[]
  groupLabel: string
  groupCount: number
  parentItem?: WorkItem | null
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/col flex items-center justify-between gap-2 px-3 py-2.5 transition-colors",
        isOver && "bg-surface-2"
      )}
    >
      {parentItem ? (
        <div className="flex min-w-0 flex-1 rounded-md border border-line-soft bg-surface px-3 py-2">
          <ParentGroupItemSummary
            accentVar={accentVar}
            data={data}
            displayProps={displayProps}
            groupCount={groupCount}
            item={parentItem}
            variant="board"
          />
        </div>
      ) : (
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
      )}
    </div>
  )
}

function BoardSubgroupHeader({
  data,
  displayProps,
  groupCount,
  groupLabel,
  parentItem,
}: {
  data: AppData
  displayProps: DisplayProperty[]
  groupCount: number
  groupLabel: string
  parentItem?: WorkItem | null
}) {
  if (parentItem) {
    return (
      <div className="px-1 pb-1">
        <div className="flex rounded-md border border-line-soft bg-surface px-3 py-2">
          <ParentGroupItemSummary
            data={data}
            displayProps={displayProps}
            groupCount={groupCount}
            item={parentItem}
            variant="board"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
      {groupLabel}
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

const DraggableWorkCard = memo(function DraggableWorkCard({
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
  return (
    <DraggableWorkSurfaceItem
      itemId={item.id}
      dropId={`board-item::${item.id}`}
    >
      {({ attributes, isDropTarget, listeners }) => (
        <BoardCardBody
          data={data}
          item={item}
          displayProps={displayProps}
          childCountOverride={childCountOverride}
          details={details}
          isDropTarget={isDropTarget}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      )}
    </DraggableWorkSurfaceItem>
  )
})

const BoardCardBody = memo(function BoardCardBody({
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
  const router = useAppRouter()
  const { idProperty, subCount, visibleProperties } =
    getWorkSurfaceItemDisplayState({
      childCountOverride,
      data,
      displayProps,
      item,
      variant: "board",
    })
  const itemHref = `/items/${item.id}`

  return (
    <IssueContextMenu
      data={data}
      item={item}
      onEditItem={() => router.push(itemHref)}
    >
      <div
        className={cn(
          "group/card relative flex cursor-grab touch-none flex-col gap-2 rounded-[8px] border border-line bg-surface px-3 py-2.5 transition-all hover:border-[color:var(--text-4)] hover:shadow-sm active:cursor-grabbing",
          isDropTarget && "border-fg-4 bg-surface-2"
        )}
        {...dragAttributes}
        {...dragListeners}
      >
        <AppLink
          href={itemHref}
          aria-label={`Open ${item.title}`}
          className="absolute inset-0 rounded-[8px] focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
        />
        <div className="pointer-events-none relative z-10 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {idProperty || subCount > 0 ? (
              <div className="mb-1 flex items-center gap-1.5">
                {idProperty}
                <WorkItemChildCount count={subCount} />
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="flex min-w-0 items-start gap-1.5">
                <div className="min-w-0 text-[13px] leading-[1.35] font-medium text-foreground">
                  {item.title}
                </div>
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
})

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
            const childAssignee =
              (child.visibility ?? "team") !== "private" &&
              getWorkItemAssigneeIds(child)[0]
                ? getUser(data, getWorkItemAssigneeIds(child)[0])
                : null

            return editable ? (
              <DraggableBoardChildItem
                key={child.id}
                item={child}
                assignee={childAssignee}
              />
            ) : (
              <AppLink
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
              </AppLink>
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
  } = useDraggable({
    id: item.id,
    data: {
      previewKind: "child",
    },
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
