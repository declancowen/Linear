"use client"

import {
  forwardRef,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import {
  CalendarBlank,
  CaretDown,
  ChartBarHorizontal,
  Check,
  DotsSixVertical,
  Eye,
  EyeSlash,
  FadersHorizontal,
  FunnelSimple,
  MagnifyingGlass,
  Rows,
  SortAscending,
  SquaresFour,
  Stack,
  TreeStructure,
  X,
} from "@phosphor-icons/react"

import { ProjectIconGlyph, TeamIconGlyph } from "@/components/app/entity-icons"
import {
  getProjectStatusIconStatus,
  getReorderedDisplayPropertiesAfterDrag,
} from "@/components/app/screens/work-surface-control-state"
import { getStatusOrderForTeam, getTeam } from "@/lib/domain/selectors"
import {
  getCustomPropertyScopeType,
  getLabelScopeType,
  isCustomPropertyDefinitionVisibleToUser,
} from "@/lib/domain/labels"
import {
  getCustomPropertyIdFromDisplayReference,
  getChildWorkItemCopy,
  clearViewFilterSelections,
  getDefaultShowChildItemsForItemLevel,
  getDisplayLabelForWorkItemType,
  getWorkItemLevelTaxonomyGroups,
  getWorkItemLevelTaxonomyOptions,
  getExcludedGroupVisibilityHiddenState,
  getGroupVisibilityState,
  getNextGroupVisibilityHiddenState,
  projectHealthMeta,
  projectStatuses,
  projectStatusMeta,
  priorityMeta,
  statusMeta,
  workItemTypes,
  type BuiltinDisplayProperty,
  type DisplayProperty,
  type GroupField,
  type Label,
  type OrderingField,
  type Priority,
  type Project,
  type Team,
  type TeamExperienceType,
  type UserProfile,
  type ViewDefinition,
  type WorkItem,
  type WorkItemType,
  type WorkItemVisibility,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { getWorkItemAssigneeIds } from "@/lib/domain/work-item-assignees"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverFoot,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
  ViewTab,
} from "@/components/ui/template-primitives"

import {
  isPersistedViewFilterKey,
  toggleViewFilterValue,
  type ViewFilterKey,
} from "./helpers"
import { WorkItemAssigneeAvatar } from "./work-item-ui"
import {
  LabelColorDot,
  PriorityIcon,
  StatusIcon,
  WorkItemTypeIcon,
} from "./shared"
import {
  getContextualGroupFieldOptionLabel,
  getParentGroupingLabel,
} from "./work-grouping-labels"
import { cn } from "@/lib/utils"

const HEALTH_COLOR: Record<keyof typeof projectHealthMeta, string> = {
  "no-update": "var(--fg-4)",
  "on-track": "var(--status-done)",
  "at-risk": "var(--priority-medium)",
  "off-track": "var(--priority-high)",
}

const ORDERING_LABELS: Record<OrderingField, string> = {
  priority: "Priority",
  updatedAt: "Updated",
  createdAt: "Created",
  dueDate: "Due date",
  targetDate: "Target date",
  title: "Name",
  count: "Count",
}

const PROJECT_ORDERING_OPTIONS: OrderingField[] = [
  "priority",
  "updatedAt",
  "createdAt",
  "targetDate",
  "title",
]

const PROJECT_LAYOUT_OPTIONS: Array<{
  value: ViewDefinition["layout"]
  label: string
  icon: ReactNode
}> = [
  {
    value: "list",
    label: "List",
    icon: <Rows className="size-3.5" />,
  },
  {
    value: "board",
    label: "Board",
    icon: <SquaresFour className="size-3.5" />,
  },
]

const WORK_LAYOUT_OPTIONS: Array<{
  value: ViewDefinition["layout"]
  label: string
  icon: ReactNode
}> = [
  ...PROJECT_LAYOUT_OPTIONS,
  {
    value: "timeline",
    label: "Timeline",
    icon: <ChartBarHorizontal className="size-3.5" />,
  },
  {
    value: "calendar",
    label: "Calendar",
    icon: <CalendarBlank className="size-3.5" />,
  },
]

export const PROJECT_GROUP_OPTIONS: GroupField[] = [
  "status",
  "priority",
  "team",
  "assignee",
  "type",
]

export const PROJECT_DISPLAY_PROPERTY_OPTIONS: DisplayProperty[] = [
  "team",
  "assignee",
  "priority",
  "type",
  "dueDate",
  "created",
  "updated",
]

const chipBase =
  "inline-flex h-7 shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md border px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"

const chipDefault =
  "border-line bg-surface text-fg-2 hover:text-foreground hover:bg-surface-3"

const chipSelected =
  "border-transparent bg-surface-3 text-foreground shadow-none hover:bg-surface-3"

const chipGhost =
  "border-transparent bg-transparent text-fg-2 hover:bg-surface-3 hover:text-foreground"

const chipAccent =
  "border-transparent bg-accent-bg text-accent-fg hover:brightness-[1.03]"

const chipMuted = "text-fg-3"
const chipDashed =
  "border-dashed bg-transparent text-fg-3 hover:bg-surface-3 hover:text-foreground"
type ChipTone = "default" | "ghost" | "accent"

function getChipToneClass(tone: ChipTone) {
  if (tone === "accent") {
    return chipAccent
  }

  if (tone === "ghost") {
    return chipGhost
  }

  return chipDefault
}

function createViewConfigUpdater(
  viewId: string,
  onUpdateView?: (patch: ViewConfigPatch) => void
) {
  return (patch: ViewConfigPatch) => {
    if (onUpdateView) {
      onUpdateView(patch)
      return
    }

    useAppStore.getState().updateViewConfig(viewId, patch)
  }
}

const ViewChipTrigger = forwardRef<
  HTMLButtonElement,
  {
    icon: ReactNode
    label: string
    showLabel?: boolean
    showValue?: boolean
    tone: ChipTone
    value: string
    valuePrefix?: string
  } & ComponentPropsWithoutRef<"button">
>(function ViewChipTrigger(
  {
    className,
    icon,
    label,
    showLabel = true,
    showValue = true,
    tone,
    type = "button",
    value,
    valuePrefix = "",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={showLabel ? undefined : label}
      className={cn(
        chipBase,
        "work-view-chip",
        getChipToneClass(tone),
        className
      )}
      {...props}
    >
      <span className="shrink-0">{icon}</span>
      {showLabel ? <span className="shrink-0">{label}</span> : null}
      {showValue ? (
        <span className="work-view-chip-value font-semibold">
          {valuePrefix}
          {value}
        </span>
      ) : null}
      <CaretDown className="size-3 shrink-0 opacity-70" />
    </button>
  )
})

const displayPropertyOptions: DisplayProperty[] = [
  "type",
  "status",
  "assignee",
  "priority",
  "progress",
  "project",
  "parent",
  "dueDate",
  "milestone",
  "labels",
  "created",
  "updated",
]

function isPrivateTaskView(view: ViewDefinition) {
  return (
    view.entityKind === "items" &&
    view.filters.visibility?.length === 1 &&
    view.filters.visibility[0] === "private"
  )
}

function getDisplayPropertyOptionsForView(
  view: ViewDefinition,
  propertyOptions: DisplayProperty[]
) {
  if (!isPrivateTaskView(view)) {
    return propertyOptions
  }

  return propertyOptions.filter(
    (property) => property !== "assignee" && property !== "project"
  )
}

const DISPLAY_PROPERTY_LABELS: Record<BuiltinDisplayProperty, string> = {
  id: "ID",
  type: "Type",
  status: "Status",
  assignee: "Assignee",
  priority: "Priority",
  progress: "Progress",
  project: "Project",
  parent: "Parent",
  team: "Team",
  dueDate: "Due date",
  milestone: "Milestone",
  labels: "Labels",
  created: "Created",
  createdBy: "Created by",
  updated: "Updated",
  updatedBy: "Updated by",
  kind: "Kind",
  linkedProjects: "Linked projects",
  linkedItems: "Linked items",
}

const DEFAULT_GROUP_OPTIONS: GroupField[] = [
  "project",
  "status",
  "assignee",
  "priority",
  "label",
  "team",
  "type",
  "parent",
  "epic",
  "feature",
]

export function getAvailableGroupOptions(
  templateType?: Project["templateType"] | null
): GroupField[] {
  if (
    templateType === "bug-tracking" ||
    templateType === "project-management"
  ) {
    return DEFAULT_GROUP_OPTIONS.filter(
      (option) => option !== "epic" && option !== "feature"
    )
  }

  return DEFAULT_GROUP_OPTIONS
}

const orderingOptions: OrderingField[] = [
  "priority",
  "updatedAt",
  "createdAt",
  "dueDate",
  "targetDate",
  "title",
  "count",
]

export type ViewConfigPatch = {
  layout?: ViewDefinition["layout"]
  grouping?: GroupField | null
  subGrouping?: GroupField | null
  ordering?: OrderingField
  itemLevel?: WorkItemType | null
  showChildItems?: boolean
  showCompleted?: boolean
  showEmptyGroups?: boolean
  filters?: Partial<ViewDefinition["filters"]>
  hiddenState?: ViewDefinition["hiddenState"]
}

export function getGroupFieldOptionLabel(field: GroupField | null) {
  if (!field) {
    return "None"
  }

  return getContextualGroupFieldOptionLabel(field)
}

function matchesQuery(label: string, query: string) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) {
    return true
  }
  return label.toLowerCase().includes(trimmed)
}

type ToggleWorkFilterValue = (key: ViewFilterKey, value: string) => void
type GroupVisibilityState = ReturnType<typeof getGroupVisibilityState>
type FilterGroupVisibility = {
  groupValue: string
  state: GroupVisibilityState
}

type FilterPopoverProps = {
  view: ViewDefinition
  items: WorkItem[]
  onToggleFilterValue?: (key: ViewFilterKey, value: string) => void
  onUpdateView?: (patch: ViewConfigPatch) => void
  onClearFilters?: () => void
  hiddenFilters?: ViewFilterKey[]
  groupingExperience?: TeamExperienceType | null
  variant?: "icon" | "chip"
  chipTone?: ChipTone | "adaptive"
  label?: string
  showLabel?: boolean
  triggerIcon?: ReactNode
  dashedWhenEmpty?: boolean
}

type WorkFilterOptions = {
  assignees: UserProfile[]
  filteredLabels: Label[]
  filteredParents: WorkItem[]
  filteredProjects: Project[]
  filteredTeams: Team[]
  itemTypes: WorkItemType[]
  statusOptions: ReturnType<typeof getStatusOrderForTeam>
}

function getScopedFilterItems(view: ViewDefinition, items: WorkItem[]) {
  if (!view.itemLevel) {
    return items
  }

  const visibleTypes = new Set<WorkItemType>([view.itemLevel])
  const childType = view.showChildItems
    ? getChildWorkItemCopy(view.itemLevel, null).childType
    : null

  if (childType) {
    visibleTypes.add(childType)
  }

  return items.filter((item) => visibleTypes.has(item.type))
}

function getItemProjectIds(items: WorkItem[]) {
  const ids = new Set<string>()

  for (const item of items) {
    if (item.primaryProjectId) {
      ids.add(item.primaryProjectId)
    }
  }

  return ids
}

function getItemLabelIds(items: WorkItem[]) {
  const ids = new Set<string>()

  for (const item of items) {
    for (const labelId of item.labelIds) {
      ids.add(labelId)
    }
  }

  return ids
}

function getFilterAssignees(
  items: WorkItem[],
  userById: Map<string, UserProfile>
) {
  const assignees = new Map<string, UserProfile>()

  for (const item of items) {
    for (const assigneeId of getWorkItemAssigneeIds(item)) {
      const assignee = userById.get(assigneeId)

      if (assignee) {
        assignees.set(assignee.id, assignee)
      }
    }
  }

  return [...assignees.values()]
}

function getFilterParentItems(
  items: WorkItem[],
  workItemById: Map<string, WorkItem>
) {
  const parents = new Map<string, WorkItem>()

  for (const item of items) {
    if (!item.parentId) {
      continue
    }

    const parent = workItemById.get(item.parentId)

    if (parent) {
      parents.set(parent.id, parent)
    }
  }

  return [...parents.values()]
}

function getVisibleFilterItemTypes(
  items: WorkItem[],
  taxonomyOptions: WorkItemType[]
) {
  const visibleTypes = new Set(items.map((item) => item.type))

  return workItemTypes.filter(
    (itemType) =>
      visibleTypes.has(itemType) || taxonomyOptions.includes(itemType)
  )
}

function getSelectedParentFilterValues(filters: ViewDefinition["filters"]) {
  return (filters.parentIds ?? []).filter((value) => value !== "__empty__")
}

function getShowEmptyGroupsFilter(filters: ViewDefinition["filters"]) {
  return filters.showEmptyGroups ?? true
}

function getWorkFilterActiveCount(filters: ViewDefinition["filters"]) {
  return (
    filters.status.length +
    filters.priority.length +
    filters.assigneeIds.length +
    filters.projectIds.length +
    getSelectedParentFilterValues(filters).length +
    filters.itemTypes.length +
    filters.labelIds.length +
    filters.teamIds.length +
    (filters.visibility?.length ?? 0) +
    (getShowEmptyGroupsFilter(filters) ? 0 : 1)
  )
}

function getGroupVisibilityFilterActiveCount(view: ViewDefinition) {
  return (
    view.hiddenState.groups.length +
    (view.hiddenState.includedGroups?.length ?? 0)
  )
}

function clearGroupVisibilityFilterState(view: ViewDefinition) {
  return {
    groups: [],
    subgroups: view.hiddenState.subgroups,
  }
}

function useWorkFilterOptions(
  view: ViewDefinition,
  items: WorkItem[]
): WorkFilterOptions {
  const privateTaskView = isPrivateTaskView(view)
  const currentUserId = useAppStore((state) => state.currentUserId)
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId)
  const activeTeam = useAppStore((state) =>
    view.scopeType === "personal" ? getTeam(state, state.ui.activeTeamId) : null
  )
  const scopedTeam = useAppStore((state) =>
    view.scopeType === "team" ? getTeam(state, view.scopeId) : null
  )
  const baseItems = useMemo(
    () =>
      privateTaskView
        ? items.filter(
            (item) =>
              (item.visibility ?? "team") === "private" &&
              item.creatorId === currentUserId &&
              item.workspaceId === currentWorkspaceId
          )
        : items,
    [currentUserId, currentWorkspaceId, items, privateTaskView]
  )
  const scopedItems = useMemo(
    () => getScopedFilterItems(view, baseItems),
    [baseItems, view]
  )
  const teamIds = useMemo(
    () => [
      ...new Set(
        scopedItems
          .filter((item) => (item.visibility ?? "team") === "team")
          .map((item) => item.teamId)
          .filter((teamId): teamId is string => teamId !== null)
      ),
    ],
    [scopedItems]
  )
  const singleTeamId = teamIds.length === 1 ? teamIds[0] : null
  const singleTeam = useAppStore((state) =>
    singleTeamId ? getTeam(state, singleTeamId) : null
  )
  const users = useAppStore((state) => state.users)
  const allWorkItems = useAppStore((state) => state.workItems)
  const projects = useAppStore((state) => state.projects)
  const labels = useAppStore((state) => state.labels)
  const teams = useAppStore((state) => state.teams)
  const taxonomyOptions = useMemo(
    () =>
      getWorkItemLevelTaxonomyOptions({
        personal: view.scopeType === "personal",
        privateOnly: privateTaskView,
        teamExperience:
          scopedTeam?.settings.experience ?? activeTeam?.settings.experience,
      }),
    [
      activeTeam?.settings.experience,
      privateTaskView,
      scopedTeam?.settings.experience,
      view.scopeType,
    ]
  )
  const userById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )
  const workItemById = useMemo(
    () => new Map(allWorkItems.map((item) => [item.id, item])),
    [allWorkItems]
  )
  const projectIds = useMemo(
    () => getItemProjectIds(scopedItems),
    [scopedItems]
  )
  const labelIds = useMemo(() => getItemLabelIds(scopedItems), [scopedItems])
  const assignees = useMemo(
    () => getFilterAssignees(scopedItems, userById),
    [scopedItems, userById]
  )
  const filteredParents = useMemo(
    () => getFilterParentItems(scopedItems, workItemById),
    [scopedItems, workItemById]
  )
  const filteredProjects = useMemo(
    () => projects.filter((project) => projectIds.has(project.id)),
    [projectIds, projects]
  )
  const filteredLabels = useMemo(
    () =>
      labels.filter((entry) => {
        if (!labelIds.has(entry.id)) {
          return false
        }

        if (privateTaskView) {
          return (
            getLabelScopeType(entry) === "private" &&
            entry.ownerId === currentUserId
          )
        }

        return getLabelScopeType(entry) === "workspace"
      }),
    [currentUserId, labelIds, labels, privateTaskView]
  )
  const filteredTeams = useMemo(
    () => teams.filter((team) => teamIds.includes(team.id)),
    [teamIds, teams]
  )
  const itemTypes = useMemo(
    () => getVisibleFilterItemTypes(scopedItems, taxonomyOptions),
    [scopedItems, taxonomyOptions]
  )

  return {
    assignees,
    filteredLabels,
    filteredParents,
    filteredProjects,
    filteredTeams,
    itemTypes,
    statusOptions: getStatusOrderForTeam(singleTeam),
  }
}

function useResolvedGroupingExperience(
  view: ViewDefinition,
  groupingExperience: TeamExperienceType | null | undefined
) {
  const scopedTeam = useAppStore((state) =>
    view.scopeType === "team" ? getTeam(state, view.scopeId) : null
  )
  const activeTeam = useAppStore((state) =>
    view.scopeType === "personal" ? getTeam(state, state.ui.activeTeamId) : null
  )

  return (
    groupingExperience ??
    scopedTeam?.settings.experience ??
    activeTeam?.settings.experience ??
    null
  )
}

function getWorkFilterChipClass({
  activeCount,
  chipTone,
  dashedWhenEmpty,
}: {
  activeCount: number
  chipTone: ChipTone | "adaptive"
  dashedWhenEmpty: boolean
}) {
  if (activeCount === 0) {
    return getInactiveWorkFilterChipClass(chipTone, dashedWhenEmpty)
  }

  return getActiveWorkFilterChipClass(chipTone)
}

function getInactiveWorkFilterChipClass(
  chipTone: ChipTone | "adaptive",
  dashedWhenEmpty: boolean
) {
  if (dashedWhenEmpty) {
    return chipDashed
  }

  return chipTone === "adaptive" ? chipGhost : getChipToneClass(chipTone)
}

function getActiveWorkFilterChipClass(chipTone: ChipTone | "adaptive") {
  return chipTone === "adaptive" ? chipSelected : getChipToneClass(chipTone)
}

function toggleFilterValueOrDelegate<TKey extends ViewFilterKey>({
  canPersistKey = () => true,
  key,
  onToggleFilterValue,
  value,
  viewId,
}: {
  canPersistKey?: (key: TKey) => boolean
  key: TKey
  onToggleFilterValue?: (key: TKey, value: string) => void
  value: string
  viewId: string
}) {
  if (onToggleFilterValue) {
    onToggleFilterValue(key, value)
    return
  }

  if (canPersistKey(key)) {
    useAppStore.getState().toggleViewFilterValue(viewId, key, value)
  }
}

function clearFiltersOrDelegate({
  onClearFilters,
  viewId,
}: {
  onClearFilters?: () => void
  viewId: string
}) {
  if (onClearFilters) {
    onClearFilters()
    return
  }

  useAppStore.getState().clearViewFilters(viewId)
}

function getFilterGroupVisibility(
  view: ViewDefinition,
  field: GroupField,
  groupValue: string,
  filterActive = false
): FilterGroupVisibility | null {
  if (!isFilterPropertyVisibilityField(field)) {
    return null
  }

  return getFilterPropertyVisibility(view, groupValue, filterActive)
}

function getFilterPropertyVisibility(
  view: ViewDefinition,
  groupValue: string,
  filterActive: boolean
): FilterGroupVisibility {
  const hiddenState = getGroupVisibilityState(view.hiddenState, groupValue)

  return {
    groupValue,
    state:
      hiddenState === "normal" && filterActive ? "included" : hiddenState,
  }
}

function isFilterPropertyVisibilityField(field: GroupField) {
  return (
    field === "assignee" ||
    field === "label" ||
    field === "parent" ||
    field === "priority" ||
    field === "project" ||
    field === "status" ||
    field === "team" ||
    field === "type"
  )
}

function getFilterPropertyActiveCount(
  view: ViewDefinition,
  rows: Array<{
    active: boolean
    groupValue: string
  }>
) {
  return rows.filter(
    (row) =>
      getFilterPropertyVisibility(view, row.groupValue, row.active).state !==
      "normal"
  ).length
}

function getFilterRowSelected(
  active: boolean,
  groupVisibility: FilterGroupVisibility | null
) {
  if (groupVisibility) {
    return groupVisibility.state === "included"
  }

  return active
}

function handleFilterRowClick({
  filterKey,
  filterActive,
  filterValue,
  groupVisibility,
  onExcludeGroupVisibility,
  onCycleGroupVisibility,
  onToggleFilterValue,
}: {
  filterKey: ViewFilterKey
  filterActive: boolean
  filterValue: string
  groupVisibility: FilterGroupVisibility | null
  onExcludeGroupVisibility: (groupValue: string) => void
  onCycleGroupVisibility: (groupValue: string) => void
  onToggleFilterValue: ToggleWorkFilterValue
}) {
  if (groupVisibility) {
    if (groupVisibility.state === "excluded") {
      onCycleGroupVisibility(groupVisibility.groupValue)
      return
    }

    if (groupVisibility.state === "included") {
      if (filterActive) {
        onToggleFilterValue(filterKey, filterValue)
      }

      onExcludeGroupVisibility(groupVisibility.groupValue)
      return
    }

    onToggleFilterValue(filterKey, filterValue)
    return
  }

  onToggleFilterValue(filterKey, filterValue)
}

const FilterTriggerButton = forwardRef<
  HTMLButtonElement,
  {
    activeCount: number
    className?: string
    icon?: ReactNode
    label: string
    showLabel?: boolean
    variant: "icon" | "chip"
  } & ComponentPropsWithoutRef<"button">
>(function FilterTriggerButton(
  {
    activeCount,
    className,
    icon,
    label,
    showLabel = true,
    type = "button",
    variant,
    ...props
  },
  ref
) {
  if (variant === "chip") {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={showLabel ? undefined : label}
        className={className}
        {...props}
      >
        <span className="shrink-0">
          {icon ?? <FunnelSimple className="size-3.5" />}
        </span>
        {showLabel ? <span className="shrink-0">{label}</span> : null}
        {activeCount > 0 ? (
          <span className="ml-0.5 shrink-0 rounded-full bg-background/40 px-1 text-[10px] tabular-nums">
            {activeCount}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <Button
      ref={ref}
      type={type}
      size="icon-xs"
      variant="ghost"
      className="relative"
      {...props}
    >
      {icon ?? <FadersHorizontal className="size-3.5" />}
      {activeCount > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
          {activeCount}
        </span>
      ) : null}
    </Button>
  )
})

function WorkFilterHeader({
  activeCount,
  onClearFilters,
}: {
  activeCount: number
  onClearFilters: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line-soft px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase">
        <FunnelSimple className="size-3" />
        <span>Filters</span>
        {activeCount > 0 ? (
          <span className="rounded-full bg-accent-bg px-1.5 py-px text-[10px] font-medium tracking-normal text-accent-fg normal-case">
            {activeCount}
          </span>
        ) : null}
      </div>
      {activeCount > 0 ? (
        <button
          className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
          onClick={onClearFilters}
        >
          Clear all
        </button>
      ) : null}
    </div>
  )
}

function StatusFilterSection({
  hidden,
  onCycleGroupVisibility,
  onExcludeGroupVisibility,
  onToggleFilterValue,
  query,
  statusOptions,
  view,
}: {
  hidden: boolean
  onCycleGroupVisibility: (groupValue: string) => void
  onExcludeGroupVisibility: (groupValue: string) => void
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  statusOptions: WorkFilterOptions["statusOptions"]
  view: ViewDefinition
}) {
  if (hidden) {
    return null
  }

  return (
    <FilterSection
      label="Status"
      activeCount={
        getFilterPropertyActiveCount(
          view,
          statusOptions.map((status) => ({
            active: view.filters.status.includes(status),
            groupValue: status,
          }))
        )
      }
    >
      {statusOptions
        .filter((status) => matchesQuery(statusMeta[status].label, query))
        .map((status) => {
          const filterActive = view.filters.status.includes(status)
          const groupVisibility = getFilterGroupVisibility(
            view,
            "status",
            status,
            filterActive
          )

          return (
            <FilterRow
              key={status}
              icon={<StatusIcon status={status} />}
              label={statusMeta[status].label}
              active={getFilterRowSelected(filterActive, groupVisibility)}
              visibilityState={groupVisibility?.state}
              onClick={() =>
                handleFilterRowClick({
                  filterKey: "status",
                  filterActive,
                  filterValue: status,
                  groupVisibility,
                  onCycleGroupVisibility,
                  onExcludeGroupVisibility,
                  onToggleFilterValue,
                })
              }
            />
          )
        })}
    </FilterSection>
  )
}

function PriorityFilterSection({
  hidden,
  onCycleGroupVisibility,
  onExcludeGroupVisibility,
  onToggleFilterValue,
  query,
  view,
}: {
  hidden: boolean
  onCycleGroupVisibility: (groupValue: string) => void
  onExcludeGroupVisibility: (groupValue: string) => void
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  view: ViewDefinition
}) {
  if (hidden) {
    return null
  }

  return (
    <FilterSection
      label="Priority"
      activeCount={
        getFilterPropertyActiveCount(
          view,
          Object.keys(priorityMeta).map((priority) => ({
            active: view.filters.priority.includes(priority as Priority),
            groupValue: priority,
          }))
        )
      }
    >
      {Object.entries(priorityMeta)
        .filter(([, meta]) => matchesQuery(meta.label, query))
        .map(([priority, meta]) => {
          const filterActive = view.filters.priority.includes(
            priority as Priority
          )
          const groupVisibility = getFilterGroupVisibility(
            view,
            "priority",
            priority,
            filterActive
          )

          return (
            <FilterRow
              key={priority}
              icon={<PriorityIcon priority={priority as Priority} />}
              label={meta.label}
              active={getFilterRowSelected(filterActive, groupVisibility)}
              visibilityState={groupVisibility?.state}
              onClick={() =>
                handleFilterRowClick({
                  filterKey: "priority",
                  filterActive,
                  filterValue: priority,
                  groupVisibility,
                  onCycleGroupVisibility,
                  onExcludeGroupVisibility,
                  onToggleFilterValue,
                })
              }
            />
          )
        })}
    </FilterSection>
  )
}

function ItemTypeFilterSection({
  hidden,
  itemTypes,
  onCycleGroupVisibility,
  onExcludeGroupVisibility,
  onToggleFilterValue,
  query,
  view,
}: {
  hidden: boolean
  itemTypes: WorkItemType[]
  onCycleGroupVisibility: (groupValue: string) => void
  onExcludeGroupVisibility: (groupValue: string) => void
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  view: ViewDefinition
}) {
  if (hidden || itemTypes.length <= 1) {
    return null
  }

  return (
    <FilterSection
      label="Type"
      activeCount={
        getFilterPropertyActiveCount(
          view,
          itemTypes.map((itemType) => ({
            active: view.filters.itemTypes.includes(itemType),
            groupValue: itemType,
          }))
        )
      }
    >
      {itemTypes
        .filter((itemType) =>
          matchesQuery(getDisplayLabelForWorkItemType(itemType, null), query)
        )
        .map((itemType) => {
          const filterActive = view.filters.itemTypes.includes(itemType)
          const groupVisibility = getFilterGroupVisibility(
            view,
            "type",
            itemType,
            filterActive
          )

          return (
            <FilterRow
              key={itemType}
              icon={<WorkItemTypeIcon itemType={itemType} />}
              label={getDisplayLabelForWorkItemType(itemType, null)}
              active={getFilterRowSelected(filterActive, groupVisibility)}
              visibilityState={groupVisibility?.state}
              onClick={() =>
                handleFilterRowClick({
                  filterKey: "itemTypes",
                  filterActive,
                  filterValue: itemType,
                  groupVisibility,
                  onCycleGroupVisibility,
                  onExcludeGroupVisibility,
                  onToggleFilterValue,
                })
              }
            />
          )
        })}
    </FilterSection>
  )
}

function AssigneeFilterSection({
  assignees,
  hidden,
  onCycleGroupVisibility,
  onExcludeGroupVisibility,
  onToggleFilterValue,
  query,
  view,
}: {
  assignees: UserProfile[]
  hidden: boolean
  onCycleGroupVisibility: (groupValue: string) => void
  onExcludeGroupVisibility: (groupValue: string) => void
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  view: ViewDefinition
}) {
  if (hidden || assignees.length === 0) {
    return null
  }

  return (
    <FilterSection
      label="Assignee"
      activeCount={
        getFilterPropertyActiveCount(
          view,
          assignees.map((assignee) => ({
            active: view.filters.assigneeIds.includes(assignee.id),
            groupValue: assignee.name,
          }))
        )
      }
    >
      {assignees
        .filter((assignee) => matchesQuery(assignee.name, query))
        .map((assignee) => {
          const filterActive = view.filters.assigneeIds.includes(assignee.id)
          const groupVisibility = getFilterGroupVisibility(
            view,
            "assignee",
            assignee.name,
            filterActive
          )

          return (
            <FilterRow
              key={assignee.id}
              icon={
                <WorkItemAssigneeAvatar
                  user={assignee}
                  className="size-4 data-[size=sm]:size-4"
                />
              }
              label={assignee.name}
              active={getFilterRowSelected(filterActive, groupVisibility)}
              visibilityState={groupVisibility?.state}
              onClick={() =>
                handleFilterRowClick({
                  filterKey: "assigneeIds",
                  filterActive,
                  filterValue: assignee.id,
                  groupVisibility,
                  onCycleGroupVisibility,
                  onExcludeGroupVisibility,
                  onToggleFilterValue,
                })
              }
            />
          )
        })}
    </FilterSection>
  )
}

const WORK_ITEM_VISIBILITY_LABELS: Record<WorkItemVisibility, string> = {
  team: "Team space work",
  private: "Private tasks",
}

function VisibilityFilterSection({
  hidden,
  onToggleFilterValue,
  query,
  view,
}: {
  hidden: boolean
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  view: ViewDefinition
}) {
  if (hidden) {
    return null
  }

  const options: WorkItemVisibility[] = ["team", "private"]

  return (
    <FilterSection
      label="Visibility"
      activeCount={view.filters.visibility?.length ?? 0}
    >
      {options
        .filter((visibility) =>
          matchesQuery(WORK_ITEM_VISIBILITY_LABELS[visibility], query)
        )
        .map((visibility) => (
          <FilterRow
            key={visibility}
            icon={<Eye className="size-3" />}
            label={WORK_ITEM_VISIBILITY_LABELS[visibility]}
            active={Boolean(view.filters.visibility?.includes(visibility))}
            onClick={() => onToggleFilterValue("visibility", visibility)}
          />
        ))}
    </FilterSection>
  )
}

function TeamFilterSection({
  hidden,
  onCycleGroupVisibility,
  onExcludeGroupVisibility,
  onToggleFilterValue,
  query,
  teams,
  view,
}: {
  hidden: boolean
  onCycleGroupVisibility: (groupValue: string) => void
  onExcludeGroupVisibility: (groupValue: string) => void
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  teams: Team[]
  view: ViewDefinition
}) {
  if (hidden || teams.length <= 1) {
    return null
  }

  return (
    <FilterSection
      label="Team space"
      activeCount={
        getFilterPropertyActiveCount(
          view,
          teams.map((team) => ({
            active: view.filters.teamIds.includes(team.id),
            groupValue: team.name,
          }))
        )
      }
    >
      {teams
        .filter((team) => matchesQuery(team.name, query))
        .map((team) => {
          const filterActive = view.filters.teamIds.includes(team.id)
          const groupVisibility = getFilterGroupVisibility(
            view,
            "team",
            team.name,
            filterActive
          )

          return (
            <FilterRow
              key={team.id}
              icon={
                <TeamIconGlyph
                  icon={team.icon}
                  className="size-[13px] text-fg-3"
                />
              }
              label={team.name}
              active={getFilterRowSelected(filterActive, groupVisibility)}
              visibilityState={groupVisibility?.state}
              onClick={() =>
                handleFilterRowClick({
                  filterKey: "teamIds",
                  filterActive,
                  filterValue: team.id,
                  groupVisibility,
                  onCycleGroupVisibility,
                  onExcludeGroupVisibility,
                  onToggleFilterValue,
                })
              }
            />
          )
        })}
    </FilterSection>
  )
}

function ProjectFilterSection({
  hidden,
  onCycleGroupVisibility,
  onExcludeGroupVisibility,
  onToggleFilterValue,
  projects,
  query,
  view,
}: {
  hidden: boolean
  onCycleGroupVisibility: (groupValue: string) => void
  onExcludeGroupVisibility: (groupValue: string) => void
  onToggleFilterValue: ToggleWorkFilterValue
  projects: Project[]
  query: string
  view: ViewDefinition
}) {
  if (hidden || isPrivateTaskView(view) || projects.length === 0) {
    return null
  }

  return (
    <FilterSection
      label="Project"
      activeCount={
        getFilterPropertyActiveCount(
          view,
          projects.map((project) => ({
            active: view.filters.projectIds.includes(project.id),
            groupValue: project.name,
          }))
        )
      }
    >
      {projects
        .filter((project) => matchesQuery(project.name, query))
        .map((project) => {
          const filterActive = view.filters.projectIds.includes(project.id)
          const groupVisibility = getFilterGroupVisibility(
            view,
            "project",
            project.name,
            filterActive
          )

          return (
            <FilterRow
              key={project.id}
              icon={
                <ProjectIconGlyph
                  project={project}
                  className="size-[13px] text-fg-3"
                />
              }
              label={project.name}
              active={getFilterRowSelected(filterActive, groupVisibility)}
              visibilityState={groupVisibility?.state}
              onClick={() =>
                handleFilterRowClick({
                  filterKey: "projectIds",
                  filterActive,
                  filterValue: project.id,
                  groupVisibility,
                  onCycleGroupVisibility,
                  onExcludeGroupVisibility,
                  onToggleFilterValue,
                })
              }
            />
          )
        })}
    </FilterSection>
  )
}

function getParentFilterGroupValue(parent: WorkItem) {
  return `${parent.key} · ${parent.title}`
}

function ParentFilterSection({
  hidden,
  onCycleGroupVisibility,
  onExcludeGroupVisibility,
  onToggleFilterValue,
  parentLabel,
  parents,
  query,
  view,
}: {
  hidden: boolean
  onCycleGroupVisibility: (groupValue: string) => void
  onExcludeGroupVisibility: (groupValue: string) => void
  onToggleFilterValue: ToggleWorkFilterValue
  parentLabel: string
  parents: WorkItem[]
  query: string
  view: ViewDefinition
}) {
  if (hidden) {
    return null
  }

  return (
    <FilterSection
      label={parentLabel}
      activeCount={
        getFilterPropertyActiveCount(
          view,
          parents.map((parent) => ({
            active: Boolean(view.filters.parentIds?.includes(parent.id)),
            groupValue: getParentFilterGroupValue(parent),
          }))
        )
      }
    >
      {parents
        .filter((parent) =>
          matchesQuery(getParentFilterGroupValue(parent), query)
        )
        .map((parent) => {
          const groupValue = getParentFilterGroupValue(parent)
          const filterActive = Boolean(view.filters.parentIds?.includes(parent.id))
          const groupVisibility = getFilterGroupVisibility(
            view,
            "parent",
            groupValue,
            filterActive
          )

          return (
            <FilterRow
              key={parent.id}
              icon={<TreeStructure className="size-3" />}
              label={groupValue}
              active={getFilterRowSelected(filterActive, groupVisibility)}
              visibilityState={groupVisibility?.state}
              onClick={() =>
                handleFilterRowClick({
                  filterKey: "parentIds",
                  filterActive,
                  filterValue: parent.id,
                  groupVisibility,
                  onCycleGroupVisibility,
                  onExcludeGroupVisibility,
                  onToggleFilterValue,
                })
              }
            />
          )
        })}
    </FilterSection>
  )
}

function LabelFilterSection({
  hidden,
  labels,
  onCycleGroupVisibility,
  onExcludeGroupVisibility,
  onToggleFilterValue,
  query,
  view,
}: {
  hidden: boolean
  labels: Label[]
  onCycleGroupVisibility: (groupValue: string) => void
  onExcludeGroupVisibility: (groupValue: string) => void
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  view: ViewDefinition
}) {
  if (hidden || labels.length === 0) {
    return null
  }

  return (
    <FilterSection
      label="Labels"
      activeCount={
        getFilterPropertyActiveCount(
          view,
          labels.map((label) => ({
            active: view.filters.labelIds.includes(label.id),
            groupValue: label.name,
          }))
        )
      }
    >
      {labels
        .filter((label) => matchesQuery(label.name, query))
        .map((label) => {
          const filterActive = view.filters.labelIds.includes(label.id)
          const groupVisibility = getFilterGroupVisibility(
            view,
            "label",
            label.name,
            filterActive
          )

          return (
            <FilterRow
              key={label.id}
              icon={<LabelColorDot color={label.color} />}
              label={label.name}
              active={getFilterRowSelected(filterActive, groupVisibility)}
              visibilityState={groupVisibility?.state}
              onClick={() =>
                handleFilterRowClick({
                  filterKey: "labelIds",
                  filterActive,
                  filterValue: label.id,
                  groupVisibility,
                  onCycleGroupVisibility,
                  onExcludeGroupVisibility,
                  onToggleFilterValue,
                })
              }
            />
          )
        })}
    </FilterSection>
  )
}

function GroupsFilterSection({
  onSetShowEmptyGroups,
  query,
  view,
}: {
  onSetShowEmptyGroups: (showEmptyGroups: boolean) => void
  query: string
  view: ViewDefinition
}) {
  if (view.layout !== "board" && view.layout !== "list") {
    return null
  }

  const showEmptyGroups = getShowEmptyGroupsFilter(view.filters)
  const rows = [
    {
      active: showEmptyGroups,
      icon: <Eye className="size-3" />,
      label: "Show empty",
      value: true,
    },
    {
      active: !showEmptyGroups,
      icon: <EyeSlash className="size-3" />,
      label: "Don't show empty",
      value: false,
    },
  ].filter((row) => matchesQuery(row.label, query))

  return (
    <FilterSection label="Groups" activeCount={showEmptyGroups ? 0 : 1}>
      {rows.map((row) => (
        <FilterRow
          key={row.label}
          icon={row.icon}
          label={row.label}
          active={row.active}
          onClick={() => onSetShowEmptyGroups(row.value)}
        />
      ))}
    </FilterSection>
  )
}

function WorkFilterSections({
  hiddenFilterSet,
  onCycleGroupVisibility,
  onExcludeGroupVisibility,
  onSetShowEmptyGroups,
  onToggleFilterValue,
  options,
  parentLabel,
  query,
  view,
}: {
  hiddenFilterSet: ReadonlySet<ViewFilterKey>
  onCycleGroupVisibility: (groupValue: string) => void
  onExcludeGroupVisibility: (groupValue: string) => void
  onSetShowEmptyGroups: (showEmptyGroups: boolean) => void
  onToggleFilterValue: ToggleWorkFilterValue
  options: WorkFilterOptions
  parentLabel: string
  query: string
  view: ViewDefinition
}) {
  return (
    <div
      data-testid="work-filter-sections"
      className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-contain pr-1"
    >
      <StatusFilterSection
        hidden={hiddenFilterSet.has("status")}
        onCycleGroupVisibility={onCycleGroupVisibility}
        onExcludeGroupVisibility={onExcludeGroupVisibility}
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        statusOptions={options.statusOptions}
        view={view}
      />
      <PriorityFilterSection
        hidden={hiddenFilterSet.has("priority")}
        onCycleGroupVisibility={onCycleGroupVisibility}
        onExcludeGroupVisibility={onExcludeGroupVisibility}
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        view={view}
      />
      <ItemTypeFilterSection
        hidden={hiddenFilterSet.has("itemTypes")}
        itemTypes={options.itemTypes}
        onCycleGroupVisibility={onCycleGroupVisibility}
        onExcludeGroupVisibility={onExcludeGroupVisibility}
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        view={view}
      />
      <AssigneeFilterSection
        assignees={options.assignees}
        hidden={hiddenFilterSet.has("assigneeIds")}
        onCycleGroupVisibility={onCycleGroupVisibility}
        onExcludeGroupVisibility={onExcludeGroupVisibility}
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        view={view}
      />
      <VisibilityFilterSection
        hidden={hiddenFilterSet.has("visibility")}
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        view={view}
      />
      <TeamFilterSection
        hidden={hiddenFilterSet.has("teamIds")}
        onCycleGroupVisibility={onCycleGroupVisibility}
        onExcludeGroupVisibility={onExcludeGroupVisibility}
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        teams={options.filteredTeams}
        view={view}
      />
      <ProjectFilterSection
        hidden={hiddenFilterSet.has("projectIds")}
        onCycleGroupVisibility={onCycleGroupVisibility}
        onExcludeGroupVisibility={onExcludeGroupVisibility}
        onToggleFilterValue={onToggleFilterValue}
        projects={options.filteredProjects}
        query={query}
        view={view}
      />
      <ParentFilterSection
        hidden={hiddenFilterSet.has("parentIds")}
        onCycleGroupVisibility={onCycleGroupVisibility}
        onExcludeGroupVisibility={onExcludeGroupVisibility}
        onToggleFilterValue={onToggleFilterValue}
        parentLabel={parentLabel}
        parents={options.filteredParents}
        query={query}
        view={view}
      />
      <LabelFilterSection
        hidden={hiddenFilterSet.has("labelIds")}
        labels={options.filteredLabels}
        onCycleGroupVisibility={onCycleGroupVisibility}
        onExcludeGroupVisibility={onExcludeGroupVisibility}
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        view={view}
      />
      <GroupsFilterSection
        onSetShowEmptyGroups={onSetShowEmptyGroups}
        query={query}
        view={view}
      />
    </div>
  )
}

export function FilterPopover({
  view,
  items,
  onToggleFilterValue,
  onUpdateView,
  onClearFilters,
  hiddenFilters = [],
  groupingExperience,
  variant = "icon",
  chipTone = "adaptive",
  label = "Filter",
  showLabel = true,
  triggerIcon,
  dashedWhenEmpty = false,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [optimisticHiddenState, setOptimisticHiddenState] = useState<{
    hiddenState: ViewDefinition["hiddenState"]
    viewId: string
  } | null>(null)
  const [optimisticFilters, setOptimisticFilters] = useState<{
    filters: ViewDefinition["filters"]
    viewId: string
  } | null>(null)
  const effectiveHiddenState =
    open && optimisticHiddenState?.viewId === view.id
      ? optimisticHiddenState.hiddenState
      : view.hiddenState
  const effectiveFilters =
    open && optimisticFilters?.viewId === view.id
      ? optimisticFilters.filters
      : view.filters
  const effectiveView =
    effectiveHiddenState === view.hiddenState && effectiveFilters === view.filters
      ? view
      : { ...view, filters: effectiveFilters, hiddenState: effectiveHiddenState }
  const options = useWorkFilterOptions(effectiveView, items)
  const hiddenFilterSet = useMemo(() => new Set(hiddenFilters), [hiddenFilters])
  const groupVisibilityActiveCount =
    getGroupVisibilityFilterActiveCount(effectiveView)
  const activeCount =
    getWorkFilterActiveCount(effectiveView.filters) + groupVisibilityActiveCount
  const resolvedGroupingExperience = useResolvedGroupingExperience(
    view,
    groupingExperience
  )
  const parentLabel = getParentGroupingLabel({
    view,
    groupingExperience: resolvedGroupingExperience,
  })

  function handleToggleFilterValue(key: ViewFilterKey, value: string) {
    setOptimisticFilters({
      filters: toggleViewFilterValue(effectiveView.filters, key, value),
      viewId: view.id,
    })
    toggleFilterValueOrDelegate({
      canPersistKey: isPersistedViewFilterKey,
      key,
      onToggleFilterValue,
      value,
      viewId: view.id,
    })
  }

  function handleClearFilters() {
    clearFiltersOrDelegate({ onClearFilters, viewId: view.id })
    setOptimisticFilters({
      filters: clearViewFilterSelections(effectiveView.filters),
      viewId: view.id,
    })

    if (groupVisibilityActiveCount > 0) {
      const nextHiddenState = clearGroupVisibilityFilterState(effectiveView)

      setOptimisticHiddenState({
        hiddenState: nextHiddenState,
        viewId: view.id,
      })
      updateViewConfig(view, onUpdateView, {
        hiddenState: nextHiddenState,
      })
    }
  }

  function handleSetShowEmptyGroups(showEmptyGroups: boolean) {
    updateViewConfig(view, onUpdateView, { showEmptyGroups })
  }

  function handleCycleGroupVisibility(groupValue: string) {
    const nextHiddenState = getNextGroupVisibilityHiddenState(
      effectiveView.hiddenState,
      groupValue
    )

    setOptimisticHiddenState({
      hiddenState: nextHiddenState,
      viewId: view.id,
    })
    updateViewConfig(view, onUpdateView, {
      hiddenState: nextHiddenState,
    })
  }

  function handleExcludeGroupVisibility(groupValue: string) {
    const nextHiddenState = getExcludedGroupVisibilityHiddenState(
      effectiveView.hiddenState,
      groupValue
    )

    setOptimisticHiddenState({
      hiddenState: nextHiddenState,
      viewId: view.id,
    })
    updateViewConfig(view, onUpdateView, {
      hiddenState: nextHiddenState,
    })
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (!nextOpen) {
          setOptimisticHiddenState(null)
          setOptimisticFilters(null)
        }
      }}
    >
      <PopoverTrigger asChild>
        <FilterTriggerButton
          activeCount={activeCount}
          className={cn(
            chipBase,
            getWorkFilterChipClass({ activeCount, chipTone, dashedWhenEmpty })
          )}
          icon={triggerIcon}
          label={label}
          showLabel={showLabel}
          variant={variant}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        sideOffset={8}
        className={cn(
          PROPERTY_POPOVER_CLASS,
          "pointer-events-auto flex h-[min(520px,calc(100vh-11rem))] max-h-[min(520px,var(--radix-popover-content-available-height),calc(100vh-11rem))] min-h-0 touch-pan-y flex-col overscroll-contain",
          "w-[min(280px,calc(100vw-2rem))]"
        )}
      >
        <WorkFilterHeader
          activeCount={activeCount}
          onClearFilters={handleClearFilters}
        />
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-3.5" />}
          placeholder="Filter values…"
          value={query}
          onChange={setQuery}
        />
        <WorkFilterSections
          hiddenFilterSet={hiddenFilterSet}
          onCycleGroupVisibility={handleCycleGroupVisibility}
          onExcludeGroupVisibility={handleExcludeGroupVisibility}
          onSetShowEmptyGroups={handleSetShowEmptyGroups}
          onToggleFilterValue={handleToggleFilterValue}
          options={options}
          parentLabel={parentLabel}
          query={query}
          view={effectiveView}
        />
      </PopoverContent>
    </Popover>
  )
}

function FilterSection({
  label,
  activeCount = 0,
  children,
}: {
  label: string
  activeCount?: number
  children: ReactNode
}) {
  const hasChildren = Array.isArray(children)
    ? children.filter(Boolean).length > 0
    : Boolean(children)
  if (!hasChildren) {
    return null
  }

  return (
    <div className="border-b border-line-soft last:border-b-0">
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase">
        <span>{label}</span>
        {activeCount > 0 ? (
          <span className="rounded-full bg-accent-bg px-1.5 py-px text-[10px] font-medium tracking-normal text-accent-fg normal-case">
            {activeCount}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col p-1 pt-0">{children}</div>
    </div>
  )
}

function FilterRow({
  icon,
  label,
  active,
  onClick,
  visibilityState,
}: {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
  visibilityState?: GroupVisibilityState
}) {
  const excluded = visibilityState === "excluded"
  const trailing = excluded ? (
    <X className="size-3.5 text-fg-2" />
  ) : active ? (
    <Check className="size-3.5 text-accent-fg" />
  ) : null

  return (
    <PropertyPopoverItem
      selected={active}
      onClick={onClick}
      trailing={trailing}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </PropertyPopoverItem>
  )
}

function ColorDot({ color }: { color?: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: color ?? "var(--fg-4)" }}
    />
  )
}

type ProjectFilterRowData = {
  active: boolean
  icon: ReactNode
  key: string
  label: string
  onClick: () => void
}

type ProjectFilterSectionData = {
  activeCount: number
  key: string
  label: string
  rows: ProjectFilterRowData[]
}

type ProjectFilterChipState = "active" | "emptyDashed" | "emptyDefault"

const adaptiveProjectFilterChipClasses: Record<ProjectFilterChipState, string> =
  {
    active: chipSelected,
    emptyDashed: chipDashed,
    emptyDefault: chipDefault,
  }

function getProjectFilterChipState(
  activeCount: number,
  dashedWhenEmpty: boolean
): ProjectFilterChipState {
  if (activeCount > 0) {
    return "active"
  }

  return dashedWhenEmpty ? "emptyDashed" : "emptyDefault"
}

function getProjectFilterChipClass({
  activeCount,
  chipTone,
  dashedWhenEmpty,
}: {
  activeCount: number
  chipTone: ChipTone | "adaptive"
  dashedWhenEmpty: boolean
}) {
  const chipState = getProjectFilterChipState(activeCount, dashedWhenEmpty)

  return chipTone === "adaptive"
    ? adaptiveProjectFilterChipClasses[chipState]
    : chipState === "emptyDashed"
      ? chipDashed
      : getChipToneClass(chipTone)
}

function ProjectFilterSectionList({
  sections,
}: {
  sections: ProjectFilterSectionData[]
}) {
  return (
    <div className="no-scrollbar flex max-h-[360px] flex-col overflow-y-auto">
      {sections.map((section) => (
        <FilterSection
          key={section.key}
          label={section.label}
          activeCount={section.activeCount}
        >
          {section.rows.map((row) => (
            <FilterRow
              key={row.key}
              icon={row.icon}
              label={row.label}
              active={row.active}
              onClick={row.onClick}
            />
          ))}
        </FilterSection>
      ))}
    </div>
  )
}

export function ProjectFilterPopover({
  view,
  projects,
  onToggleFilterValue,
  onClearFilters,
  variant = "icon",
  chipTone = "adaptive",
  label = "Filter",
  dashedWhenEmpty = false,
}: {
  view: ViewDefinition
  projects: Project[]
  onToggleFilterValue?: (
    key: "status" | "priority" | "leadIds" | "health" | "teamIds",
    value: string
  ) => void
  onClearFilters?: () => void
  variant?: "icon" | "chip"
  chipTone?: ChipTone | "adaptive"
  label?: string
  dashedWhenEmpty?: boolean
}) {
  const [query, setQuery] = useState("")
  const users = useAppStore((state) => state.users)
  const teams = useAppStore((state) => state.teams)
  const leadIds = useMemo(
    () => [
      ...new Set(projects.map((project) => project.leadId).filter(Boolean)),
    ],
    [projects]
  )
  const teamIds = useMemo(
    () => [
      ...new Set(
        projects
          .filter((project) => project.scopeType === "team")
          .map((project) => project.scopeId)
      ),
    ],
    [projects]
  )
  const leads = useMemo(
    () => users.filter((user) => leadIds.includes(user.id)),
    [leadIds, users]
  )
  const projectTeams = useMemo(
    () => teams.filter((team) => teamIds.includes(team.id)),
    [teamIds, teams]
  )
  const healthOptions = useMemo(
    () =>
      Object.keys(projectHealthMeta).filter((health) =>
        projects.some((project) => project.health === health)
      ),
    [projects]
  )
  const statusOptions = useMemo(
    () =>
      projectStatuses.filter((status) =>
        projects.some((project) => project.status === status)
      ),
    [projects]
  )
  const activeCount =
    view.filters.status.length +
    view.filters.priority.length +
    view.filters.leadIds.length +
    view.filters.health.length +
    view.filters.teamIds.length

  function handleToggleFilterValue(
    key: "status" | "priority" | "leadIds" | "health" | "teamIds",
    value: string
  ) {
    toggleFilterValueOrDelegate({
      key,
      onToggleFilterValue,
      value,
      viewId: view.id,
    })
  }

  function handleClearFilters() {
    clearFiltersOrDelegate({ onClearFilters, viewId: view.id })
  }

  const filterSections: ProjectFilterSectionData[] = [
    {
      key: "status",
      label: "Status",
      activeCount: view.filters.status.length,
      rows: statusOptions
        .filter((status) =>
          matchesQuery(projectStatusMeta[status].label, query)
        )
        .map((status) => ({
          key: status,
          icon: <StatusIcon status={getProjectStatusIconStatus(status)} />,
          label: projectStatusMeta[status].label,
          active: view.filters.status.includes(status),
          onClick: () => handleToggleFilterValue("status", status),
        })),
    },
    {
      key: "priority",
      label: "Priority",
      activeCount: view.filters.priority.length,
      rows: Object.entries(priorityMeta)
        .filter(([, meta]) => matchesQuery(meta.label, query))
        .map(([priority, meta]) => ({
          key: priority,
          icon: <PriorityIcon priority={priority as Priority} />,
          label: meta.label,
          active: view.filters.priority.includes(priority as Priority),
          onClick: () => handleToggleFilterValue("priority", priority),
        })),
    },
    {
      key: "health",
      label: "Health",
      activeCount: view.filters.health.length,
      rows: healthOptions
        .filter((health) =>
          matchesQuery(
            projectHealthMeta[health as keyof typeof projectHealthMeta].label,
            query
          )
        )
        .map((health) => ({
          key: health,
          icon: (
            <ColorDot
              color={HEALTH_COLOR[health as keyof typeof HEALTH_COLOR]}
            />
          ),
          label:
            projectHealthMeta[health as keyof typeof projectHealthMeta].label,
          active: view.filters.health.includes(health as never),
          onClick: () => handleToggleFilterValue("health", health),
        })),
    },
    {
      key: "lead",
      label: "Lead",
      activeCount: view.filters.leadIds.length,
      rows: leads
        .filter((lead) => matchesQuery(lead.name, query))
        .map((lead) => ({
          key: lead.id,
          icon: (
            <WorkItemAssigneeAvatar
              user={lead}
              className="size-4 data-[size=sm]:size-4"
            />
          ),
          label: lead.name,
          active: view.filters.leadIds.includes(lead.id),
          onClick: () => handleToggleFilterValue("leadIds", lead.id),
        })),
    },
    {
      key: "team",
      label: "Team",
      activeCount: view.filters.teamIds.length,
      rows: projectTeams
        .filter((team) => matchesQuery(team.name, query))
        .map((team) => ({
          key: team.id,
          icon: (
            <TeamIconGlyph icon={team.icon} className="size-[13px] text-fg-3" />
          ),
          label: team.name,
          active: view.filters.teamIds.includes(team.id),
          onClick: () => handleToggleFilterValue("teamIds", team.id),
        })),
    },
  ].filter((section) => section.rows.length > 0)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterTriggerButton
          activeCount={activeCount}
          className={cn(
            chipBase,
            getProjectFilterChipClass({
              activeCount,
              chipTone,
              dashedWhenEmpty,
            })
          )}
          label={label}
          variant={variant}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[280px]")}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line-soft px-2.5 py-1.5">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.05em] text-fg-3 uppercase">
            <FunnelSimple className="size-3" />
            <span>Filters</span>
            {activeCount > 0 ? (
              <span className="rounded-full bg-accent-bg px-1.5 py-px text-[10px] font-medium tracking-normal text-accent-fg normal-case">
                {activeCount}
              </span>
            ) : null}
          </div>
          {activeCount > 0 ? (
            <button
              className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
              onClick={handleClearFilters}
            >
              Clear all
            </button>
          ) : null}
        </div>
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-3.5" />}
          placeholder="Filter values…"
          value={query}
          onChange={setQuery}
        />
        <ProjectFilterSectionList sections={filterSections} />
      </PopoverContent>
    </Popover>
  )
}

function updateViewConfig(
  view: ViewDefinition,
  onUpdateView: ((patch: ViewConfigPatch) => void) | undefined,
  patch: ViewConfigPatch
) {
  if (onUpdateView) {
    onUpdateView(patch)
    return
  }

  useAppStore.getState().updateViewConfig(view.id, patch)
}

type ViewLayoutOption = {
  value: ViewDefinition["layout"]
  label: string
  icon: ReactNode
}

function ViewLayoutTabsControl({
  view,
  onUpdateView,
  options,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  options: ViewLayoutOption[]
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {options.map((option) => (
        <ViewTab
          key={option.value}
          active={view.layout === option.value}
          onClick={() =>
            updateViewConfig(view, onUpdateView, { layout: option.value })
          }
        >
          {option.icon}
          {option.label}
        </ViewTab>
      ))}
    </div>
  )
}

function getActiveViewLayoutOption(
  options: ViewLayoutOption[],
  layout: ViewDefinition["layout"]
) {
  return options.find((option) => option.value === layout) ?? options[0] ?? null
}

const ViewLayoutChipTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button"> & {
    activeOption: ViewLayoutOption | null
    showLabel?: boolean
    tone: ChipTone
  }
>(function ViewLayoutChipTrigger(
  { activeOption, className, showLabel = true, tone, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={showLabel ? undefined : (activeOption?.label ?? "Layout")}
      className={cn(chipBase, getChipToneClass(tone), className)}
      {...props}
    >
      <span className="shrink-0">{activeOption?.icon}</span>
      {showLabel ? (
        <span className="shrink-0">{activeOption?.label ?? "Layout"}</span>
      ) : null}
      <CaretDown className="size-3 shrink-0 opacity-70" />
    </button>
  )
})

function ViewLayoutPopoverItem({
  active,
  onUpdateView,
  option,
  view,
}: {
  active: boolean
  onUpdateView?: (patch: ViewConfigPatch) => void
  option: ViewLayoutOption
  view: ViewDefinition
}) {
  return (
    <PropertyPopoverItem
      selected={active}
      onClick={() =>
        updateViewConfig(view, onUpdateView, {
          layout: option.value,
        })
      }
      trailing={active ? <Check className="size-3.5 text-accent-fg" /> : null}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {option.icon}
      </span>
      <span>{option.label}</span>
    </PropertyPopoverItem>
  )
}

function ViewLayoutChipPopover({
  view,
  onUpdateView,
  tone,
  options,
  showLabel = true,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone: ChipTone
  options: ViewLayoutOption[]
  showLabel?: boolean
}) {
  const activeOption = getActiveViewLayoutOption(options, view.layout)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ViewLayoutChipTrigger
          activeOption={activeOption}
          showLabel={showLabel}
          tone={tone}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[200px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverGroup>Layout</PropertyPopoverGroup>
          {options.map((option) => {
            const active = view.layout === option.value
            return (
              <ViewLayoutPopoverItem
                key={option.value}
                active={active}
                option={option}
                view={view}
                onUpdateView={onUpdateView}
              />
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function ViewSortChipPopover({
  view,
  onUpdateView,
  tone,
  label,
  showLabel = true,
  showValue,
  options,
  contentWidthClassName,
  showCompletedToggle = false,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone: ChipTone
  label?: string
  showLabel?: boolean
  showValue: boolean
  options: OrderingField[]
  contentWidthClassName: string
  showCompletedToggle?: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ViewSortChipButton
          label={label}
          ordering={view.ordering}
          showLabel={showLabel}
          showValue={showValue}
          tone={tone}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, contentWidthClassName)}
      >
        <ViewSortOptionsList
          options={options}
          view={view}
          onUpdateView={onUpdateView}
        />
        <ViewSortCompletedToggle
          show={showCompletedToggle}
          view={view}
          onUpdateView={onUpdateView}
        />
      </PopoverContent>
    </Popover>
  )
}

const ViewSortChipButton = forwardRef<
  HTMLButtonElement,
  {
    label?: string
    ordering: OrderingField
    showLabel?: boolean
    showValue: boolean
    tone: ChipTone
  } & ComponentPropsWithoutRef<"button">
>(function ViewSortChipButton(
  {
    className,
    label,
    ordering,
    showLabel = true,
    showValue,
    tone,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={showLabel ? undefined : (label ?? ORDERING_LABELS[ordering])}
      className={cn(
        chipBase,
        "work-view-chip",
        getChipToneClass(tone),
        className
      )}
      {...props}
    >
      <SortAscending className="size-3.5 shrink-0" />
      {showLabel ? (
        <span className="shrink-0">{label ?? ORDERING_LABELS[ordering]}</span>
      ) : null}
      {showValue ? (
        <span className="work-view-chip-value font-semibold">
          {label ? `· ${ORDERING_LABELS[ordering]}` : null}
        </span>
      ) : null}
      <CaretDown className="size-3 shrink-0 opacity-70" />
    </button>
  )
})

function ViewSortOptionsList({
  options,
  view,
  onUpdateView,
}: {
  options: OrderingField[]
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
}) {
  return (
    <PropertyPopoverList>
      <PropertyPopoverGroup>Order by</PropertyPopoverGroup>
      {options.map((option) => {
        const active = view.ordering === option
        return (
          <PropertyPopoverItem
            key={option}
            selected={active}
            onClick={() =>
              updateViewConfig(view, onUpdateView, { ordering: option })
            }
            trailing={
              active ? <Check className="size-3.5 text-accent-fg" /> : null
            }
          >
            {ORDERING_LABELS[option]}
          </PropertyPopoverItem>
        )
      })}
    </PropertyPopoverList>
  )
}

function ViewSortCompletedToggle({
  show,
  view,
  onUpdateView,
}: {
  show: boolean
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
}) {
  if (!show) {
    return null
  }

  return (
    <div className="flex items-center justify-between border-t border-line-soft px-3 py-2">
      <span className="text-[11px] text-fg-2">Hide completed</span>
      <Switch
        checked={!view.filters.showCompleted}
        onCheckedChange={(checked) =>
          updateViewConfig(view, onUpdateView, {
            showCompleted: !checked,
          })
        }
      />
    </div>
  )
}

export function ProjectLayoutTabs({
  view,
  onUpdateView,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
}) {
  return (
    <ViewLayoutTabsControl
      view={view}
      onUpdateView={onUpdateView}
      options={PROJECT_LAYOUT_OPTIONS}
    />
  )
}

export function ProjectLayoutChipPopover({
  view,
  onUpdateView,
  tone = "default",
  showLabel = true,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
  showLabel?: boolean
}) {
  return (
    <ViewLayoutChipPopover
      view={view}
      onUpdateView={onUpdateView}
      tone={tone}
      options={PROJECT_LAYOUT_OPTIONS}
      showLabel={showLabel}
    />
  )
}

type SortChipPopoverProps = {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
  label?: string
  showLabel?: boolean
  showValue?: boolean
}

function SortChipPopoverWithOptions({
  contentWidthClassName,
  options,
  showCompletedToggle,
  view,
  onUpdateView,
  tone = "default",
  label,
  showLabel = true,
  showValue = true,
}: SortChipPopoverProps & {
  contentWidthClassName: string
  options: OrderingField[]
  showCompletedToggle?: boolean
}) {
  return (
    <ViewSortChipPopover
      view={view}
      onUpdateView={onUpdateView}
      tone={tone}
      label={label}
      showLabel={showLabel}
      showValue={showValue}
      options={options}
      contentWidthClassName={contentWidthClassName}
      showCompletedToggle={showCompletedToggle}
    />
  )
}

export function ProjectSortChipPopover(props: SortChipPopoverProps) {
  return (
    <SortChipPopoverWithOptions
      {...props}
      options={PROJECT_ORDERING_OPTIONS}
      contentWidthClassName="w-[220px]"
      showCompletedToggle
    />
  )
}

export function LayoutTabs({
  view,
  onUpdateView,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
}) {
  return (
    <ViewLayoutTabsControl
      view={view}
      onUpdateView={onUpdateView}
      options={WORK_LAYOUT_OPTIONS}
    />
  )
}

export function LayoutChipPopover({
  view,
  onUpdateView,
  tone = "default",
  showLabel = true,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
  showLabel?: boolean
}) {
  return (
    <ViewLayoutChipPopover
      view={view}
      onUpdateView={onUpdateView}
      tone={tone}
      options={WORK_LAYOUT_OPTIONS}
      showLabel={showLabel}
    />
  )
}

export function GroupChipPopover({
  view,
  groupOptions = DEFAULT_GROUP_OPTIONS,
  onUpdateView,
  tone = "default",
  showValue = false,
  showLabel = true,
  label = "Group",
  showSubGrouping = true,
  getOptionLabel,
  groupingExperience,
}: {
  view: ViewDefinition
  groupOptions?: GroupField[]
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
  showValue?: boolean
  showLabel?: boolean
  label?: string
  showSubGrouping?: boolean
  getOptionLabel?: (field: GroupField) => string
  groupingExperience?: TeamExperienceType | null
}) {
  const resolvedGroupingExperience = useResolvedGroupingExperience(
    view,
    groupingExperience
  )
  const resolveOptionLabel = (field: GroupField | null) =>
    field
      ? (getOptionLabel?.(field) ??
        getContextualGroupFieldOptionLabel(field, {
          view,
          groupingExperience: resolvedGroupingExperience,
        }))
      : "None"
  const handleUpdateView = createViewConfigUpdater(view.id, onUpdateView)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ViewChipTrigger
          icon={<TreeStructure className="size-3.5" />}
          label={label}
          showLabel={showLabel}
          showValue={showValue}
          tone={tone}
          value={resolveOptionLabel(view.grouping)}
          valuePrefix={showLabel && label === "Group" ? "· " : ""}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          PROPERTY_POPOVER_CLASS,
          showSubGrouping ? "w-[360px]" : "w-[180px]"
        )}
      >
        <div
          className={cn(
            "grid",
            showSubGrouping
              ? "grid-cols-2 divide-x divide-line-soft"
              : "grid-cols-1"
          )}
        >
          <div className="flex min-w-0 flex-col">
            <PropertyPopoverGroup>Group by</PropertyPopoverGroup>
            <div className="no-scrollbar flex max-h-[320px] flex-col overflow-y-auto p-1">
              <PropertyPopoverItem
                selected={view.grouping === null}
                muted
                onClick={() =>
                  handleUpdateView({ grouping: null, subGrouping: null })
                }
                trailing={
                  view.grouping === null ? (
                    <Check className="size-3.5 text-accent-fg" />
                  ) : null
                }
              >
                None
              </PropertyPopoverItem>
              {groupOptions.map((option) => {
                const active = view.grouping === option
                return (
                  <PropertyPopoverItem
                    key={option}
                    selected={active}
                    onClick={() => handleUpdateView({ grouping: option })}
                    trailing={
                      active ? (
                        <Check className="size-3.5 text-accent-fg" />
                      ) : null
                    }
                  >
                    {resolveOptionLabel(option)}
                  </PropertyPopoverItem>
                )
              })}
            </div>
          </div>
          {showSubGrouping ? (
            <div className="flex min-w-0 flex-col">
              <PropertyPopoverGroup>Sub-group</PropertyPopoverGroup>
              <div className="no-scrollbar flex max-h-[320px] flex-col overflow-y-auto p-1">
                <PropertyPopoverItem
                  selected={view.subGrouping === null}
                  muted
                  onClick={() => handleUpdateView({ subGrouping: null })}
                  trailing={
                    view.subGrouping === null ? (
                      <Check className="size-3.5 text-accent-fg" />
                    ) : null
                  }
                >
                  None
                </PropertyPopoverItem>
                {groupOptions.map((option) => {
                  const disabled = view.grouping === option
                  const active = view.subGrouping === option
                  return (
                    <PropertyPopoverItem
                      key={`sub-${option}`}
                      selected={active}
                      muted={disabled}
                      onClick={() => {
                        if (disabled) {
                          return
                        }
                        handleUpdateView({ subGrouping: option })
                      }}
                      trailing={
                        active ? (
                          <Check className="size-3.5 text-accent-fg" />
                        ) : null
                      }
                    >
                      {resolveOptionLabel(option)}
                    </PropertyPopoverItem>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function SortChipPopover(props: SortChipPopoverProps) {
  return (
    <SortChipPopoverWithOptions
      {...props}
      options={orderingOptions}
      contentWidthClassName="w-[200px]"
    />
  )
}

function getPropertiesChipClassName({
  count,
  dashedWhenEmpty,
  showCount,
  tone,
}: {
  count: number
  dashedWhenEmpty: boolean
  showCount: boolean
  tone: ChipTone | "adaptive"
}) {
  const toneClass =
    tone === "adaptive"
      ? count > 0
        ? chipSelected
        : dashedWhenEmpty
          ? chipDashed
          : chipGhost
      : count === 0 && dashedWhenEmpty
        ? chipDashed
        : getChipToneClass(tone)

  return cn(chipBase, toneClass, !showCount && tone === "ghost" && chipMuted)
}

const PropertiesChipTrigger = forwardRef<
  HTMLButtonElement,
  {
    count: number
    dashedWhenEmpty: boolean
    label: string
    showCount: boolean
    showLabel?: boolean
    tone: ChipTone | "adaptive"
  } & ComponentPropsWithoutRef<"button">
>(function PropertiesChipTrigger(
  {
    className,
    count,
    dashedWhenEmpty,
    label,
    showCount,
    showLabel = true,
    tone,
    ...props
  },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      aria-label={showLabel ? undefined : label}
      className={cn(
        getPropertiesChipClassName({
          count,
          dashedWhenEmpty,
          showCount,
          tone,
        }),
        className
      )}
    >
      <Eye className="size-3.5 shrink-0" />
      {showLabel ? <span className="shrink-0">{label}</span> : null}
      {showCount ? (
        <span className="ml-0.5 shrink-0 rounded-full bg-background/40 px-1 text-[10px] tabular-nums">
          {count}
        </span>
      ) : null}
    </button>
  )
})

function EmptyPropertiesListItem({ label }: { label: string }) {
  return (
    <div className="px-1 pb-1">
      <PropertyPopoverItem muted className="pointer-events-none">
        {label}
      </PropertyPopoverItem>
    </div>
  )
}

export function PropertiesChipPopover({
  view,
  onToggleDisplayProperty,
  onReorderDisplayProperties,
  onClearDisplayProperties,
  tone = "adaptive",
  showCount = true,
  showLabel = true,
  label = "Properties",
  propertyOptions = displayPropertyOptions,
  dashedWhenEmpty = false,
  getPropertyLabel,
}: {
  view: ViewDefinition
  onToggleDisplayProperty?: (property: DisplayProperty) => void
  onReorderDisplayProperties?: (displayProps: DisplayProperty[]) => void
  onClearDisplayProperties?: () => void
  tone?: ChipTone | "adaptive"
  showCount?: boolean
  showLabel?: boolean
  label?: string
  propertyOptions?: DisplayProperty[]
  dashedWhenEmpty?: boolean
  getPropertyLabel?: (property: DisplayProperty) => string
}) {
  const [query, setQuery] = useState("")
  const allCustomDefinitions = useAppStore(
    (state) => state.customPropertyDefinitions
  )
  const currentUserId = useAppStore((state) => state.currentUserId)
  const privateTaskView = isPrivateTaskView(view)
  const customDefinitions = useMemo(() => {
    if (view.entityKind !== "items") {
      return []
    }

    if (view.scopeType === "team") {
      return allCustomDefinitions.filter(
        (definition) =>
          !definition.isArchived &&
          (definition.targetType ?? "workItem") === "workItem" &&
          getCustomPropertyScopeType(definition) === "team" &&
          definition.teamId === view.scopeId
      )
    }

    if (view.scopeType === "personal") {
      return allCustomDefinitions.filter(
        (definition) =>
          !definition.isArchived &&
          (definition.targetType ?? "workItem") === "workItem" &&
          (privateTaskView
            ? getCustomPropertyScopeType(definition) === "private" &&
              (definition.ownerId ?? definition.createdBy) === currentUserId
            : getCustomPropertyScopeType(definition) === "team") &&
          isCustomPropertyDefinitionVisibleToUser(definition, currentUserId)
      )
    }

    return []
  }, [
    allCustomDefinitions,
    currentUserId,
    privateTaskView,
    view.entityKind,
    view.scopeId,
    view.scopeType,
  ])
  const skipTogglePropertyRef = useRef<DisplayProperty | null>(null)
  const skipToggleResetTimeoutRef = useRef<number | null>(null)
  const resolvePropertyLabel =
    getPropertyLabel ??
    ((property: DisplayProperty) => {
      const customPropertyId = getCustomPropertyIdFromDisplayReference(property)

      if (customPropertyId) {
        return (
          customDefinitions.find(
            (definition) => definition.id === customPropertyId
          )?.name ?? "Custom property"
        )
      }

      return DISPLAY_PROPERTY_LABELS[property as BuiltinDisplayProperty]
    })
  const resolvedPropertyOptions = [
    ...getDisplayPropertyOptionsForView(view, propertyOptions),
    ...customDefinitions.map(
      (definition) => `custom:${definition.id}` as DisplayProperty
    ),
  ]
  const propertyOptionSet = new Set(resolvedPropertyOptions)
  const visibleProperties = view.displayProps.filter((property) =>
    propertyOptionSet.has(property)
  )
  const hiddenProperties = resolvedPropertyOptions.filter(
    (property) => !view.displayProps.includes(property)
  )
  const count = visibleProperties.length
  const trimmedQuery = query.trim().toLowerCase()
  const visibleFiltered = visibleProperties.filter((property) =>
    resolvePropertyLabel(property).toLowerCase().includes(trimmedQuery)
  )
  const hiddenFiltered = hiddenProperties.filter((property) =>
    resolvePropertyLabel(property).toLowerCase().includes(trimmedQuery)
  )
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 140,
        tolerance: 10,
      },
    })
  )

  function handleToggleDisplayProperty(property: DisplayProperty) {
    if (skipTogglePropertyRef.current === property) {
      skipTogglePropertyRef.current = null
      return
    }

    if (onToggleDisplayProperty) {
      onToggleDisplayProperty(property)
      return
    }

    useAppStore.getState().toggleViewDisplayProperty(view.id, property)
  }

  function handleReorderDisplayProperties(nextDisplayProps: DisplayProperty[]) {
    if (onReorderDisplayProperties) {
      onReorderDisplayProperties(nextDisplayProps)
      return
    }

    useAppStore
      .getState()
      .reorderViewDisplayProperties(view.id, nextDisplayProps)
  }

  function handleClearDisplayProperties() {
    if (onClearDisplayProperties) {
      onClearDisplayProperties()
      return
    }

    const activeProperties = [...visibleProperties]

    for (const property of activeProperties) {
      useAppStore.getState().toggleViewDisplayProperty(view.id, property)
    }
  }

  function suppressNextToggle(property: DisplayProperty) {
    skipTogglePropertyRef.current = property

    if (skipToggleResetTimeoutRef.current !== null) {
      window.clearTimeout(skipToggleResetTimeoutRef.current)
    }

    skipToggleResetTimeoutRef.current = window.setTimeout(() => {
      skipTogglePropertyRef.current = null
      skipToggleResetTimeoutRef.current = null
    }, 0)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    suppressNextToggle(active.id as DisplayProperty)

    const nextProperties = getReorderedDisplayPropertiesAfterDrag({
      activeId: active.id as DisplayProperty,
      overId: over?.id ? (over.id as DisplayProperty) : null,
      visibleProperties,
    })

    if (!nextProperties) {
      return
    }

    handleReorderDisplayProperties(nextProperties)
  }

  function handleDragCancel() {
    if (skipToggleResetTimeoutRef.current !== null) {
      window.clearTimeout(skipToggleResetTimeoutRef.current)
      skipToggleResetTimeoutRef.current = null
    }

    skipTogglePropertyRef.current = null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <PropertiesChipTrigger
          count={count}
          dashedWhenEmpty={dashedWhenEmpty}
          label={label}
          showCount={showCount}
          showLabel={showLabel}
          tone={tone}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        sideOffset={8}
        className={cn(
          PROPERTY_POPOVER_CLASS,
          "w-[min(420px,calc(100vw-2rem))] overflow-hidden p-0"
        )}
      >
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-3.5" />}
          placeholder="Filter properties…"
          value={query}
          onChange={setQuery}
        />
        <div className="grid grid-cols-2 divide-x divide-line-soft overflow-hidden">
          <PropertyPopoverList className="min-h-[240px] overflow-x-hidden px-0">
            <PropertyPopoverGroup>Visible · {count}</PropertyPopoverGroup>
            {visibleFiltered.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragStart={(event) => {
                  const property = event.active.id as DisplayProperty
                  suppressNextToggle(property)
                }}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={visibleFiltered}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="px-1 pb-1">
                    {visibleFiltered.map((property) => (
                      <SortableDisplayPropertyRow
                        key={property}
                        property={property}
                        label={resolvePropertyLabel(property)}
                        onToggle={() => handleToggleDisplayProperty(property)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <EmptyPropertiesListItem label="No visible properties" />
            )}
          </PropertyPopoverList>
          <PropertyPopoverList className="min-h-[240px] overflow-x-hidden px-0">
            <PropertyPopoverGroup>
              Hidden · {hiddenProperties.length}
            </PropertyPopoverGroup>
            {hiddenFiltered.length > 0 ? (
              <div className="px-1 pb-1">
                {hiddenFiltered.map((property) => (
                  <PropertyPopoverItem
                    key={property}
                    onClick={() => handleToggleDisplayProperty(property)}
                  >
                    {resolvePropertyLabel(property)}
                  </PropertyPopoverItem>
                ))}
              </div>
            ) : (
              <EmptyPropertiesListItem label="No hidden properties" />
            )}
          </PropertyPopoverList>
        </div>
        <PropertyPopoverFoot>
          <span>Drag visible properties to reorder</span>
          {count > 0 ? (
            <button
              type="button"
              className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
              onClick={handleClearDisplayProperties}
            >
              Clear all
            </button>
          ) : null}
        </PropertyPopoverFoot>
      </PopoverContent>
    </Popover>
  )
}

function SortableDisplayPropertyRow({
  property,
  label,
  onToggle,
}: {
  property: DisplayProperty
  label: string
  onToggle: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: property })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${label}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex h-8 w-full cursor-grab touch-none items-center gap-2 rounded-[5px] px-2 text-[12.5px] text-fg-2 transition-colors will-change-transform hover:bg-surface-3 hover:text-foreground active:cursor-grabbing",
        isDragging && "z-10 bg-surface-3 opacity-80 shadow-sm"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onToggle()
          }
        }}
        className="min-w-0 flex-1 truncate text-left"
      >
        {label}
      </button>
      <span
        aria-hidden
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] text-fg-4"
      >
        <DotsSixVertical className="size-3.5" />
      </span>
    </div>
  )
}

function isMyItemsParentLevelView(
  view: ViewDefinition,
  privateTaskView: boolean
) {
  return (
    !privateTaskView &&
    view.entityKind === "items" &&
    view.scopeType === "personal" &&
    view.route === "/assigned"
  )
}

function getLevelTaxonomyGroupKey(
  groups: ReturnType<typeof getWorkItemLevelTaxonomyGroups>,
  itemType: WorkItemType
) {
  return (
    groups.find((group) =>
      (group.options as readonly WorkItemType[]).includes(itemType)
    )?.key ?? null
  )
}

function getSelectedMyItemsParentLevels(
  view: ViewDefinition,
  itemLevelOptions: readonly WorkItemType[]
) {
  const selected = view.filters.itemTypes.filter((itemType) =>
    itemLevelOptions.includes(itemType)
  )

  if (selected.length > 0) {
    return selected
  }

  return view.itemLevel && itemLevelOptions.includes(view.itemLevel)
    ? [view.itemLevel]
    : []
}

function getNextMyItemsParentLevels(
  groups: ReturnType<typeof getWorkItemLevelTaxonomyGroups>,
  selectedLevels: WorkItemType[],
  itemType: WorkItemType
) {
  const groupKey = getLevelTaxonomyGroupKey(groups, itemType)

  if (!groupKey) {
    return selectedLevels
  }

  if (selectedLevels.includes(itemType)) {
    return selectedLevels.filter((level) => level !== itemType)
  }

  return [
    ...selectedLevels.filter(
      (level) => getLevelTaxonomyGroupKey(groups, level) !== groupKey
    ),
    itemType,
  ]
}

function getMyItemsParentLevelLabel(
  selectedLevels: WorkItemType[],
  experience: TeamExperienceType | null | undefined
) {
  if (selectedLevels.length === 0) {
    return "All parents"
  }

  if (selectedLevels.length === 1) {
    return getDisplayLabelForWorkItemType(selectedLevels[0], experience)
  }

  return `${selectedLevels.length} parents`
}

function getBaseItemLevelOptions({
  groupingExperience,
  isPrivateTaskView,
  personal,
  team,
  templateType,
}: {
  groupingExperience?: TeamExperienceType | null
  isPrivateTaskView: boolean
  personal: boolean
  team: Team | null
  templateType?: Project["templateType"] | null
}) {
  return getWorkItemLevelTaxonomyOptions({
    personal,
    privateOnly: isPrivateTaskView,
    teamExperience: groupingExperience ?? team?.settings.experience,
    templateType,
  })
}

function includeCurrentItemLevel(
  itemLevelOptions: readonly WorkItemType[],
  itemLevel: WorkItemType | null
) {
  if (!itemLevel || itemLevelOptions.includes(itemLevel)) {
    return itemLevelOptions
  }

  return [itemLevel, ...itemLevelOptions]
}

function getLevelChipItemOptions({
  groupingExperience,
  isPrivateTaskView,
  team,
  templateType,
  view,
}: {
  groupingExperience?: TeamExperienceType | null
  isPrivateTaskView: boolean
  team: Team | null
  templateType?: Project["templateType"] | null
  view: ViewDefinition
}) {
  if (view.entityKind !== "items") {
    return []
  }

  return includeCurrentItemLevel(
    getBaseItemLevelOptions({
      groupingExperience,
      isPrivateTaskView,
      personal: view.scopeType === "personal",
      team,
      templateType,
    }),
    view.itemLevel ?? null
  )
}

export function LevelChipPopover({
  view,
  onUpdateView,
  tone = "default",
  label = "Level",
  showLabel = true,
  showValue = false,
  groupingExperience,
  templateType,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
  label?: string
  showLabel?: boolean
  showValue?: boolean
  groupingExperience?: TeamExperienceType | null
  templateType?: Project["templateType"] | null
}) {
  const team = useAppStore((state) =>
    view.scopeType === "team" ? getTeam(state, view.scopeId) : null
  )
  const isPrivateTaskView = Boolean(
    view.entityKind === "items" &&
    view.filters.visibility?.length === 1 &&
    view.filters.visibility[0] === "private"
  )
  const isMyItemsLevelView = isMyItemsParentLevelView(view, isPrivateTaskView)
  const itemLevelExperience = isPrivateTaskView
    ? "project-management"
    : (groupingExperience ?? team?.settings.experience)
  const myItemsParentLevelGroups = useMemo(
    () =>
      getWorkItemLevelTaxonomyGroups({
        personal: true,
      }),
    []
  )
  const myItemsParentLevelOptions = useMemo(
    () => myItemsParentLevelGroups.flatMap((group) => group.options),
    [myItemsParentLevelGroups]
  )
  const itemLevelOptions = isMyItemsLevelView
    ? myItemsParentLevelOptions
    : getLevelChipItemOptions({
        groupingExperience,
        isPrivateTaskView,
        team,
        templateType,
        view,
      })

  if (view.entityKind !== "items" || itemLevelOptions.length === 0) {
    return null
  }

  const selectedMyItemsLevels = isMyItemsLevelView
    ? getSelectedMyItemsParentLevels(view, itemLevelOptions)
    : []
  const effectiveItemLevel =
    selectedMyItemsLevels[0] ?? view.itemLevel ?? itemLevelOptions[0] ?? null
  const childCopy = getChildWorkItemCopy(
    effectiveItemLevel,
    itemLevelExperience
  )
  const canShowChildItems = isMyItemsLevelView
    ? selectedMyItemsLevels.some((level) =>
        getDefaultShowChildItemsForItemLevel(level)
      )
    : Boolean(childCopy?.childType)
  const currentLabel = isMyItemsLevelView
    ? getMyItemsParentLevelLabel(selectedMyItemsLevels, itemLevelExperience)
    : effectiveItemLevel
      ? getDisplayLabelForWorkItemType(effectiveItemLevel, itemLevelExperience)
      : "Level"
  const handleUpdateView = createViewConfigUpdater(view.id, onUpdateView)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ViewChipTrigger
          icon={<Stack className="size-3.5" />}
          label={label}
          showLabel={showLabel}
          showValue={showValue}
          tone={tone}
          value={currentLabel}
          valuePrefix={showLabel ? "· " : ""}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
        {isMyItemsLevelView ? (
          <PropertyPopoverList>
            <PropertyPopoverGroup>Highest parent</PropertyPopoverGroup>
            {myItemsParentLevelGroups.map((group) => (
              <div key={group.key}>
                <PropertyPopoverGroup>{group.label}</PropertyPopoverGroup>
                {group.options.map((option) => {
                  const active = selectedMyItemsLevels.includes(option)
                  return (
                    <PropertyPopoverItem
                      key={option}
                      selected={active}
                      onClick={() => {
                        const nextLevels = getNextMyItemsParentLevels(
                          myItemsParentLevelGroups,
                          selectedMyItemsLevels,
                          option
                        )

                        handleUpdateView({
                          itemLevel: null,
                          filters: { itemTypes: nextLevels },
                          ...(nextLevels.length > 0
                            ? { showChildItems: true }
                            : {}),
                        })
                      }}
                      trailing={
                        active ? (
                          <Check className="size-3.5 text-accent-fg" />
                        ) : null
                      }
                    >
                      {getDisplayLabelForWorkItemType(
                        option,
                        itemLevelExperience
                      )}
                    </PropertyPopoverItem>
                  )
                })}
              </div>
            ))}
          </PropertyPopoverList>
        ) : (
          <PropertyPopoverList>
            <PropertyPopoverGroup>Highest parent</PropertyPopoverGroup>
            {itemLevelOptions.map((option) => {
              const active = effectiveItemLevel === option
              return (
                <PropertyPopoverItem
                  key={option}
                  selected={active}
                  onClick={() => {
                    const currentCanShowChildItems =
                      getDefaultShowChildItemsForItemLevel(effectiveItemLevel)
                    const nextCanShowChildItems =
                      getDefaultShowChildItemsForItemLevel(option)

                    handleUpdateView({
                      itemLevel: option,
                      ...(nextCanShowChildItems
                        ? currentCanShowChildItems
                          ? {}
                          : { showChildItems: true }
                        : { showChildItems: false }),
                    })
                  }}
                  trailing={
                    active ? (
                      <Check className="size-3.5 text-accent-fg" />
                    ) : null
                  }
                >
                  {getDisplayLabelForWorkItemType(option, itemLevelExperience)}
                </PropertyPopoverItem>
              )
            })}
          </PropertyPopoverList>
        )}
        {canShowChildItems ? (
          <div className="flex items-center justify-between gap-3 border-t border-line-soft px-2.5 py-2">
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-foreground">
                Show child items
              </div>
              <div className="text-[11px] text-fg-3">
                Nest the next child level beneath each parent.
              </div>
            </div>
            <Switch
              checked={Boolean(view.showChildItems)}
              onCheckedChange={(checked) =>
                handleUpdateView({
                  showChildItems: checked,
                })
              }
            />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
