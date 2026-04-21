"use client"

import {
  useMemo,
  useRef,
  useState,
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
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import {
  CalendarDots,
  CaretDown,
  Check,
  DotsSixVertical,
  Eye,
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

import { getStatusOrderForTeam, getTeam } from "@/lib/domain/selectors"
import {
  EMPTY_PARENT_FILTER_VALUE,
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
  type DisplayProperty,
  type GroupField,
  type OrderingField,
  type Priority,
  type Project,
  type ViewDefinition,
  type WorkItem,
  type WorkItemType,
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
import { ConfigSelect, PriorityIcon, StatusIcon } from "./shared"
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
}

const PROJECT_ORDERING_OPTIONS: OrderingField[] = [
  "priority",
  "updatedAt",
  "createdAt",
  "targetDate",
  "title",
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
  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"

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

export const displayPropertyOptions: DisplayProperty[] = [
  "type",
  "status",
  "assignee",
  "priority",
  "progress",
  "project",
  "dueDate",
  "milestone",
  "labels",
  "created",
  "updated",
]

const DISPLAY_PROPERTY_LABELS: Record<DisplayProperty, string> = {
  id: "ID",
  type: "Type",
  status: "Status",
  assignee: "Assignee",
  priority: "Priority",
  progress: "Progress",
  project: "Project",
  dueDate: "Due date",
  milestone: "Milestone",
  labels: "Labels",
  created: "Created",
  updated: "Updated",
}

const DEFAULT_GROUP_OPTIONS: GroupField[] = [
  "project",
  "status",
  "assignee",
  "priority",
  "label",
  "team",
  "type",
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

export const orderingOptions: OrderingField[] = [
  "priority",
  "updatedAt",
  "createdAt",
  "dueDate",
  "targetDate",
  "title",
]

export type ViewConfigPatch = {
  layout?: ViewDefinition["layout"]
  grouping?: GroupField
  subGrouping?: GroupField | null
  ordering?: OrderingField
  itemLevel?: WorkItemType | null
  showChildItems?: boolean
  showCompleted?: boolean
}

export function getGroupFieldOptionLabel(field: GroupField) {
  if (field === "status") {
    return "Status"
  }

  if (field === "assignee") {
    return "Assignee"
  }

  if (field === "priority") {
    return "Priority"
  }

  if (field === "label") {
    return "Label"
  }

  if (field === "project") {
    return "Project"
  }

  if (field === "team") {
    return "Team"
  }

  if (field === "type") {
    return "Type"
  }

  if (field === "epic") {
    return "Epic"
  }

  return "Feature"
}

function matchesQuery(label: string, query: string) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) {
    return true
  }
  return label.toLowerCase().includes(trimmed)
}

export function FilterPopover({
  view,
  items,
  onToggleFilterValue,
  onClearFilters,
  variant = "icon",
  chipTone = "adaptive",
  label = "Filter",
  dashedWhenEmpty = false,
}: {
  view: ViewDefinition
  items: WorkItem[]
  onToggleFilterValue?: (key: ViewFilterKey, value: string) => void
  onClearFilters?: () => void
  variant?: "icon" | "chip"
  chipTone?: ChipTone | "adaptive"
  label?: string
  dashedWhenEmpty?: boolean
}) {
  const [query, setQuery] = useState("")
  const scopedItems = useMemo(
    () =>
      view.itemLevel
        ? items.filter((item) => item.type === view.itemLevel)
        : items,
    [items, view.itemLevel]
  )
  const teamIds = useMemo(
    () => [...new Set(scopedItems.map((item) => item.teamId))],
    [scopedItems]
  )
  const singleTeamId = teamIds.length === 1 ? teamIds[0] : null
  const singleTeam = useAppStore((state) =>
    singleTeamId ? getTeam(state, singleTeamId) : null
  )
  const users = useAppStore((state) => state.users)
  const projects = useAppStore((state) => state.projects)
  const labels = useAppStore((state) => state.labels)
  const userById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )
  const projectIds = useMemo(() => {
    const next = new Set<string>()

    for (const item of scopedItems) {
      if (item.primaryProjectId) {
        next.add(item.primaryProjectId)
      }
    }

    return next
  }, [scopedItems])
  const labelIds = useMemo(() => {
    const next = new Set<string>()

    for (const item of scopedItems) {
      for (const labelId of item.labelIds) {
        next.add(labelId)
      }
    }

    return next
  }, [scopedItems])
  const assignees = useMemo(() => {
    const next = new Map<string, (typeof users)[number]>()

    for (const item of scopedItems) {
      if (!item.assigneeId) {
        continue
      }

      const assignee = userById.get(item.assigneeId)

      if (assignee) {
        next.set(assignee.id, assignee)
      }
    }

    return [...next.values()]
  }, [scopedItems, userById])
  const filteredProjects = useMemo(
    () => projects.filter((project) => projectIds.has(project.id)),
    [projectIds, projects]
  )
  const filteredLabels = useMemo(
    () => labels.filter((label) => labelIds.has(label.id)),
    [labelIds, labels]
  )
  const itemTypes = workItemTypes.filter((itemType) =>
    scopedItems.some((item) => item.type === itemType)
  )
  const statusOptions = getStatusOrderForTeam(singleTeam)

  const activeCount =
    view.filters.status.length +
    view.filters.priority.length +
    view.filters.assigneeIds.length +
    view.filters.projectIds.length +
    (view.filters.parentIds?.length ?? 0) +
    view.filters.itemTypes.length +
    view.filters.labelIds.length

  function handleToggleFilterValue(key: ViewFilterKey, value: string) {
    if (onToggleFilterValue) {
      onToggleFilterValue(key, value)
      return
    }

    if (!isPersistedViewFilterKey(key)) {
      return
    }

    useAppStore.getState().toggleViewFilterValue(view.id, key, value)
  }

  function handleClearFilters() {
    if (onClearFilters) {
      onClearFilters()
      return
    }

    useAppStore.getState().clearViewFilters(view.id)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === "chip" ? (
          <button
            type="button"
            className={cn(
              chipBase,
              chipTone === "adaptive"
                ? activeCount > 0
                  ? chipSelected
                  : dashedWhenEmpty
                    ? chipDashed
                    : chipGhost
                : activeCount === 0 && dashedWhenEmpty
                  ? chipDashed
                  : getChipToneClass(chipTone)
            )}
          >
            <FunnelSimple className="size-3.5" />
            <span>{label}</span>
            {activeCount > 0 ? (
              <span className="ml-0.5 rounded-full bg-background/40 px-1 text-[10px] tabular-nums">
                {activeCount}
              </span>
            ) : null}
          </button>
        ) : (
          <Button size="icon-xs" variant="ghost" className="relative">
            <FadersHorizontal className="size-3.5" />
            {activeCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
                {activeCount}
              </span>
            ) : null}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
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
        <div className="flex max-h-[360px] flex-col overflow-y-auto">
          <FilterSection
            label="Status"
            activeCount={view.filters.status.length}
          >
            {statusOptions
              .filter((status) => matchesQuery(statusMeta[status].label, query))
              .map((status) => (
                <FilterRow
                  key={status}
                  icon={<StatusIcon status={status} />}
                  label={statusMeta[status].label}
                  active={view.filters.status.includes(status)}
                  onClick={() => handleToggleFilterValue("status", status)}
                />
              ))}
          </FilterSection>
          <FilterSection
            label="Priority"
            activeCount={view.filters.priority.length}
          >
            {Object.entries(priorityMeta)
              .filter(([, meta]) => matchesQuery(meta.label, query))
              .map(([priority, meta]) => (
                <FilterRow
                  key={priority}
                  icon={<PriorityIcon priority={priority as Priority} />}
                  label={meta.label}
                  active={view.filters.priority.includes(priority as Priority)}
                  onClick={() => handleToggleFilterValue("priority", priority)}
                />
              ))}
          </FilterSection>
          {itemTypes.length > 0 ? (
            <FilterSection
              label="Type"
              activeCount={view.filters.itemTypes.length}
            >
              {itemTypes
                .filter((itemType) =>
                  matchesQuery(
                    getDisplayLabelForWorkItemType(
                      itemType as WorkItemType,
                      null
                    ),
                    query
                  )
                )
                .map((itemType) => (
                  <FilterRow
                    key={itemType}
                    icon={<ColorDot />}
                    label={getDisplayLabelForWorkItemType(
                      itemType as WorkItemType,
                      null
                    )}
                    active={view.filters.itemTypes.includes(itemType)}
                    onClick={() =>
                      handleToggleFilterValue("itemTypes", itemType)
                    }
                  />
                ))}
            </FilterSection>
          ) : null}
          {assignees.length > 0 ? (
            <FilterSection
              label="Assignee"
              activeCount={view.filters.assigneeIds.length}
            >
              {assignees
                .filter((assignee) => matchesQuery(assignee.name, query))
                .map((assignee) => (
                  <FilterRow
                    key={assignee.id}
                    icon={<InitialAvatar name={assignee.name} />}
                    label={assignee.name}
                    active={view.filters.assigneeIds.includes(assignee.id)}
                    onClick={() =>
                      handleToggleFilterValue("assigneeIds", assignee.id)
                    }
                  />
                ))}
            </FilterSection>
          ) : null}
          {filteredProjects.length > 0 ? (
            <FilterSection
              label="Project"
              activeCount={view.filters.projectIds.length}
            >
              {filteredProjects
                .filter((project) => matchesQuery(project.name, query))
                .map((project) => (
                  <FilterRow
                    key={project.id}
                    icon={<InitialAvatar name={project.name} />}
                    label={project.name}
                    active={view.filters.projectIds.includes(project.id)}
                    onClick={() =>
                      handleToggleFilterValue("projectIds", project.id)
                    }
                  />
                ))}
            </FilterSection>
          ) : null}
          <FilterSection
            label="Under"
            activeCount={view.filters.parentIds?.length ?? 0}
          >
            {matchesQuery("Is empty", query) ? (
              <FilterRow
                icon={<TreeStructure className="size-3" />}
                label="Is empty"
                active={Boolean(
                  view.filters.parentIds?.includes(EMPTY_PARENT_FILTER_VALUE)
                )}
                onClick={() =>
                  handleToggleFilterValue(
                    "parentIds",
                    EMPTY_PARENT_FILTER_VALUE
                  )
                }
              />
            ) : null}
          </FilterSection>
          {filteredLabels.length > 0 ? (
            <FilterSection
              label="Labels"
              activeCount={view.filters.labelIds.length}
            >
              {filteredLabels
                .filter((label) => matchesQuery(label.name, query))
                .map((label) => (
                  <FilterRow
                    key={label.id}
                    icon={<ColorDot color={label.color} />}
                    label={label.name}
                    active={view.filters.labelIds.includes(label.id)}
                    onClick={() =>
                      handleToggleFilterValue("labelIds", label.id)
                    }
                  />
                ))}
            </FilterSection>
          ) : null}
        </div>
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

function InitialAvatar({ name, color }: { name: string; color?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?"
  return (
    <span
      aria-hidden
      className="flex size-[14px] shrink-0 items-center justify-center rounded-full text-[8.5px] font-semibold text-foreground"
      style={{
        background: color ?? "var(--surface-3)",
      }}
    >
      {initial}
    </span>
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
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  onToggleDisplayProperty?: (property: DisplayProperty) => void
  groupOptions?: GroupField[]
}) {
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
                icon: <CalendarDots className="size-3" />,
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
              label: getGroupFieldOptionLabel(option),
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
                label: getGroupFieldOptionLabel(option),
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
              label: option,
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
                    ? "border-primary/30 bg-primary/10 font-medium text-foreground"
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
    () => projectStatuses.filter((status) => projects.some((project) => project.status === status)),
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
    if (onToggleFilterValue) {
      onToggleFilterValue(key, value)
      return
    }

    useAppStore.getState().toggleViewFilterValue(view.id, key, value)
  }

  function handleClearFilters() {
    if (onClearFilters) {
      onClearFilters()
      return
    }

    useAppStore.getState().clearViewFilters(view.id)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === "chip" ? (
          <button
            type="button"
            className={cn(
              chipBase,
              chipTone === "adaptive"
                ? activeCount > 0
                  ? chipSelected
                  : dashedWhenEmpty
                    ? chipDashed
                    : chipDefault
                : activeCount === 0 && dashedWhenEmpty
                  ? chipDashed
                  : getChipToneClass(chipTone)
            )}
          >
            <FunnelSimple className="size-3.5" />
            <span>{label}</span>
            {activeCount > 0 ? (
              <span className="ml-0.5 rounded-full bg-background/40 px-1 text-[10px] tabular-nums">
                {activeCount}
              </span>
            ) : null}
          </button>
        ) : (
          <Button size="icon-xs" variant="ghost" className="relative">
            <FadersHorizontal className="size-3.5" />
            {activeCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
                {activeCount}
              </span>
            ) : null}
          </Button>
        )}
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
        <div className="flex max-h-[360px] flex-col overflow-y-auto">
          {statusOptions.length > 0 ? (
            <FilterSection
              label="Status"
              activeCount={view.filters.status.length}
            >
              {statusOptions
                .filter((status) =>
                  matchesQuery(
                    projectStatusMeta[status].label,
                    query
                  )
                )
                .map((status) => (
                  <FilterRow
                    key={status}
                    icon={
                      <StatusIcon
                        status={
                          status === "in-progress"
                            ? "in-progress"
                            : status === "completed"
                              ? "completed"
                              : status === "cancelled"
                                ? "cancelled"
                                : status === "backlog"
                                  ? "backlog"
                                  : "todo"
                        }
                      />
                    }
                    label={
                      projectStatusMeta[status].label
                    }
                    active={view.filters.status.includes(status)}
                    onClick={() => handleToggleFilterValue("status", status)}
                  />
                ))}
            </FilterSection>
          ) : null}
          <FilterSection
            label="Priority"
            activeCount={view.filters.priority.length}
          >
            {Object.entries(priorityMeta)
              .filter(([, meta]) => matchesQuery(meta.label, query))
              .map(([priority, meta]) => (
                <FilterRow
                  key={priority}
                  icon={<PriorityIcon priority={priority as Priority} />}
                  label={meta.label}
                  active={view.filters.priority.includes(priority as Priority)}
                  onClick={() => handleToggleFilterValue("priority", priority)}
                />
              ))}
          </FilterSection>
          {healthOptions.length > 0 ? (
            <FilterSection
              label="Health"
              activeCount={view.filters.health.length}
            >
              {healthOptions
                .filter((health) =>
                  matchesQuery(
                    projectHealthMeta[health as keyof typeof projectHealthMeta]
                      .label,
                    query
                  )
                )
                .map((health) => (
                  <FilterRow
                    key={health}
                    icon={
                      <ColorDot
                        color={
                          HEALTH_COLOR[health as keyof typeof HEALTH_COLOR]
                        }
                      />
                    }
                    label={
                      projectHealthMeta[
                        health as keyof typeof projectHealthMeta
                      ].label
                    }
                    active={view.filters.health.includes(health as never)}
                    onClick={() => handleToggleFilterValue("health", health)}
                  />
                ))}
            </FilterSection>
          ) : null}
          {leads.length > 0 ? (
            <FilterSection
              label="Lead"
              activeCount={view.filters.leadIds.length}
            >
              {leads
                .filter((lead) => matchesQuery(lead.name, query))
                .map((lead) => (
                  <FilterRow
                    key={lead.id}
                    icon={<InitialAvatar name={lead.name} />}
                    label={lead.name}
                    active={view.filters.leadIds.includes(lead.id)}
                    onClick={() => handleToggleFilterValue("leadIds", lead.id)}
                  />
                ))}
            </FilterSection>
          ) : null}
          {projectTeams.length > 0 ? (
            <FilterSection
              label="Team"
              activeCount={view.filters.teamIds.length}
            >
              {projectTeams
                .filter((team) => matchesQuery(team.name, query))
                .map((team) => (
                  <FilterRow
                    key={team.id}
                    icon={<InitialAvatar name={team.name} />}
                    label={team.name}
                    active={view.filters.teamIds.includes(team.id)}
                    onClick={() => handleToggleFilterValue("teamIds", team.id)}
                  />
                ))}
            </FilterSection>
          ) : null}
        </div>
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
  const tabs: Array<{
    value: "list" | "board"
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

  function handleUpdateView(patch: ViewConfigPatch) {
    if (onUpdateView) {
      onUpdateView(patch)
      return
    }

    useAppStore.getState().updateViewConfig(view.id, patch)
  }

  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => (
        <ViewTab
          key={tab.value}
          active={view.layout === tab.value}
          onClick={() => handleUpdateView({ layout: tab.value })}
        >
          {tab.icon}
          {tab.label}
        </ViewTab>
      ))}
    </div>
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
  const options: Array<{
    value: "list" | "board"
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

  const activeOption =
    options.find((option) => option.value === view.layout) ?? options[0]

  function handleUpdateView(patch: ViewConfigPatch) {
    if (onUpdateView) {
      onUpdateView(patch)
      return
    }

    useAppStore.getState().updateViewConfig(view.id, patch)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chipBase, getChipToneClass(tone))}>
          {activeOption.icon}
          <span>{activeOption.label}</span>
          <CaretDown className="size-3 opacity-70" />
        </button>
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
              <PropertyPopoverItem
                key={option.value}
                selected={active}
                onClick={() => handleUpdateView({ layout: option.value })}
                trailing={
                  active ? <Check className="size-3.5 text-accent-fg" /> : null
                }
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {option.icon}
                </span>
                <span>{option.label}</span>
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

export function ProjectSortChipPopover({
  view,
  onUpdateView,
  tone = "default",
  label,
  showValue = true,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
  label?: string
  showValue?: boolean
}) {
  function handleUpdateView(patch: ViewConfigPatch) {
    if (onUpdateView) {
      onUpdateView(patch)
      return
    }

    useAppStore.getState().updateViewConfig(view.id, patch)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chipBase, getChipToneClass(tone))}>
          <SortAscending className="size-3.5" />
          <span>{label ?? ORDERING_LABELS[view.ordering]}</span>
          {showValue ? (
            <span className="font-semibold">
              {label ? `· ${ORDERING_LABELS[view.ordering]}` : null}
            </span>
          ) : null}
          <CaretDown className="size-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverGroup>Order by</PropertyPopoverGroup>
          {PROJECT_ORDERING_OPTIONS.map((option) => {
            const active = view.ordering === option
            return (
              <PropertyPopoverItem
                key={option}
                selected={active}
                onClick={() => handleUpdateView({ ordering: option })}
                trailing={
                  active ? <Check className="size-3.5 text-accent-fg" /> : null
                }
              >
                {ORDERING_LABELS[option]}
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
        <div className="flex items-center justify-between border-t border-line-soft px-3 py-2">
          <span className="text-[11px] text-fg-2">Hide completed</span>
          <Switch
            checked={!view.filters.showCompleted}
            onCheckedChange={(checked) =>
              handleUpdateView({ showCompleted: !checked })
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ProjectViewConfigPopover({
  view,
  extraAction,
}: {
  view: ViewDefinition
  extraAction?: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost">
          <GearSix className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 overflow-hidden border border-line bg-surface p-0 shadow-lg"
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
                  useAppStore.getState().updateViewConfig(view.id, {
                    layout: layout.value as "list" | "board",
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
            label="Ordering"
            value={view.ordering}
            options={[
              { value: "priority", label: "Priority" },
              { value: "updatedAt", label: "Updated" },
              { value: "createdAt", label: "Created" },
              { value: "targetDate", label: "Target date" },
              { value: "title", label: "Name" },
            ]}
            onValueChange={(value) =>
              useAppStore.getState().updateViewConfig(view.id, {
                ordering: value as OrderingField,
              })
            }
          />
          <ConfigSelect
            label="Completed"
            value={String(view.filters.showCompleted)}
            options={[
              { value: "true", label: "Show all" },
              { value: "false", label: "Hide completed" },
            ]}
            onValueChange={(value) =>
              useAppStore.getState().updateViewConfig(view.id, {
                showCompleted: value === "true",
              })
            }
          />
        </div>
        {extraAction ? (
          <>
            <div className="border-t px-3 py-2">{extraAction}</div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export function LayoutTabs({
  view,
  onUpdateView,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
}) {
  const tabs: Array<{
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
    {
      value: "timeline",
      label: "Timeline",
      icon: <CalendarDots className="size-3.5" />,
    },
  ]

  function handleUpdateView(patch: ViewConfigPatch) {
    if (onUpdateView) {
      onUpdateView(patch)
      return
    }

    useAppStore.getState().updateViewConfig(view.id, patch)
  }

  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => (
        <ViewTab
          key={tab.value}
          active={view.layout === tab.value}
          onClick={() => handleUpdateView({ layout: tab.value })}
        >
          {tab.icon}
          {tab.label}
        </ViewTab>
      ))}
    </div>
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
  const options: Array<{
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
    {
      value: "timeline",
      label: "Timeline",
      icon: <CalendarDots className="size-3.5" />,
    },
  ]

  const activeOption =
    options.find((option) => option.value === view.layout) ?? options[0]

  function handleUpdateView(patch: ViewConfigPatch) {
    if (onUpdateView) {
      onUpdateView(patch)
      return
    }

    useAppStore.getState().updateViewConfig(view.id, patch)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chipBase, getChipToneClass(tone))}>
          {activeOption?.icon}
          <span>{activeOption?.label ?? "Layout"}</span>
          <CaretDown className="size-3 opacity-70" />
        </button>
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
              <PropertyPopoverItem
                key={option.value}
                selected={active}
                onClick={() => handleUpdateView({ layout: option.value })}
                trailing={
                  active ? <Check className="size-3.5 text-accent-fg" /> : null
                }
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {option.icon}
                </span>
                <span>{option.label}</span>
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

export function GroupChipPopover({
  view,
  groupOptions = DEFAULT_GROUP_OPTIONS,
  onUpdateView,
  tone = "default",
  showValue = true,
  label = "Group",
  showSubGrouping = true,
  getOptionLabel,
}: {
  view: ViewDefinition
  groupOptions?: GroupField[]
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
  showValue?: boolean
  label?: string
  showSubGrouping?: boolean
  getOptionLabel?: (field: GroupField) => string
}) {
  const resolveOptionLabel = getOptionLabel ?? getGroupFieldOptionLabel

  function handleUpdateView(patch: ViewConfigPatch) {
    if (onUpdateView) {
      onUpdateView(patch)
      return
    }

    useAppStore.getState().updateViewConfig(view.id, patch)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chipBase, getChipToneClass(tone))}>
          <TreeStructure className="size-3.5" />
          <span>{label}</span>
          {showValue ? (
            <span className="font-semibold">
              {label === "Group" ? "· " : ""}
              {resolveOptionLabel(view.grouping)}
            </span>
          ) : null}
          <CaretDown className="size-3 opacity-70" />
        </button>
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
            <div className="flex max-h-[320px] flex-col overflow-y-auto p-1">
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
              <div className="flex max-h-[320px] flex-col overflow-y-auto p-1">
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

export function SortChipPopover({
  view,
  onUpdateView,
  tone = "default",
  label,
  showValue = true,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  tone?: ChipTone
  label?: string
  showValue?: boolean
}) {
  function handleUpdateView(patch: ViewConfigPatch) {
    if (onUpdateView) {
      onUpdateView(patch)
      return
    }

    useAppStore.getState().updateViewConfig(view.id, patch)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chipBase, getChipToneClass(tone))}>
          <SortAscending className="size-3.5" />
          <span>{label ?? ORDERING_LABELS[view.ordering]}</span>
          {showValue ? (
            <span className="font-semibold">
              {label ? `· ${ORDERING_LABELS[view.ordering]}` : null}
            </span>
          ) : null}
          <CaretDown className="size-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[200px]")}
      >
        <PropertyPopoverList>
          <PropertyPopoverGroup>Order by</PropertyPopoverGroup>
          {orderingOptions.map((option) => {
            const active = view.ordering === option
            return (
              <PropertyPopoverItem
                key={option}
                selected={active}
                onClick={() => handleUpdateView({ ordering: option })}
                trailing={
                  active ? <Check className="size-3.5 text-accent-fg" /> : null
                }
              >
                {ORDERING_LABELS[option]}
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
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
  const [activeDragProperty, setActiveDragProperty] =
    useState<DisplayProperty | null>(null)
  const skipTogglePropertyRef = useRef<DisplayProperty | null>(null)
  const skipToggleResetTimeoutRef = useRef<number | null>(null)
  const resolvePropertyLabel =
    getPropertyLabel ??
    ((property: DisplayProperty) => DISPLAY_PROPERTY_LABELS[property])
  const propertyOptionSet = new Set(propertyOptions)
  const visibleProperties = view.displayProps.filter((property) =>
    propertyOptionSet.has(property)
  )
  const hiddenProperties = propertyOptions.filter(
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

    useAppStore.getState().reorderViewDisplayProperties(view.id, nextDisplayProps)
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

    setActiveDragProperty(null)
    suppressNextToggle(active.id as DisplayProperty)

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = visibleProperties.indexOf(active.id as DisplayProperty)
    const newIndex = visibleProperties.indexOf(over.id as DisplayProperty)

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    handleReorderDisplayProperties(
      arrayMove(visibleProperties, oldIndex, newIndex)
    )
  }

  function handleDragCancel() {
    setActiveDragProperty(null)

    if (skipToggleResetTimeoutRef.current !== null) {
      window.clearTimeout(skipToggleResetTimeoutRef.current)
      skipToggleResetTimeoutRef.current = null
    }

    skipTogglePropertyRef.current = null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            chipBase,
            tone === "adaptive"
              ? count > 0
                ? chipSelected
                : dashedWhenEmpty
                  ? chipDashed
                  : chipGhost
              : count === 0 && dashedWhenEmpty
                ? chipDashed
                : getChipToneClass(tone),
            !showCount && tone === "ghost" && chipMuted
          )}
        >
          <Eye className="size-3.5" />
          <span>{label}</span>
          {showCount ? (
            <span className="ml-0.5 rounded-full bg-background/40 px-1 text-[10px] tabular-nums">
              {count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[420px] overflow-hidden p-0")}
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
                  setActiveDragProperty(property)
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
                        isDragActive={activeDragProperty === property}
                        onToggle={() => handleToggleDisplayProperty(property)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="px-1 pb-1">
                <PropertyPopoverItem muted className="pointer-events-none">
                  No visible properties
                </PropertyPopoverItem>
              </div>
            )}
          </PropertyPopoverList>
          <PropertyPopoverList className="min-h-[240px] overflow-x-hidden px-0">
            <PropertyPopoverGroup>Hidden · {hiddenProperties.length}</PropertyPopoverGroup>
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
              <div className="px-1 pb-1">
                <PropertyPopoverItem muted className="pointer-events-none">
                  No hidden properties
                </PropertyPopoverItem>
              </div>
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
  isDragActive,
  onToggle,
}: {
  property: DisplayProperty
  label: string
  isDragActive: boolean
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
        "flex h-8 w-full cursor-grab items-center gap-2 rounded-[5px] px-2 text-[12.5px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground touch-none will-change-transform active:cursor-grabbing",
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

export function LevelChipPopover({
  view,
  onUpdateView,
  tone = "default",
  label = "Level",
  showLabel = true,
  showValue = true,
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
  const itemLevelOptions = useMemo(() => {
    if (view.entityKind !== "items") {
      return []
    }

    const baseOptions = team
      ? getDefaultWorkItemTypesForTeamExperience(team.settings.experience)
      : workItemTypes

    return view.itemLevel && !baseOptions.includes(view.itemLevel)
      ? [view.itemLevel, ...baseOptions]
      : baseOptions
  }, [team, view.entityKind, view.itemLevel])

  if (view.entityKind !== "items" || itemLevelOptions.length === 0) {
    return null
  }

  const effectiveItemLevel = view.itemLevel ?? itemLevelOptions[0] ?? null
  const childCopy = getChildWorkItemCopy(
    effectiveItemLevel,
    team?.settings.experience
  )
  const canShowChildItems = Boolean(childCopy?.childType)
  const currentLabel = effectiveItemLevel
    ? getDisplayLabelForWorkItemType(
        effectiveItemLevel,
        team?.settings.experience
      )
    : "Level"

  function handleUpdateView(patch: ViewConfigPatch) {
    if (onUpdateView) {
      onUpdateView(patch)
      return
    }

    useAppStore.getState().updateViewConfig(view.id, patch)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chipBase, getChipToneClass(tone))}>
          <Stack className="size-3.5" />
          {showLabel ? <span>{label}</span> : null}
          {showValue ? (
            <span className="font-semibold">
              {showLabel ? `· ${currentLabel}` : currentLabel}
            </span>
          ) : null}
          <CaretDown className="size-3 opacity-70" />
        </button>
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
                {getDisplayLabelForWorkItemType(
                  option,
                  team?.settings.experience
                )}
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
