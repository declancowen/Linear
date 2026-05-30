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
  GearSix,
  Kanban,
  MagnifyingGlass,
  Rows,
  SortAscending,
  SquaresFour,
  Stack,
  TreeStructure,
} from "@phosphor-icons/react"

import { ProjectIconGlyph, TeamIconGlyph } from "@/components/app/entity-icons"
import {
  getProjectStatusIconStatus,
  getReorderedDisplayPropertiesAfterDrag,
} from "@/components/app/screens/work-surface-control-state"
import { getStatusOrderForTeam, getTeam } from "@/lib/domain/selectors"
import {
  getCustomPropertyScopeType,
  isCustomPropertyDefinitionVisibleToUser,
} from "@/lib/domain/labels"
import {
  getCustomPropertyIdFromDisplayReference,
  getChildWorkItemCopy,
  getDefaultShowChildItemsForItemLevel,
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
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

import { isPersistedViewFilterKey, type ViewFilterKey } from "./helpers"
import { WorkItemAssigneeAvatar } from "./work-item-ui"
import {
  ConfigSelect,
  LabelColorDot,
  PriorityIcon,
  StatusIcon,
  WorkItemTypeIcon,
} from "./shared"
import {
  getGroupFieldOptionLabel as getContextualGroupFieldOptionLabel,
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
  "id",
  "status",
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
    view.entityKind === "items" && view.filters.visibility?.includes("private")
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
  grouping?: GroupField
  subGrouping?: GroupField | null
  ordering?: OrderingField
  itemLevel?: WorkItemType | null
  showChildItems?: boolean
  showCompleted?: boolean
  showEmptyGroups?: boolean
}

export function getGroupFieldOptionLabel(field: GroupField) {
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
    if (!item.assigneeId) {
      continue
    }

    const assignee = userById.get(item.assigneeId)

    if (assignee) {
      assignees.set(assignee.id, assignee)
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

function getVisibleFilterItemTypes(items: WorkItem[]) {
  return workItemTypes.filter((itemType) =>
    items.some((item) => item.type === itemType)
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

function useWorkFilterOptions(
  view: ViewDefinition,
  items: WorkItem[]
): WorkFilterOptions {
  const scopedItems = useMemo(
    () => getScopedFilterItems(view, items),
    [items, view]
  )
  const teamIds = useMemo(
    () => [
      ...new Set(
        scopedItems
          .filter((item) => (item.visibility ?? "team") === "team")
          .map((item) => item.teamId)
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
    () => labels.filter((entry) => labelIds.has(entry.id)),
    [labelIds, labels]
  )
  const filteredTeams = useMemo(
    () => teams.filter((team) => teamIds.includes(team.id)),
    [teamIds, teams]
  )
  const itemTypes = useMemo(
    () => getVisibleFilterItemTypes(scopedItems),
    [scopedItems]
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

const FilterTriggerButton = forwardRef<
  HTMLButtonElement,
  {
    activeCount: number
    className?: string
    icon?: ReactNode
    label: string
    variant: "icon" | "chip"
  } & ComponentPropsWithoutRef<"button">
>(function FilterTriggerButton(
  { activeCount, className, icon, label, type = "button", variant, ...props },
  ref
) {
  if (variant === "chip") {
    return (
      <button ref={ref} type={type} className={className} {...props}>
        <span className="shrink-0">
          {icon ?? <FunnelSimple className="size-3.5" />}
        </span>
        <span className="shrink-0">{label}</span>
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
  onToggleFilterValue,
  query,
  statusOptions,
  view,
}: {
  hidden: boolean
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  statusOptions: WorkFilterOptions["statusOptions"]
  view: ViewDefinition
}) {
  if (hidden) {
    return null
  }

  return (
    <FilterSection label="Status" activeCount={view.filters.status.length}>
      {statusOptions
        .filter((status) => matchesQuery(statusMeta[status].label, query))
        .map((status) => (
          <FilterRow
            key={status}
            icon={<StatusIcon status={status} />}
            label={statusMeta[status].label}
            active={view.filters.status.includes(status)}
            onClick={() => onToggleFilterValue("status", status)}
          />
        ))}
    </FilterSection>
  )
}

function PriorityFilterSection({
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

  return (
    <FilterSection label="Priority" activeCount={view.filters.priority.length}>
      {Object.entries(priorityMeta)
        .filter(([, meta]) => matchesQuery(meta.label, query))
        .map(([priority, meta]) => (
          <FilterRow
            key={priority}
            icon={<PriorityIcon priority={priority as Priority} />}
            label={meta.label}
            active={view.filters.priority.includes(priority as Priority)}
            onClick={() => onToggleFilterValue("priority", priority)}
          />
        ))}
    </FilterSection>
  )
}

function ItemTypeFilterSection({
  hidden,
  itemTypes,
  onToggleFilterValue,
  query,
  view,
}: {
  hidden: boolean
  itemTypes: WorkItemType[]
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  view: ViewDefinition
}) {
  if (hidden || itemTypes.length <= 1) {
    return null
  }

  return (
    <FilterSection label="Type" activeCount={view.filters.itemTypes.length}>
      {itemTypes
        .filter((itemType) =>
          matchesQuery(getDisplayLabelForWorkItemType(itemType, null), query)
        )
        .map((itemType) => (
          <FilterRow
            key={itemType}
            icon={<WorkItemTypeIcon itemType={itemType} />}
            label={getDisplayLabelForWorkItemType(itemType, null)}
            active={view.filters.itemTypes.includes(itemType)}
            onClick={() => onToggleFilterValue("itemTypes", itemType)}
          />
        ))}
    </FilterSection>
  )
}

function AssigneeFilterSection({
  assignees,
  hidden,
  onToggleFilterValue,
  query,
  view,
}: {
  assignees: UserProfile[]
  hidden: boolean
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
      activeCount={view.filters.assigneeIds.length}
    >
      {assignees
        .filter((assignee) => matchesQuery(assignee.name, query))
        .map((assignee) => (
          <FilterRow
            key={assignee.id}
            icon={
              <WorkItemAssigneeAvatar
                user={assignee}
                className="size-4 data-[size=sm]:size-4"
              />
            }
            label={assignee.name}
            active={view.filters.assigneeIds.includes(assignee.id)}
            onClick={() => onToggleFilterValue("assigneeIds", assignee.id)}
          />
        ))}
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
  onToggleFilterValue,
  query,
  teams,
  view,
}: {
  hidden: boolean
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  teams: Team[]
  view: ViewDefinition
}) {
  if (hidden || teams.length <= 1) {
    return null
  }

  return (
    <FilterSection label="Team space" activeCount={view.filters.teamIds.length}>
      {teams
        .filter((team) => matchesQuery(team.name, query))
        .map((team) => (
          <FilterRow
            key={team.id}
            icon={
              <TeamIconGlyph
                icon={team.icon}
                className="size-[13px] text-fg-3"
              />
            }
            label={team.name}
            active={view.filters.teamIds.includes(team.id)}
            onClick={() => onToggleFilterValue("teamIds", team.id)}
          />
        ))}
    </FilterSection>
  )
}

function ProjectFilterSection({
  hidden,
  onToggleFilterValue,
  projects,
  query,
  view,
}: {
  hidden: boolean
  onToggleFilterValue: ToggleWorkFilterValue
  projects: Project[]
  query: string
  view: ViewDefinition
}) {
  if (hidden || isPrivateTaskView(view) || projects.length === 0) {
    return null
  }

  return (
    <FilterSection label="Project" activeCount={view.filters.projectIds.length}>
      {projects
        .filter((project) => matchesQuery(project.name, query))
        .map((project) => (
          <FilterRow
            key={project.id}
            icon={
              <ProjectIconGlyph
                project={project}
                className="size-[13px] text-fg-3"
              />
            }
            label={project.name}
            active={view.filters.projectIds.includes(project.id)}
            onClick={() => onToggleFilterValue("projectIds", project.id)}
          />
        ))}
    </FilterSection>
  )
}

function getParentFilterActiveCount(view: ViewDefinition) {
  return getSelectedParentFilterValues(view.filters).length
}

function ParentFilterSection({
  hidden,
  onToggleFilterValue,
  parentLabel,
  parents,
  query,
  view,
}: {
  hidden: boolean
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
      activeCount={getParentFilterActiveCount(view)}
    >
      {parents
        .filter((parent) =>
          matchesQuery(`${parent.key} ${parent.title}`, query)
        )
        .map((parent) => (
          <FilterRow
            key={parent.id}
            icon={<TreeStructure className="size-3" />}
            label={`${parent.key} · ${parent.title}`}
            active={Boolean(view.filters.parentIds?.includes(parent.id))}
            onClick={() => onToggleFilterValue("parentIds", parent.id)}
          />
        ))}
    </FilterSection>
  )
}

function LabelFilterSection({
  hidden,
  labels,
  onToggleFilterValue,
  query,
  view,
}: {
  hidden: boolean
  labels: Label[]
  onToggleFilterValue: ToggleWorkFilterValue
  query: string
  view: ViewDefinition
}) {
  if (hidden || labels.length === 0) {
    return null
  }

  return (
    <FilterSection label="Labels" activeCount={view.filters.labelIds.length}>
      {labels
        .filter((label) => matchesQuery(label.name, query))
        .map((label) => (
          <FilterRow
            key={label.id}
            icon={<LabelColorDot color={label.color} />}
            label={label.name}
            active={view.filters.labelIds.includes(label.id)}
            onClick={() => onToggleFilterValue("labelIds", label.id)}
          />
        ))}
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
  onSetShowEmptyGroups,
  onToggleFilterValue,
  options,
  parentLabel,
  query,
  view,
}: {
  hiddenFilterSet: ReadonlySet<ViewFilterKey>
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
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        statusOptions={options.statusOptions}
        view={view}
      />
      <PriorityFilterSection
        hidden={hiddenFilterSet.has("priority")}
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        view={view}
      />
      <ItemTypeFilterSection
        hidden={hiddenFilterSet.has("itemTypes")}
        itemTypes={options.itemTypes}
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        view={view}
      />
      <AssigneeFilterSection
        assignees={options.assignees}
        hidden={hiddenFilterSet.has("assigneeIds")}
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
        onToggleFilterValue={onToggleFilterValue}
        query={query}
        teams={options.filteredTeams}
        view={view}
      />
      <ProjectFilterSection
        hidden={hiddenFilterSet.has("projectIds")}
        onToggleFilterValue={onToggleFilterValue}
        projects={options.filteredProjects}
        query={query}
        view={view}
      />
      <ParentFilterSection
        hidden={hiddenFilterSet.has("parentIds")}
        onToggleFilterValue={onToggleFilterValue}
        parentLabel={parentLabel}
        parents={options.filteredParents}
        query={query}
        view={view}
      />
      <LabelFilterSection
        hidden={hiddenFilterSet.has("labelIds")}
        labels={options.filteredLabels}
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
  triggerIcon,
  dashedWhenEmpty = false,
}: FilterPopoverProps) {
  const [query, setQuery] = useState("")
  const options = useWorkFilterOptions(view, items)
  const hiddenFilterSet = useMemo(() => new Set(hiddenFilters), [hiddenFilters])
  const activeCount = getWorkFilterActiveCount(view.filters)
  const resolvedGroupingExperience = useResolvedGroupingExperience(
    view,
    groupingExperience
  )
  const parentLabel = getParentGroupingLabel({
    view,
    groupingExperience: resolvedGroupingExperience,
  })

  function handleToggleFilterValue(key: ViewFilterKey, value: string) {
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
  }

  function handleSetShowEmptyGroups(showEmptyGroups: boolean) {
    updateViewConfig(view, onUpdateView, { showEmptyGroups })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterTriggerButton
          activeCount={activeCount}
          className={cn(
            chipBase,
            getWorkFilterChipClass({ activeCount, chipTone, dashedWhenEmpty })
          )}
          icon={triggerIcon}
          label={label}
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
          onSetShowEmptyGroups={handleSetShowEmptyGroups}
          onToggleFilterValue={handleToggleFilterValue}
          options={options}
          parentLabel={parentLabel}
          query={query}
          view={view}
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
}: {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <PropertyPopoverItem
      selected={active}
      onClick={onClick}
      trailing={active ? <Check className="size-3.5 text-accent-fg" /> : null}
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

export function ViewConfigPopover({
  view,
  onUpdateView,
  onToggleDisplayProperty,
  groupOptions = DEFAULT_GROUP_OPTIONS,
  groupingExperience,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  onToggleDisplayProperty?: (property: DisplayProperty) => void
  groupOptions?: GroupField[]
  groupingExperience?: TeamExperienceType | null
}) {
  const resolvedGroupingExperience = useResolvedGroupingExperience(
    view,
    groupingExperience
  )
  const resolveGroupLabel = (field: GroupField) =>
    getContextualGroupFieldOptionLabel(field, {
      view,
      groupingExperience: resolvedGroupingExperience,
    })

  function handleUpdateView(patch: ViewConfigPatch) {
    if (onUpdateView) {
      onUpdateView(patch)
      return
    }

    useAppStore.getState().updateViewConfig(view.id, patch)
  }

  function handleToggleDisplay(property: DisplayProperty) {
    if (onToggleDisplayProperty) {
      onToggleDisplayProperty(property)
      return
    }

    useAppStore.getState().toggleViewDisplayProperty(view.id, property)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost">
          <GearSix className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 overflow-hidden border border-line bg-surface p-0 shadow-lg"
      >
        <div className="border-b border-line-soft px-3 py-2.5">
          <div className="flex rounded-md bg-surface-2 p-0.5">
            {[
              {
                value: "list",
                label: "List",
                icon: <Rows className="size-3" />,
              },
              {
                value: "board",
                label: "Board",
                icon: <Kanban className="size-3" />,
              },
              {
                value: "timeline",
                label: "Timeline",
                icon: <ChartBarHorizontal className="size-3" />,
              },
              {
                value: "calendar",
                label: "Calendar",
                icon: <CalendarBlank className="size-3" />,
              },
            ].map((layout) => (
              <button
                key={layout.value}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] py-1.5 text-[11px] transition-all",
                  view.layout === layout.value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() =>
                  handleUpdateView({
                    layout: layout.value as ViewDefinition["layout"],
                  })
                }
              >
                {layout.icon}
                {layout.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col px-3 py-2">
          <div className="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Configuration
          </div>
          <ConfigSelect
            label="Grouping"
            value={view.grouping}
            options={groupOptions.map((option) => ({
              value: option,
              label: resolveGroupLabel(option),
            }))}
            onValueChange={(value) =>
              handleUpdateView({ grouping: value as GroupField })
            }
          />
          <ConfigSelect
            label="Sub-grouping"
            value={view.subGrouping ?? "none"}
            options={[
              { value: "none", label: "None" },
              ...groupOptions.map((option) => ({
                value: option,
                label: resolveGroupLabel(option),
              })),
            ]}
            onValueChange={(value) =>
              handleUpdateView({
                subGrouping: value === "none" ? null : (value as GroupField),
              })
            }
          />
          <ConfigSelect
            label="Ordering"
            value={view.ordering}
            options={orderingOptions.map((option) => ({
              value: option,
              label: ORDERING_LABELS[option],
            }))}
            onValueChange={(value) =>
              handleUpdateView({ ordering: value as OrderingField })
            }
          />
          <ConfigSelect
            label="Completed"
            value={String(view.filters.showCompleted)}
            options={[
              { value: "true", label: "Show all" },
              { value: "false", label: "Hide done" },
            ]}
            onValueChange={(value) =>
              handleUpdateView({ showCompleted: value === "true" })
            }
          />
        </div>

        <div className="border-t px-3 py-2.5">
          <div className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Properties
          </div>
          <div className="flex flex-wrap gap-1">
            {displayPropertyOptions.map((property) => (
              <button
                key={property}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  view.displayProps.includes(property)
                    ? "border-primary/30 bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
                onClick={() => handleToggleDisplay(property)}
              >
                {property}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
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

function getProjectFilterChipClass({
  activeCount,
  chipTone,
  dashedWhenEmpty,
}: {
  activeCount: number
  chipTone: ChipTone | "adaptive"
  dashedWhenEmpty: boolean
}) {
  if (chipTone === "adaptive") {
    if (activeCount > 0) {
      return chipSelected
    }

    return dashedWhenEmpty ? chipDashed : chipDefault
  }

  return activeCount === 0 && dashedWhenEmpty
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
    tone: ChipTone
  }
>(function ViewLayoutChipTrigger(
  { activeOption, className, tone, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(chipBase, getChipToneClass(tone), className)}
      {...props}
    >
      <span className="shrink-0">{activeOption?.icon}</span>
      <span className="shrink-0">{activeOption?.label ?? "Layout"}</span>
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
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone: ChipTone
  options: ViewLayoutOption[]
}) {
  const activeOption = getActiveViewLayoutOption(options, view.layout)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ViewLayoutChipTrigger activeOption={activeOption} tone={tone} />
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
  showValue,
  options,
  contentWidthClassName,
  showCompletedToggle = false,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone: ChipTone
  label?: string
  showValue: boolean
  options: OrderingField[]
  contentWidthClassName: string
  showCompletedToggle?: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(chipBase, "work-view-chip", getChipToneClass(tone))}
        >
          <SortAscending className="size-3.5 shrink-0" />
          <span className="shrink-0">
            {label ?? ORDERING_LABELS[view.ordering]}
          </span>
          {showValue ? (
            <span className="work-view-chip-value font-semibold">
              {label ? `· ${ORDERING_LABELS[view.ordering]}` : null}
            </span>
          ) : null}
          <CaretDown className="size-3 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, contentWidthClassName)}
      >
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
        {showCompletedToggle ? (
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
        ) : null}
      </PopoverContent>
    </Popover>
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
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
}) {
  return (
    <ViewLayoutChipPopover
      view={view}
      onUpdateView={onUpdateView}
      tone={tone}
      options={PROJECT_LAYOUT_OPTIONS}
    />
  )
}

type SortChipPopoverProps = {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
  label?: string
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
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
}) {
  return (
    <ViewLayoutChipPopover
      view={view}
      onUpdateView={onUpdateView}
      tone={tone}
      options={WORK_LAYOUT_OPTIONS}
    />
  )
}

export function GroupChipPopover({
  view,
  groupOptions = DEFAULT_GROUP_OPTIONS,
  onUpdateView,
  tone = "default",
  showValue = false,
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
  label?: string
  showSubGrouping?: boolean
  getOptionLabel?: (field: GroupField) => string
  groupingExperience?: TeamExperienceType | null
}) {
  const resolvedGroupingExperience = useResolvedGroupingExperience(
    view,
    groupingExperience
  )
  const resolveOptionLabel =
    getOptionLabel ??
    ((field: GroupField) =>
      getContextualGroupFieldOptionLabel(field, {
        view,
        groupingExperience: resolvedGroupingExperience,
      }))
  const handleUpdateView = createViewConfigUpdater(view.id, onUpdateView)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ViewChipTrigger
          icon={<TreeStructure className="size-3.5" />}
          label={label}
          showValue={showValue}
          tone={tone}
          value={resolveOptionLabel(view.grouping)}
          valuePrefix={label === "Group" ? "· " : ""}
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
    tone: ChipTone | "adaptive"
  } & ComponentPropsWithoutRef<"button">
>(function PropertiesChipTrigger(
  { className, count, dashedWhenEmpty, label, showCount, tone, ...props },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type="button"
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
      <span className="shrink-0">{label}</span>
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
  const customDefinitions = useMemo(() => {
    if (view.entityKind !== "items") {
      return []
    }

    if (view.scopeType === "team") {
      return allCustomDefinitions.filter(
        (definition) =>
          !definition.isArchived &&
          getCustomPropertyScopeType(definition) === "team" &&
          definition.teamId === view.scopeId
      )
    }

    if (view.scopeType === "personal") {
      return allCustomDefinitions.filter(
        (definition) =>
          !definition.isArchived &&
          isCustomPropertyDefinitionVisibleToUser(definition, currentUserId)
      )
    }

    return []
  }, [
    allCustomDefinitions,
    currentUserId,
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

const privateTaskLevelOptions = ["task"] satisfies WorkItemType[]

function getBaseItemLevelOptions({
  isPrivateTaskView,
  team,
}: {
  isPrivateTaskView: boolean
  team: Team | null
}) {
  if (isPrivateTaskView) {
    return privateTaskLevelOptions
  }

  if (team) {
    return getDefaultWorkItemTypesForTeamExperience(team.settings.experience)
  }

  return workItemTypes
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
  isPrivateTaskView,
  team,
  view,
}: {
  isPrivateTaskView: boolean
  team: Team | null
  view: ViewDefinition
}) {
  if (view.entityKind !== "items") {
    return []
  }

  return includeCurrentItemLevel(
    getBaseItemLevelOptions({ isPrivateTaskView, team }),
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
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
  label?: string
  showLabel?: boolean
  showValue?: boolean
}) {
  const team = useAppStore((state) =>
    view.scopeType === "team" ? getTeam(state, view.scopeId) : null
  )
  const isPrivateTaskView = Boolean(
    view.entityKind === "items" && view.filters.visibility?.includes("private")
  )
  const itemLevelExperience = isPrivateTaskView
    ? "project-management"
    : team?.settings.experience
  const itemLevelOptions = getLevelChipItemOptions({
    isPrivateTaskView,
    team,
    view,
  })

  if (view.entityKind !== "items" || itemLevelOptions.length === 0) {
    return null
  }

  const effectiveItemLevel = view.itemLevel ?? itemLevelOptions[0] ?? null
  const childCopy = getChildWorkItemCopy(
    effectiveItemLevel,
    itemLevelExperience
  )
  const canShowChildItems = Boolean(childCopy?.childType)
  const currentLabel = effectiveItemLevel
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
                  active ? <Check className="size-3.5 text-accent-fg" /> : null
                }
              >
                {getDisplayLabelForWorkItemType(option, itemLevelExperience)}
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
        {canShowChildItems ? (
          <div className="flex items-center justify-between gap-3 border-t border-line-soft px-2.5 py-2">
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-foreground">
                Show {childCopy?.childPluralLabel.toLowerCase()}
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
