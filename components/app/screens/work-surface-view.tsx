"use client"

import { AppLink, useAppRouter } from "@/lib/browser/app-navigation"
import {
  memo,
  useEffect,
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
  ArrowSquareOut,
  Check,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  Plus,
  SidebarSimple,
  Tag,
  TreeStructure,
} from "@phosphor-icons/react"

import {
  buildItemGroups,
  buildItemGroupsWithEmptyGroups,
  getDirectChildWorkItemsForDisplay,
  getHiddenItemGroupEntries,
  getParentGroupHeaderIds,
  getTeam,
  getUser,
  getVisibleItemGroupEntries,
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
  type Priority,
  type TeamExperienceType,
  type ViewDefinition,
  type WorkItem,
  type WorkItemType,
  type WorkItemVisibility,
  getCustomPropertyIdFromDisplayReference,
  workStatuses,
} from "@/lib/domain/types"
import {
  isCustomPropertyDefinitionForWorkItem,
  sortLabelsByName,
} from "@/lib/domain/labels"
import { getWorkItemAssigneeIds } from "@/lib/domain/work-item-assignees"
import { useAppStore } from "@/lib/store/app-store"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
  StatusRing,
} from "@/components/ui/template-primitives"

import {
  IssueActionMenu,
  IssueContextMenu,
  stopMenuEvent,
  stopDragPropagation,
} from "./work-item-menus"
import {
  getWorkItemSelectionContextItems,
  useWorkItemSelection,
  WorkItemSelectionCheckbox,
  type WorkItemSelectionController,
} from "./work-item-selection"
import { WorkItemAssigneeAvatar, WorkItemTypeBadge } from "./work-item-ui"
import {
  getCreateDefaultsForField,
  LabelColorDot,
  useWorkItemLabelEditorState,
} from "./shared"
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
const LIST_ROW_ACTION_RESERVED_CLASS = "pr-12"
const LIST_ROW_ACTION_OFFSET_CLASS = "right-5"

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

function useClearMissingSelectedItem({
  items,
  onSelectedItemIdChange,
  selectedItemId,
}: {
  items: WorkItem[]
  onSelectedItemIdChange?: (itemId: string | null) => void
  selectedItemId?: string | null
}) {
  useEffect(() => {
    if (!selectedItemId) {
      return
    }

    if (!items.some((item) => item.id === selectedItemId)) {
      onSelectedItemIdChange?.(null)
    }
  }, [items, onSelectedItemIdChange, selectedItemId])
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
    ...(editable || isParentGroupingField(view.grouping)
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

  const parentIds = getParentGroupHeaderIds(sourceItems)

  if (parentIds.size === 0) {
    return items
  }

  const displayPool = view.showChildItems ? sourceItems : items

  return displayPool.filter((item) => !parentIds.has(item.id))
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
type WorkSurfaceCreateDefaultPatch = Partial<
  Pick<
    WorkItem,
    | "status"
    | "priority"
    | "assigneeId"
    | "primaryProjectId"
    | "labelIds"
    | "parentId"
    | "visibility"
  >
>

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
  ...patches: Array<WorkSurfaceCreateDefaultPatch | null | undefined>
) {
  const merged = Object.assign(
    {},
    ...patches.filter((patch): patch is WorkSurfaceCreateDefaultPatch =>
      Boolean(patch)
    )
  ) as WorkSurfaceCreateDefaultPatch
  const labelSources = patches
    .map((patch) => patch?.labelIds)
    .filter((labelIds): labelIds is string[] => labelIds !== undefined)

  if (labelSources.length > 0) {
    merged.labelIds = [...new Set(labelSources.flat())]
  }

  return merged
}

function getSingleFilterValue<T>(values: T[] | undefined) {
  return values?.length === 1 ? values[0] : undefined
}

function isWorkItemStatus(
  value: string | undefined
): value is WorkItem["status"] {
  return Boolean(value && workStatuses.includes(value as WorkItem["status"]))
}

function getCreateDefaultsFromFilters(view: Pick<ViewDefinition, "filters">): {
  defaultTeamId?: string | null
  initialType?: WorkItemType | null
  patch: WorkSurfaceCreateDefaultPatch
} {
  const status = getSingleFilterValue(view.filters.status)
  const priority = getSingleFilterValue(view.filters.priority)
  const projectId = getSingleFilterValue(view.filters.projectIds)
  const teamId = getSingleFilterValue(view.filters.teamIds)
  const itemType = getSingleFilterValue(view.filters.itemTypes)
  const labelId = getSingleFilterValue(view.filters.labelIds)
  const visibility = getSingleFilterValue(view.filters.visibility)
  const createsPrivateWorkItem = visibility === "private"

  return {
    defaultTeamId: teamId,
    initialType: itemType,
    patch: {
      ...(isWorkItemStatus(status) ? { status } : {}),
      ...(priority ? { priority: priority as Priority } : {}),
      ...(createsPrivateWorkItem
        ? { primaryProjectId: null }
        : projectId
          ? { primaryProjectId: projectId }
          : {}),
      ...(labelId ? { labelIds: [labelId] } : {}),
      ...(visibility ? { visibility } : {}),
    },
  }
}

export function getWorkSurfaceCreateDefaultsFromView({
  createContext,
  view,
}: {
  createContext?: WorkSurfaceCreateContext
  view: Pick<ViewDefinition, "filters">
}) {
  const filterDefaults = getCreateDefaultsFromFilters(view)
  const defaultValues = getCreateDefaultValues({
    createContext,
    groupedPatch: filterDefaults.patch,
  })

  return {
    defaultTeamId: filterDefaults.defaultTeamId ?? createContext?.defaultTeamId,
    defaultProjectId: defaultValues.primaryProjectId,
    initialType:
      filterDefaults.initialType ??
      (defaultValues.visibility === "private" ? ("task" as const) : null),
    defaultValues,
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
  groupedPatch: WorkSurfaceCreateDefaultPatch
}) {
  const visibility = groupedPatch.visibility ?? createContext?.defaultVisibility
  const createsPrivateWorkItem = visibility === "private"
  const hasExplicitProjectDefault = Object.hasOwn(
    groupedPatch,
    "primaryProjectId"
  )

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
      : hasExplicitProjectDefault
        ? groupedPatch.primaryProjectId
        : createContext?.defaultProjectId,
    labelIds: groupedPatch.labelIds,
    parentId: groupedPatch.parentId ?? null,
    visibility,
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
  view: Pick<ViewDefinition, "filters" | "grouping" | "subGrouping">
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
  const filterDefaults = getCreateDefaultsFromFilters(view)
  const groupedPatch = mergeCreateDefaultPatches(
    filterDefaults.patch,
    groupDefaults.patch,
    subgroupDefaults?.patch
  )

  return {
    defaultTeamId: getCreateDefaultTeamId({
      baseItem,
      createContext,
      groupDefaults: {
        ...groupDefaults,
        defaultTeamId:
          groupDefaults.defaultTeamId ?? filterDefaults.defaultTeamId,
      },
      subgroupDefaults,
    }),
    initialType:
      subgroupDefaults?.initialType ??
      groupDefaults.initialType ??
      filterDefaults.initialType ??
      null,
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
  view: Pick<ViewDefinition, "filters" | "grouping" | "subGrouping">
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
  selectedItemId?: string | null
  onSelectedItemIdChange?: (itemId: string | null) => void
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

function getWorkSurfaceLaneControls({
  createContext,
  data,
  items,
  scopedItems,
  setExpandedItemIds,
  view,
  visibleGroups,
}: {
  createContext?: WorkSurfaceCreateContext
  data: AppData
  items: WorkItem[]
  scopedItems?: WorkItem[]
  setExpandedItemIds: Dispatch<SetStateAction<Set<string>>>
  view: ViewDefinition
  visibleGroups: Array<[string, Map<string, WorkItem[]>]>
}) {
  return {
    openCreateForGroup: createWorkSurfaceGroupCreateHandler({
      createContext,
      data,
      items,
      scopedItems,
      view,
    }),
    toggleExpandedItem: (itemId: string) =>
      toggleSetMember(setExpandedItemIds, itemId),
    ungroupedLaneItems: !view.grouping
      ? getUngroupedLaneItems(visibleGroups)
      : [],
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
  editable: boolean
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
  editable,
  item,
  variant,
}: WorkItemDisplayPropertyContext) {
  if (editable) {
    return (
      <WorkItemLabelsPropertyControl
        data={data}
        item={item}
        variant={variant}
      />
    )
  }

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

function getSurfaceItemWorkspaceId(data: AppData, item: WorkItem) {
  if ((item.visibility ?? "team") === "private") {
    return item.workspaceId ?? null
  }

  return item.workspaceId ?? getTeam(data, item.teamId)?.workspaceId ?? null
}

function stopWorkSurfaceControlEvent(event: { stopPropagation: () => void }) {
  event.stopPropagation()
}

function getLabelTriggerLabel(selectedLabels: AppData["labels"]) {
  if (selectedLabels.length === 0) {
    return "Label"
  }

  const [firstLabel] = selectedLabels

  if (selectedLabels.length === 1) {
    return firstLabel?.name ?? "Label"
  }

  return `${firstLabel?.name ?? "Labels"} +${selectedLabels.length - 1}`
}

function WorkItemLabelsPropertyControl({
  data,
  item,
  variant,
}: {
  data: AppData
  item: WorkItem
  variant: "list" | "board"
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const workspaceId = getSurfaceItemWorkspaceId(data, item)
  const labels = useMemo(() => sortLabelsByName(data.labels), [data.labels])
  const { availableLabels, selectedLabels, toggleLabel } =
    useWorkItemLabelEditorState({
      item,
      labels,
      workspaceId,
    })
  const matches = availableLabels.filter((label) =>
    label.name.toLowerCase().includes(query.trim().toLowerCase())
  )
  const triggerLabel = getLabelTriggerLabel(selectedLabels)
  const visibleSelectedLabels = selectedLabels.slice(
    0,
    variant === "board" ? 2 : 1
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setQuery("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            selectedLabels.length > 0
              ? `Labels: ${selectedLabels.map((label) => label.name).join(", ")}`
              : "Label"
          }
          className={cn(
            META_CHIP_CLASS,
            selectedLabels.length === 0 &&
              "border-dashed bg-transparent text-fg-3"
          )}
          onPointerDown={stopDragPropagation}
          onClick={stopWorkSurfaceControlEvent}
        >
          {visibleSelectedLabels.length > 0 ? (
            visibleSelectedLabels.map((label) => (
              <span
                key={label.id}
                className="inline-flex min-w-0 items-center gap-1"
              >
                <LabelColorDot color={label.color} className="size-[7px]" />
                <span className="max-w-[88px] truncate">{label.name}</span>
              </span>
            ))
          ) : (
            <>
              <Tag className="size-3 shrink-0" />
              <span>{triggerLabel}</span>
            </>
          )}
          {selectedLabels.length > visibleSelectedLabels.length ? (
            <span className="text-fg-3">
              +{selectedLabels.length - visibleSelectedLabels.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[260px]")}
        onPointerDown={stopDragPropagation}
        onClick={stopWorkSurfaceControlEvent}
      >
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-[14px]" />}
          placeholder="Find label..."
          value={query}
          onChange={setQuery}
        />
        <PropertyPopoverList>
          <PropertyPopoverGroup>Labels</PropertyPopoverGroup>
          <PropertyPopoverItem
            muted
            selected={item.labelIds.length === 0}
            onClick={() =>
              useAppStore.getState().updateWorkItem(item.id, { labelIds: [] })
            }
            trailing={
              item.labelIds.length === 0 ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <Tag className="size-3.5 shrink-0 text-fg-3" />
            <span>No labels</span>
          </PropertyPopoverItem>
          {matches.map((label) => {
            const selected = item.labelIds.includes(label.id)

            return (
              <PropertyPopoverItem
                key={label.id}
                selected={selected}
                onClick={() => toggleLabel(label.id)}
                trailing={
                  selected ? (
                    <Check className="size-[14px] text-foreground" />
                  ) : null
                }
              >
                <LabelColorDot color={label.color} className="size-[7px]" />
                <span className="truncate">{label.name}</span>
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
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

  return (
    <CustomPropertyValueControl
      data={context.data}
      definition={definition}
      item={context.item}
      value={value ?? null}
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
  editable,
  isOverdue,
  isSoon,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  variant: "list" | "board"
  childProgress: ChildProgressRollup | null
  dueDateLabel: string | null
  editable: boolean
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
      editable,
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

type VisibleWorkSurfaceSelectionIdsInput = {
  childDisplayMode: ChildDisplayMode
  collapsedGroups?: Set<string>
  data: AppData
  displayItems: WorkItem[]
  expandedItemIds: Set<string>
  groups: Array<[string, Map<string, WorkItem[]>]>
  scopedItems?: WorkItem[]
  showChildItems: boolean
  view: ViewDefinition
}

function getExpandedChildSelectionIds(
  item: WorkItem,
  {
    childDisplayMode,
    data,
    expandedItemIds,
    scopedItems,
    showChildItems,
    view,
  }: VisibleWorkSurfaceSelectionIdsInput
) {
  if (!showChildItems || !expandedItemIds.has(item.id)) {
    return []
  }

  return getDirectChildWorkItemsForDisplay(
    data,
    item,
    view.ordering,
    view,
    scopedItems,
    {
      mode: childDisplayMode,
    }
  ).map((child) => child.id)
}

function getVisibleSubgroupSelectionIds(
  groupItems: WorkItem[],
  input: VisibleWorkSurfaceSelectionIdsInput
) {
  const visibleContainerItems = getContainerItemsForDisplay(
    groupItems,
    input.displayItems,
    input.showChildItems
  )

  return visibleContainerItems.flatMap((item) => [
    item.id,
    ...getExpandedChildSelectionIds(item, input),
  ])
}

function getVisibleGroupSelectionIds(
  groupName: string,
  subgroups: Map<string, WorkItem[]>,
  input: VisibleWorkSurfaceSelectionIdsInput
) {
  if (input.collapsedGroups?.has(groupName)) {
    return []
  }

  return Array.from(subgroups).flatMap(([subgroupName, groupItems]) =>
    input.view.hiddenState.subgroups.includes(subgroupName)
      ? []
      : getVisibleSubgroupSelectionIds(groupItems, input)
  )
}

function getVisibleWorkSurfaceSelectionIds(
  input: VisibleWorkSurfaceSelectionIdsInput
) {
  return input.groups.flatMap(([groupName, subgroups]) =>
    getVisibleGroupSelectionIds(groupName, subgroups, input)
  )
}

function useGroupedWorkSurfaceViewState({
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
  const groups = useMemoizedWorkSurfaceGroups({
    createContext,
    data,
    editable,
    items,
    scopedItems,
    view,
  })
  const sourceItems = scopedItems ?? items
  const displayItems = getParentGroupedDisplayItems(items, sourceItems, view)

  return {
    displayItems,
    hiddenGroups: getHiddenItemGroupEntries(groups, view.hiddenState),
    showChildItems: Boolean(view.showChildItems),
    sourceItems,
    visibleGroups: getVisibleItemGroupEntries(groups, view.hiddenState),
  }
}

function getWorkSurfaceGroupHeaderMeta({
  data,
  groupName,
  groupingExperience,
  sourceItems,
  subgroups,
  view,
}: {
  data: AppData
  groupName: string
  groupingExperience?: TeamExperienceType | null
  sourceItems: WorkItem[]
  subgroups: Map<string, WorkItem[]>
  view: ViewDefinition
}) {
  const groupItems = Array.from(subgroups.values()).flat()

  return {
    groupAccentVar: getGroupAccentVar(view.grouping, groupName),
    groupAdornment: getGroupValueAdornment(view.grouping, groupName),
    groupCount: groupItems.length,
    groupItems,
    groupLabel: getGroupValueLabel(view.grouping, groupName, {
      view,
      groupingExperience,
    }),
    parentGroupItem: getParentGroupItem({
      data,
      field: view.grouping,
      groupItems,
      sourceItems,
      value: groupName,
    }),
  }
}

function getUngroupedLaneItems(
  groups: Array<[string, Map<string, WorkItem[]>]>
) {
  return groups.flatMap(([, subgroups]) =>
    Array.from(subgroups.values()).flat()
  )
}

function getVisibleSubgroupEntries(
  view: ViewDefinition,
  subgroups: Map<string, WorkItem[]>
) {
  return Array.from(subgroups.entries()).filter(
    ([subgroupName]) => !view.hiddenState.subgroups.includes(subgroupName)
  )
}

function getParentSubgroupItem({
  data,
  sourceItems,
  subgroupItems,
  subgroupName,
  view,
}: {
  data: AppData
  sourceItems: WorkItem[]
  subgroupItems: WorkItem[]
  subgroupName: string
  view: ViewDefinition
}) {
  return getParentGroupItem({
    data,
    field: view.subGrouping,
    groupItems: subgroupItems,
    sourceItems,
    value: subgroupName,
  })
}

type WorkSurfaceSubgroupSectionsProps = {
  className: string
  data: AppData
  groupName: string
  groupingExperience?: TeamExperienceType | null
  footer?: ReactNode
  onOpenProperties?: (itemId: string | null) => void
  renderLane: (subgroupName: string, subItems: WorkItem[]) => ReactNode
  sourceItems: WorkItem[]
  subgroups: Map<string, WorkItem[]>
  variant: "board" | "list"
  view: ViewDefinition
}

function WorkSurfaceSubgroupSections({
  className,
  data,
  groupName,
  groupingExperience,
  footer,
  onOpenProperties,
  renderLane,
  sourceItems,
  subgroups,
  variant,
  view,
}: WorkSurfaceSubgroupSectionsProps) {
  const HeaderComponent =
    variant === "board" ? BoardSubgroupHeader : ListSubgroupHeader

  return (
    <div className={className}>
      {getVisibleSubgroupEntries(view, subgroups).map(
        ([subgroupName, subItems]) => {
          const parentSubgroupItem = getParentSubgroupItem({
            data,
            sourceItems,
            subgroupItems: subItems,
            subgroupName,
            view,
          })

          return (
            <div key={`${groupName}-${subgroupName}`}>
              {view.subGrouping ? (
                <HeaderComponent
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
                  onOpenProperties={onOpenProperties}
                />
              ) : null}
              {renderLane(subgroupName, subItems)}
            </div>
          )
        }
      )}
      {footer}
    </div>
  )
}

type WorkSurfaceItemLaneProps = {
  addButtonAlignment?: "grouped" | "ungrouped"
  childDisplayMode: ChildDisplayMode
  data: AppData
  displayItems: WorkItem[]
  displayProps: DisplayProperty[]
  editable: boolean
  expandedItemIds: Set<string>
  id: string
  laneItems: WorkItem[]
  onCreateItem?: () => void
  onOpenProperties?: (itemId: string | null) => void
  onToggleExpandedItem: (itemId: string) => void
  reserveSelectionSlot?: boolean
  rowAlignment?: "grouped" | "ungrouped"
  scopedItems?: WorkItem[]
  selection?: WorkItemSelectionController
  showChildItems: boolean
  view: ViewDefinition
  className?: string
}

function getLaneContainerItems({
  displayItems,
  laneItems,
  showChildItems,
}: Pick<
  WorkSurfaceItemLaneProps,
  "displayItems" | "laneItems" | "showChildItems"
>) {
  return getContainerItemsForDisplay(laneItems, displayItems, showChildItems)
}

function BoardItemLane(props: WorkSurfaceItemLaneProps) {
  const {
    childDisplayMode,
    data,
    displayProps,
    editable,
    expandedItemIds,
    id,
    onCreateItem,
    onOpenProperties,
    onToggleExpandedItem,
    scopedItems,
    selection,
    showChildItems,
    view,
    className,
  } = props
  const containerItems = getLaneContainerItems(props)

  return (
    <BoardDropLane id={id} className={className}>
      {containerItems.map((item) => {
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
            displayProps={displayProps}
            selection={selection}
            childCountOverride={getDisplayedChildCountOverride(
              childItems,
              childDisplayMode
            )}
            onOpenProperties={onOpenProperties}
            details={
              showChildItems ? (
                <WorkItemChildDisclosure
                  data={data}
                  item={item}
                  displayProps={displayProps}
                  childItems={childItems}
                  editable={editable}
                  expanded={expandedItemIds.has(item.id)}
                  selection={selection}
                  onOpenProperties={onOpenProperties}
                  onToggle={() => onToggleExpandedItem(item.id)}
                />
              ) : null
            }
          />
        )
      })}
      {editable && onCreateItem ? (
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-[12px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
          onClick={onCreateItem}
        >
          <Plus className="size-3.5" />
          <span>Add item</span>
        </button>
      ) : null}
      {!editable && containerItems.length === 0 ? (
        <div className="rounded-[6px] border-[1.5px] border-dashed border-line px-3 py-3.5 text-center text-[12px] text-fg-4">
          No items
        </div>
      ) : null}
    </BoardDropLane>
  )
}

function BoardUngroupedLane({
  childDisplayMode,
  data,
  displayItems,
  editable,
  expandedItemIds,
  laneItems,
  onCreateForGroup,
  onOpenProperties,
  onToggleExpandedItem,
  scopedItems,
  selection,
  showChildItems,
  view,
}: {
  childDisplayMode: ChildDisplayMode
  data: AppData
  displayItems: WorkItem[]
  editable: boolean
  expandedItemIds: Set<string>
  laneItems: WorkItem[]
  onCreateForGroup: (input: OpenCreateForGroupInput) => void
  onOpenProperties?: (itemId: string | null) => void
  onToggleExpandedItem: (itemId: string) => void
  scopedItems?: WorkItem[]
  selection?: WorkItemSelectionController
  showChildItems: boolean
  view: ViewDefinition
}) {
  return (
    <div className="flex w-[520px] max-w-[calc(100vw-2rem)] shrink-0 flex-col">
      <BoardItemLane
        id="board::all"
        className="min-h-24 flex-1"
        childDisplayMode={childDisplayMode}
        data={data}
        displayItems={displayItems}
        displayProps={view.displayProps}
        editable={editable}
        expandedItemIds={expandedItemIds}
        laneItems={laneItems}
        onCreateItem={
          editable
            ? () =>
                onCreateForGroup({
                  groupValue: "all",
                  laneItems,
                })
            : undefined
        }
        onOpenProperties={onOpenProperties}
        onToggleExpandedItem={onToggleExpandedItem}
        scopedItems={scopedItems}
        selection={selection}
        showChildItems={showChildItems}
        view={view}
      />
    </div>
  )
}

function BoardGroupColumn({
  childDisplayMode,
  data,
  displayItems,
  editable,
  expandedItemIds,
  groupName,
  groupingExperience,
  onCreateForGroup,
  onOpenProperties,
  onToggleExpandedItem,
  scopedItems,
  selection,
  showChildItems,
  sourceItems,
  subgroups,
  view,
}: {
  childDisplayMode: ChildDisplayMode
  data: AppData
  displayItems: WorkItem[]
  editable: boolean
  expandedItemIds: Set<string>
  groupName: string
  groupingExperience?: TeamExperienceType | null
  onCreateForGroup: (input: OpenCreateForGroupInput) => void
  onOpenProperties?: (itemId: string | null) => void
  onToggleExpandedItem: (itemId: string) => void
  scopedItems?: WorkItem[]
  selection?: WorkItemSelectionController
  showChildItems: boolean
  sourceItems: WorkItem[]
  subgroups: Map<string, WorkItem[]>
  view: ViewDefinition
}) {
  const {
    groupAccentVar,
    groupCount,
    groupItems,
    groupLabel,
    parentGroupItem,
  } = getWorkSurfaceGroupHeaderMeta({
    data,
    groupName,
    groupingExperience,
    sourceItems,
    subgroups,
    view,
  })

  return (
    <div className="flex w-[296px] shrink-0 flex-col rounded-xl border border-line-soft bg-bg-sunken">
      <BoardGroupHeader
        id={`board-group::${groupName}`}
        accentVar={groupAccentVar}
        groupLabel={groupLabel}
        groupCount={groupCount}
        data={data}
        displayProps={view.displayProps}
        parentItem={parentGroupItem}
        onOpenProperties={onOpenProperties}
      />
      <div
        aria-hidden
        className="mx-3 h-0.5 rounded-full opacity-60"
        style={{
          background: groupAccentVar ?? "var(--text-3)",
        }}
      />
      <WorkSurfaceSubgroupSections
        className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2"
        data={data}
        groupName={groupName}
        groupingExperience={groupingExperience}
        onOpenProperties={onOpenProperties}
        renderLane={(subgroupName, subItems) => (
          <BoardItemLane
            id={`board::${groupName}::${subgroupName}`}
            childDisplayMode={childDisplayMode}
            data={data}
            displayItems={displayItems}
            displayProps={view.displayProps}
            editable={editable}
            expandedItemIds={expandedItemIds}
            laneItems={subItems}
            onCreateItem={
              editable
                ? () =>
                    onCreateForGroup({
                      groupValue: groupName,
                      subgroupValue: subgroupName,
                      laneItems: subItems,
                    })
                : undefined
            }
            onOpenProperties={onOpenProperties}
            onToggleExpandedItem={onToggleExpandedItem}
            scopedItems={scopedItems}
            selection={selection}
            showChildItems={showChildItems}
            view={view}
          />
        )}
        sourceItems={sourceItems}
        subgroups={subgroups}
        variant="board"
        view={view}
        footer={
          subgroups.size === 0 ? (
            <BoardItemLane
              id={`board::${groupName}`}
              className="min-h-24 flex-1"
              childDisplayMode={childDisplayMode}
              data={data}
              displayItems={displayItems}
              displayProps={view.displayProps}
              editable={editable}
              expandedItemIds={expandedItemIds}
              laneItems={groupItems}
              onCreateItem={
                editable
                  ? () =>
                      onCreateForGroup({
                        groupValue: groupName,
                        laneItems: groupItems,
                      })
                  : undefined
              }
              onOpenProperties={onOpenProperties}
              onToggleExpandedItem={onToggleExpandedItem}
              scopedItems={scopedItems}
              selection={selection}
              showChildItems={showChildItems}
              view={view}
            />
          ) : null
        }
      />
    </div>
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
  selectedItemId,
  onSelectedItemIdChange,
}: WorkSurfaceViewProps) {
  const {
    displayItems,
    hiddenGroups,
    showChildItems,
    sourceItems,
    visibleGroups,
  } = useGroupedWorkSurfaceViewState({
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
  const selection = useWorkItemSelection(
    getVisibleWorkSurfaceSelectionIds({
      childDisplayMode,
      data,
      displayItems,
      expandedItemIds,
      groups: visibleGroups,
      scopedItems,
      showChildItems,
      view,
    })
  )
  useClearMissingSelectedItem({
    items: data.workItems,
    onSelectedItemIdChange,
    selectedItemId,
  })

  const { openCreateForGroup, toggleExpandedItem, ungroupedLaneItems } =
    getWorkSurfaceLaneControls({
    createContext,
    data,
    items,
    scopedItems,
      setExpandedItemIds,
    view,
      visibleGroups,
    })

  return (
    <DndContext
      collisionDetection={boardCollisionDetection}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ScrollArea className="h-full w-full">
            <div className="flex h-full min-w-max items-stretch gap-3 px-4 pt-3.5 pb-8">
              {!view.grouping ? (
                <BoardUngroupedLane
                  childDisplayMode={childDisplayMode}
                  data={data}
                  displayItems={displayItems}
                  editable={editable}
                  expandedItemIds={expandedItemIds}
                  laneItems={ungroupedLaneItems}
                  onCreateForGroup={openCreateForGroup}
                  onOpenProperties={onSelectedItemIdChange}
                  onToggleExpandedItem={toggleExpandedItem}
                  scopedItems={scopedItems}
                  selection={editable ? selection : undefined}
                  showChildItems={showChildItems}
                  view={view}
                />
              ) : (
                visibleGroups.map(([groupName, subgroups]) => (
                  <BoardGroupColumn
                    key={groupName}
                    childDisplayMode={childDisplayMode}
                    data={data}
                    displayItems={displayItems}
                    editable={editable}
                    expandedItemIds={expandedItemIds}
                    groupName={groupName}
                    groupingExperience={groupingExperience}
                    onCreateForGroup={openCreateForGroup}
                    onOpenProperties={onSelectedItemIdChange}
                    onToggleExpandedItem={toggleExpandedItem}
                    scopedItems={scopedItems}
                    selection={editable ? selection : undefined}
                    showChildItems={showChildItems}
                    sourceItems={sourceItems}
                    subgroups={subgroups}
                    view={view}
                  />
                ))
              )}
            </div>
          </ScrollArea>

          {view.grouping && hiddenGroups.length > 0 ? (
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
        </div>
      </div>

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

function ListItemLane(props: WorkSurfaceItemLaneProps) {
  const {
    addButtonAlignment = "grouped",
    childDisplayMode,
    data,
    displayProps,
    editable,
    expandedItemIds,
    id,
    onCreateItem,
    onOpenProperties,
    onToggleExpandedItem,
    reserveSelectionSlot = true,
    rowAlignment = "grouped",
    scopedItems,
    selection,
    showChildItems,
    view,
    className,
  } = props
  const containerItems = getLaneContainerItems(props)

  return (
    <ListDropLane id={id} className={className}>
      {containerItems.flatMap((item) => {
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
        const RowComponent = editable ? DraggableListRow : ListRow
        const parentRow = (
          <RowComponent
            key={item.id}
            data={data}
            item={item}
            displayProps={displayProps}
            selection={selection}
            depth={0}
            hasChildren={hasChildren}
            childCountOverride={getDisplayedChildCountOverride(
              children,
              childDisplayMode
            )}
            expanded={isExpanded}
            onOpenProperties={onOpenProperties}
            reserveSelectionSlot={reserveSelectionSlot}
            rowAlignment={rowAlignment}
            onToggleExpanded={() => onToggleExpandedItem(item.id)}
          />
        )

        if (!isExpanded || !hasChildren) {
          return [parentRow]
        }

        return [
          parentRow,
          ...children.map((child) => {
            const ChildRowComponent = editable ? DraggableListRow : ListRow

            return (
              <ChildRowComponent
                key={child.id}
                data={data}
                item={child}
                displayProps={displayProps}
                selection={selection}
                depth={1}
                onOpenProperties={onOpenProperties}
                reserveSelectionSlot={reserveSelectionSlot}
                rowAlignment={rowAlignment}
              />
            )
          }),
        ]
      })}
      {editable && onCreateItem ? (
        <ListAddItemButton
          alignment={addButtonAlignment}
          onClick={onCreateItem}
        />
      ) : null}
      {!editable && containerItems.length === 0 ? (
        <div className="px-11 py-3 text-xs text-muted-foreground">
          No items
        </div>
      ) : null}
    </ListDropLane>
  )
}

function ListAddItemButton({
  alignment,
  onClick,
}: {
  alignment: "grouped" | "ungrouped"
  onClick: () => void
}) {
  if (alignment === "grouped") {
    return (
      <button
        type="button"
        className="flex items-center gap-2.5 py-2 pr-2.5 pl-[45px] text-[12px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
        onClick={onClick}
      >
        <Plus className="size-3.5" />
        <span>Add item</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className="flex min-h-[34px] items-center gap-2.5 pr-2.5 text-[12px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
      style={{ paddingLeft: 14 }}
      onClick={onClick}
    >
      <span aria-hidden className="size-5 shrink-0" />
      <span className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden px-2.5">
        <Plus className="size-3.5 shrink-0" />
        <span>Add item</span>
      </span>
    </button>
  )
}

export function ListView(props: WorkSurfaceViewProps) {
  const data = props.data
  const items = props.items
  const scopedItems = props.scopedItems
  const view = props.view
  const editable = props.editable
  const groupingExperience = props.groupingExperience
  const childDisplayMode = props.childDisplayMode ?? "direct"
  const createContext = props.createContext
  const onToggleHiddenValue = props.onToggleHiddenValue
  const selectedItemId = props.selectedItemId
  const onSelectedItemIdChange = props.onSelectedItemIdChange
  const groupedState = useGroupedWorkSurfaceViewState(props)
  const displayItems = groupedState.displayItems
  const hiddenGroups = groupedState.hiddenGroups
  const showChildItems = groupedState.showChildItems
  const sourceItems = groupedState.sourceItems
  const visibleGroups = groupedState.visibleGroups
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
  const selection = useWorkItemSelection(
    getVisibleWorkSurfaceSelectionIds({
      childDisplayMode,
      collapsedGroups,
      data,
      displayItems,
      expandedItemIds,
      groups: visibleGroups,
      scopedItems,
      showChildItems,
      view,
    })
  )
  useClearMissingSelectedItem({
    items: data.workItems,
    onSelectedItemIdChange,
    selectedItemId,
  })

  function toggleGroup(groupName: string) {
    toggleSetMember(setCollapsedGroups, groupName)
  }

  const { openCreateForGroup, toggleExpandedItem, ungroupedLaneItems } =
    getWorkSurfaceLaneControls({
    createContext,
    data,
    items,
    scopedItems,
      setExpandedItemIds,
    view,
      visibleGroups,
    })

  return (
    <DndContext
      collisionDetection={listCollisionDetection}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-10">
          {!view.grouping ? (
            <ListItemLane
              id="list::all"
              addButtonAlignment="ungrouped"
              childDisplayMode={childDisplayMode}
              data={data}
              displayItems={displayItems}
              displayProps={view.displayProps}
              editable={editable}
              expandedItemIds={expandedItemIds}
              laneItems={ungroupedLaneItems}
              onCreateItem={
                editable
                  ? () =>
                      openCreateForGroup({
                        groupValue: "all",
                        laneItems: ungroupedLaneItems,
                      })
                  : undefined
              }
              onOpenProperties={onSelectedItemIdChange}
              onToggleExpandedItem={toggleExpandedItem}
              reserveSelectionSlot={false}
              rowAlignment="ungrouped"
              scopedItems={scopedItems}
              selection={editable ? selection : undefined}
              showChildItems={showChildItems}
              view={view}
            />
          ) : (
            visibleGroups.map(([groupName, subgroups]) => {
            const {
              groupAccentVar,
              groupAdornment,
              groupCount,
              groupItems,
              groupLabel,
              parentGroupItem,
            } = getWorkSurfaceGroupHeaderMeta({
              data,
              groupName,
              groupingExperience,
              sourceItems,
              subgroups,
              view,
            })
            const isExpandable = groupCount > 0 || editable
            const isCollapsed = collapsedGroups.has(groupName)

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
                  onOpenProperties={onSelectedItemIdChange}
                  onClick={() => {
                    if (!isExpandable) {
                      return
                    }

                    toggleGroup(groupName)
                  }}
                />

                {isExpandable && !isCollapsed ? (
                  <WorkSurfaceSubgroupSections
                    className="flex flex-col"
                    data={data}
                    groupName={groupName}
                    groupingExperience={groupingExperience}
                    onOpenProperties={onSelectedItemIdChange}
                    renderLane={(subgroupName, subItems) => (
                      <ListItemLane
                        id={`list::${groupName}::${subgroupName}`}
                        childDisplayMode={childDisplayMode}
                        data={data}
                        displayItems={displayItems}
                        displayProps={view.displayProps}
                        editable={editable}
                        expandedItemIds={expandedItemIds}
                        laneItems={subItems}
                        onCreateItem={
                          editable
                            ? () =>
                                openCreateForGroup({
                                  groupValue: groupName,
                                  subgroupValue: subgroupName,
                                  laneItems: subItems,
                                })
                            : undefined
                        }
                        onOpenProperties={onSelectedItemIdChange}
                        onToggleExpandedItem={toggleExpandedItem}
                        scopedItems={scopedItems}
                        selection={editable ? selection : undefined}
                        showChildItems={showChildItems}
                        view={view}
                      />
                    )}
                    sourceItems={sourceItems}
                    subgroups={subgroups}
                    variant="list"
                    view={view}
                    footer={
                      subgroups.size === 0 ? (
                        <ListItemLane
                          id={`list::${groupName}`}
                          className="min-h-10"
                          childDisplayMode={childDisplayMode}
                          data={data}
                          displayItems={displayItems}
                          displayProps={view.displayProps}
                          editable={editable}
                          expandedItemIds={expandedItemIds}
                          laneItems={groupItems}
                          onCreateItem={
                            editable
                              ? () =>
                                  openCreateForGroup({
                                    groupValue: groupName,
                                    laneItems: groupItems,
                                  })
                              : undefined
                          }
                          onOpenProperties={onSelectedItemIdChange}
                          onToggleExpandedItem={toggleExpandedItem}
                          scopedItems={scopedItems}
                          selection={editable ? selection : undefined}
                          showChildItems={showChildItems}
                          view={view}
                        />
                      ) : null
                    }
                  />
                ) : null}
              </div>
            )
            })
          )}

          {view.grouping && hiddenGroups.length > 0 ? (
            <div className="border-t border-line-soft px-4 py-3">
              <div className="mb-2 text-xs text-muted-foreground">
                Hidden rows
              </div>
              {hiddenGroups.map(([groupName]) => (
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
                  <span className="ml-auto text-xs text-muted-foreground">
                    0
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
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
  onOpenProperties,
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
  onOpenProperties?: (itemId: string) => void
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
              onOpenProperties={onOpenProperties}
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
      <div
        className={cn(
          "flex w-full items-center gap-2.5 px-5 pt-2 pb-1.5 pl-3.5 text-left",
          isExpandable ? "group/grp" : "cursor-default"
        )}
      >
        <button
          type="button"
          aria-disabled={!isExpandable}
          aria-label={
            isCollapsed ? `Expand ${groupLabel}` : `Collapse ${groupLabel}`
          }
          className="grid size-5 shrink-0 place-items-center rounded-sm text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
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
      </div>
    </div>
  )
}

type WorkSurfaceSubgroupHeaderProps = {
  data: AppData
  displayProps: DisplayProperty[]
  groupCount: number
  groupLabel: string
  onOpenProperties?: (itemId: string) => void
  parentItem?: WorkItem | null
}

function ParentSubgroupHeader({
  className,
  contentClassName,
  data,
  displayProps,
  groupCount,
  item,
  onOpenProperties,
  variant,
}: {
  className: string
  contentClassName: string
  data: AppData
  displayProps: DisplayProperty[]
  groupCount: number
  item: WorkItem
  onOpenProperties?: (itemId: string) => void
  variant: "board" | "list"
}) {
  return (
    <div className={className}>
      <div className={contentClassName}>
        <ParentGroupItemSummary
          data={data}
          displayProps={displayProps}
          groupCount={groupCount}
          item={item}
          onOpenProperties={onOpenProperties}
          variant={variant}
        />
      </div>
    </div>
  )
}

function ListSubgroupHeader(props: WorkSurfaceSubgroupHeaderProps) {
  if (props.parentItem) {
    return (
      <ParentSubgroupHeader
        className="px-11 py-1.5"
        contentClassName="flex min-h-9 min-w-0 items-center rounded-md border border-line-soft bg-surface px-3 py-1.5"
        data={props.data}
        displayProps={props.displayProps}
        groupCount={props.groupCount}
        item={props.parentItem}
        onOpenProperties={props.onOpenProperties}
        variant="list"
      />
    )
  }

  return (
    <div className="px-11 py-1.5 text-[11px] font-medium tracking-[0.04em] text-fg-3 uppercase">
      {props.groupLabel}
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
  selection?: WorkItemSelectionController
  onOpenProperties?: (itemId: string) => void
  reserveSelectionSlot?: boolean
  rowAlignment?: "grouped" | "ungrouped"
}

type ListRowProps = Omit<
  ListRowBodyProps,
  "dragAttributes" | "dragListeners" | "interactive" | "isDropTarget"
>

function getWorkSurfaceItemDisplayState({
  childCountOverride,
  data,
  displayProps,
  editable = false,
  item,
  variant,
}: Pick<
  ListRowBodyProps,
  "childCountOverride" | "data" | "displayProps" | "item"
> & {
  editable?: boolean
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
      editable,
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
      editable,
      isOverdue,
      isSoon,
    }),
  }
}

function getListRowDisplayState({
  childCountOverride,
  data,
  displayProps,
  editable,
  item,
}: Pick<
  ListRowBodyProps,
  "childCountOverride" | "data" | "displayProps" | "item"
> & {
  editable: boolean
}) {
  return getWorkSurfaceItemDisplayState({
    childCountOverride,
    data,
    displayProps,
    editable,
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
  onOpenProperties,
  variant,
}: {
  accentVar?: string | null
  data: AppData
  displayProps: DisplayProperty[]
  groupCount: number
  item: WorkItem
  onOpenProperties?: (itemId: string) => void
  variant: "board" | "list"
}) {
  const { idProperty, visibleProperties } = getWorkSurfaceItemDisplayState({
    data,
    displayProps,
    item,
    variant,
  })

  const propertyButton = onOpenProperties ? (
    <button
      type="button"
      aria-label={`Open properties for ${item.title}`}
      title="Open properties"
      data-no-drag="true"
      className="inline-grid size-6 shrink-0 place-items-center rounded-md text-fg-3 opacity-0 transition-opacity group-hover/parent-summary:opacity-100 hover:bg-surface-3 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
      onPointerDown={stopDragPropagation}
      onMouseDown={stopDragPropagation}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onOpenProperties(item.id)
      }}
    >
      <SidebarSimple className="size-4" />
    </button>
  ) : null

  const actions = (
    <div className="flex shrink-0 items-center gap-1">
      <WorkItemChildCount count={groupCount} />
      <AppLink
        href={`/items/${item.id}`}
        aria-label={`Open ${item.title}`}
        title="Open"
        className="inline-grid size-6 shrink-0 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
      >
        <ArrowSquareOut className="size-3.5" />
      </AppLink>
    </div>
  )

  if (variant === "board") {
    return (
      <div
        data-testid={`parent-group-summary-${item.id}`}
        className="group/parent-summary flex min-w-0 flex-1 flex-col gap-1.5"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ background: accentVar ?? "var(--text-3)" }}
          />
          <AppLink
            href={`/items/${item.id}`}
            aria-label={`Open parent ${item.title}`}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
          >
            {idProperty}
          </AppLink>
          {propertyButton}
          {actions}
        </div>
        <AppLink
          href={`/items/${item.id}`}
          aria-label={`Open parent title ${item.title}`}
          className="block min-w-0 rounded-sm pl-4 text-[12.5px] font-medium text-foreground focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
        >
          <span className="block truncate">{item.title}</span>
        </AppLink>
        {visibleProperties.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 pl-4 text-[11.5px] text-fg-3">
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

  return (
    <div
      data-testid={`parent-group-summary-${item.id}`}
      className="group/parent-summary flex min-w-0 flex-1 items-center gap-2.5"
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
          <span className="truncate text-[13px] font-medium text-foreground">
            {item.title}
          </span>
        </AppLink>
        {propertyButton}
        {actions}
      </div>
      {visibleProperties.length > 0 ? (
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-hidden text-[11.5px] text-fg-3">
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
  interactive,
  item,
  onOpenProperties,
  subCount,
}: {
  idProperty: ReactNode
  interactive: boolean
  item: WorkItem
  onOpenProperties?: (itemId: string) => void
  subCount: number
}) {
  const content = (
    <>
      {idProperty}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <div className="truncate text-[13px] text-foreground">{item.title}</div>
        <WorkItemChildCount count={subCount} />
      </div>
    </>
  )

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden px-2.5">
      {interactive ? (
        <AppLink
          href={`/items/${item.id}`}
          className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden"
        >
          {content}
        </AppLink>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          {content}
        </div>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {onOpenProperties ? (
          <button
            type="button"
            aria-label={`Open properties for ${item.title}`}
            title="Open properties"
            className="grid size-5 shrink-0 place-items-center text-fg-3 opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
            onPointerDown={stopDragPropagation}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenProperties(item.id)
            }}
          >
            <SidebarSimple className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
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
    return interactive ? (
      <div className={LIST_ROW_ACTION_RESERVED_CLASS} />
    ) : null
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 overflow-hidden",
        LIST_ROW_ACTION_RESERVED_CLASS
      )}
    >
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
    <div
      className={cn(
        "absolute top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover/row:opacity-100",
        LIST_ROW_ACTION_OFFSET_CLASS
      )}
    >
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
  displayProps,
  interactive,
  item,
  selection,
}: {
  children: ReactNode
  data: AppData
  displayProps: DisplayProperty[]
  interactive: boolean
  item: WorkItem
  selection?: WorkItemSelectionController
}) {
  const router = useAppRouter()
  const targetItems = getWorkItemSelectionContextItems({
    data,
    item,
    selection,
  })

  return interactive ? (
    <IssueContextMenu
      data={data}
      displayProps={displayProps}
      item={item}
      onEditItem={() => router.push(`/items/${item.id}`)}
      targetItems={targetItems}
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
  selection,
  onOpenProperties,
  reserveSelectionSlot = true,
  rowAlignment = "grouped",
}: ListRowBodyProps) {
  const { idProperty, subCount, visibleProperties } = getListRowDisplayState({
    childCountOverride,
    data,
    displayProps,
    editable: Boolean(selection),
    item,
  })
  const disclosureSlotClass = depth === 0 ? "size-5" : "size-4"
  const basePaddingLeft = 14
  const depthIndent = 24
  const rowPaddingLeft = basePaddingLeft + depth * depthIndent
  const usesOverlaySelection = rowAlignment === "ungrouped" && Boolean(selection)
  const hasInlineSelectionSlot =
    !usesOverlaySelection && (Boolean(selection) || reserveSelectionSlot)
  const selectionOverlayLeft =
    rowPaddingLeft + (depth === 0 ? 20 : 16) + 2

  const body = (
    <div
      className={cn(
        "group/row relative transition-colors hover:bg-surface-2",
        selection?.isSelected(item.id) && "bg-surface-2",
        isDropTarget && "bg-surface-2"
      )}
      onClick={(event) => selection?.handleModifiedClick(item.id, event)}
      onContextMenu={() => selection?.handleContextMenu(item.id)}
      {...dragAttributes}
      {...dragListeners}
    >
      <div
        className="flex min-h-[34px] items-center gap-2.5 pr-5"
        style={{ paddingLeft: rowPaddingLeft }}
      >
        <ListRowDisclosure
          expanded={expanded}
          hasChildren={hasChildren}
          slotClassName={disclosureSlotClass}
          onToggleExpanded={onToggleExpanded}
        />
        {hasInlineSelectionSlot ? (
          <div
            className={cn(
              "flex items-center justify-center",
              selection &&
                "opacity-0 transition-opacity group-hover/row:opacity-100",
              selection?.isSelected(item.id) && "opacity-100"
            )}
          >
            {selection ? (
              <WorkItemSelectionCheckbox
                checked={selection.isSelected(item.id)}
                label={`Select ${item.key}`}
                onChange={(event) =>
                  selection.handleCheckboxChange(item.id, event)
                }
              />
            ) : (
              <span aria-hidden className="size-4" />
            )}
          </div>
        ) : null}
        <ListRowLinkedContent
          idProperty={idProperty}
          interactive={interactive}
          item={item}
          onOpenProperties={onOpenProperties}
          subCount={subCount}
        />
        <ListRowDisplayProperties
          interactive={interactive}
          visibleProperties={visibleProperties}
        />
        {usesOverlaySelection && selection ? (
          <div
            className={cn(
              "absolute top-1/2 z-[1] flex -translate-y-1/2 items-center justify-center opacity-0 transition-opacity group-hover/row:opacity-100",
              selection.isSelected(item.id) && "opacity-100"
            )}
            style={{ left: selectionOverlayLeft }}
          >
            <WorkItemSelectionCheckbox
              checked={selection.isSelected(item.id)}
              label={`Select ${item.key}`}
              onChange={(event) =>
                selection.handleCheckboxChange(item.id, event)
              }
            />
          </div>
        ) : null}
        <ListRowHoverActions
          data={data}
          interactive={interactive}
          item={item}
        />
      </div>
    </div>
  )

  return (
    <ListRowContextMenuSlot
      data={data}
      displayProps={displayProps}
      interactive={interactive}
      item={item}
      selection={selection}
    >
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
  onOpenProperties,
  parentItem,
}: {
  id: string
  accentVar?: string | null
  data: AppData
  displayProps: DisplayProperty[]
  groupLabel: string
  groupCount: number
  onOpenProperties?: (itemId: string) => void
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
            onOpenProperties={onOpenProperties}
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

function BoardSubgroupHeader(props: WorkSurfaceSubgroupHeaderProps) {
  if (props.parentItem) {
    return (
      <ParentSubgroupHeader
        className="px-1 pb-1"
        contentClassName="flex rounded-md border border-line-soft bg-surface px-3 py-2"
        data={props.data}
        displayProps={props.displayProps}
        groupCount={props.groupCount}
        item={props.parentItem}
        onOpenProperties={props.onOpenProperties}
        variant="board"
      />
    )
  }

  return (
    <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
      {props.groupLabel}
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
  selection,
  childCountOverride,
  details,
  onOpenProperties,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  selection?: WorkItemSelectionController
  childCountOverride?: number
  details?: ReactNode
  onOpenProperties?: (itemId: string) => void
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
          selection={selection}
          childCountOverride={childCountOverride}
          details={details}
          isDropTarget={isDropTarget}
          dragAttributes={attributes}
          dragListeners={listeners}
          onOpenProperties={onOpenProperties}
        />
      )}
    </DraggableWorkSurfaceItem>
  )
})

const BoardCardBody = memo(function BoardCardBody({
  data,
  item,
  displayProps,
  selection,
  childCountOverride,
  details,
  isDropTarget = false,
  dragAttributes,
  dragListeners,
  onOpenProperties,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  selection?: WorkItemSelectionController
  childCountOverride?: number
  details?: ReactNode
  isDropTarget?: boolean
  dragAttributes?: DraggableBindings["attributes"]
  dragListeners?: DraggableBindings["listeners"]
  onOpenProperties?: (itemId: string) => void
}) {
  const router = useAppRouter()
  const { idProperty, subCount, visibleProperties } =
    getWorkSurfaceItemDisplayState({
      childCountOverride,
      data,
      displayProps,
      editable: Boolean(selection),
      item,
      variant: "board",
    })
  const itemHref = `/items/${item.id}`
  const selected = selection?.isSelected(item.id) ?? false
  const targetItems = getWorkItemSelectionContextItems({
    data,
    item,
    selection,
  })

  return (
    <IssueContextMenu
      data={data}
      displayProps={displayProps}
      item={item}
      onEditItem={() => router.push(itemHref)}
      targetItems={targetItems}
    >
      <div
        className={cn(
          "group/card relative flex cursor-grab touch-none flex-col gap-2 rounded-[8px] border border-line bg-surface px-3 py-2.5 transition-all hover:border-[color:var(--text-4)] hover:shadow-sm active:cursor-grabbing",
          selected && "border-line bg-surface-2",
          isDropTarget && "border-fg-4 bg-surface-2"
        )}
        onClickCapture={(event) =>
          selection?.handleModifiedClick(item.id, event)
        }
        onContextMenu={() => selection?.handleContextMenu(item.id)}
        {...dragAttributes}
        {...dragListeners}
      >
        <AppLink
          href={itemHref}
          aria-label={`Open ${item.title}`}
          className="absolute inset-0 rounded-[8px] focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
        />
        <div className="pointer-events-none relative z-10 flex items-start gap-2">
          {selection ? (
            <WorkItemSelectionCheckbox
              checked={selected}
              className={cn(
                "pointer-events-auto mt-px opacity-0 transition-opacity group-hover/card:opacity-100",
                selected && "opacity-100"
              )}
              label={`Select ${item.key}`}
              onChange={(event) =>
                selection.handleCheckboxChange(item.id, event)
              }
            />
          ) : null}
          <div className="min-w-0 flex-1">
            {idProperty || subCount > 0 ? (
              <div className="mb-1 flex items-center gap-1.5">
                {idProperty}
                <WorkItemChildCount count={subCount} />
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="truncate text-[13px] leading-[1.35] font-medium text-foreground">
                {item.title}
              </div>
            </div>
          </div>
          <div
            className="pointer-events-auto opacity-0 transition-opacity group-hover/card:opacity-100"
            onPointerDown={stopDragPropagation}
            onClick={stopMenuEvent}
          >
            <div className="flex items-center gap-1">
              {onOpenProperties ? (
                <button
                  type="button"
                  aria-label={`Open properties for ${item.title}`}
                  title="Open properties"
                  className="grid size-6 shrink-0 place-items-center rounded-sm text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:outline-none"
                  onPointerDown={stopDragPropagation}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onOpenProperties(item.id)
                  }}
                >
                  <SidebarSimple className="size-4" />
                </button>
              ) : null}
              <IssueActionMenu
                data={data}
                displayProps={displayProps}
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
  displayProps,
  childItems,
  editable,
  expanded,
  selection,
  onOpenProperties,
  onToggle,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  childItems: WorkItem[]
  editable: boolean
  expanded: boolean
  selection?: WorkItemSelectionController
  onOpenProperties?: (itemId: string) => void
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
                data={data}
                item={child}
                displayProps={displayProps}
                assignee={childAssignee}
                selection={selection}
                onOpenProperties={onOpenProperties}
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
  data,
  item,
  displayProps,
  assignee,
  selection,
  onOpenProperties,
}: {
  data: AppData
  item: WorkItem
  displayProps: DisplayProperty[]
  assignee: ReturnType<typeof getUser> | null
  selection?: WorkItemSelectionController
  onOpenProperties?: (itemId: string) => void
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
  const selected = selection?.isSelected(item.id) ?? false
  const targetItems = getWorkItemSelectionContextItems({
    data,
    item,
    selection,
  })
  const row = (
    <BoardChildItemRow
      item={item}
      assignee={assignee}
      interactive
      href={`/items/${item.id}`}
      isDropTarget={isOver && !isDragging}
      dragAttributes={attributes}
      dragListeners={listeners}
      onOpenProperties={onOpenProperties}
      selection={
        selection
          ? {
              checked: selected,
              label: `Select ${item.key}`,
              onChange: (event) =>
                selection.handleCheckboxChange(item.id, event),
              onContextMenu: () => selection.handleContextMenu(item.id),
              onModifiedClick: (event) =>
                selection.handleModifiedClick(item.id, event),
            }
          : undefined
      }
    />
  )

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && "opacity-60")}
    >
      <IssueContextMenu
        data={data}
        displayProps={displayProps}
        item={item}
        targetItems={targetItems}
      >
        {row}
      </IssueContextMenu>
    </div>
  )
}
