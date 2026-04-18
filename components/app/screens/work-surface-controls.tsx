"use client"

import { useMemo, type ReactNode } from "react"
import {
  CalendarDots,
  FadersHorizontal,
  GearSix,
  Kanban,
  Rows,
} from "@phosphor-icons/react"

import {
  getStatusOrderForTeam,
  getTeam,
} from "@/lib/domain/selectors"
import {
  getChildWorkItemCopy,
  getDefaultShowChildItemsForItemLevel,
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  projectHealthMeta,
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

import { isPersistedViewFilterKey, type ViewFilterKey } from "./helpers"
import { ConfigSelect, FilterChip } from "./shared"
import { cn } from "@/lib/utils"

export const displayPropertyOptions: DisplayProperty[] = [
  "id",
  "type",
  "status",
  "assignee",
  "priority",
  "project",
  "dueDate",
  "milestone",
  "labels",
  "created",
  "updated",
]

const groupOptions: GroupField[] = [
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

export function FilterPopover({
  view,
  items,
  onToggleFilterValue,
  onClearFilters,
}: {
  view: ViewDefinition
  items: WorkItem[]
  onToggleFilterValue?: (key: ViewFilterKey, value: string) => void
  onClearFilters?: () => void
}) {
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
        <Button size="icon-xs" variant="ghost" className="relative">
          <FadersHorizontal className="size-3.5" />
          {activeCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Filters
          </span>
          {activeCount > 0 ? (
            <button
              className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={handleClearFilters}
            >
              Clear all
            </button>
          ) : null}
        </div>
        <div className="flex flex-col divide-y p-0">
          <div className="px-3 py-2.5">
            <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Status
            </div>
            <div className="flex flex-wrap gap-1">
              {statusOptions.map((status) => (
                <FilterChip
                  key={status}
                  label={statusMeta[status].label}
                  active={view.filters.status.includes(status)}
                  onClick={() => handleToggleFilterValue("status", status)}
                />
              ))}
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Priority
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(priorityMeta).map(([priority, meta]) => (
                <FilterChip
                  key={priority}
                  label={meta.label}
                  active={view.filters.priority.includes(priority as Priority)}
                  onClick={() => handleToggleFilterValue("priority", priority)}
                />
              ))}
            </div>
          </div>
          {itemTypes.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Type
              </div>
              <div className="flex flex-wrap gap-1">
                {itemTypes.map((itemType) => (
                  <FilterChip
                    key={itemType}
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
              </div>
            </div>
          ) : null}
          {assignees.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Assignee
              </div>
              <div className="flex flex-wrap gap-1">
                {assignees.map((assignee) => (
                  <FilterChip
                    key={assignee.id}
                    label={assignee.name}
                    active={view.filters.assigneeIds.includes(assignee.id)}
                    onClick={() =>
                      handleToggleFilterValue("assigneeIds", assignee.id)
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
          {filteredProjects.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Project
              </div>
              <div className="flex flex-wrap gap-1">
                {filteredProjects.map((project) => (
                  <FilterChip
                    key={project.id}
                    label={project.name}
                    active={view.filters.projectIds.includes(project.id)}
                    onClick={() =>
                      handleToggleFilterValue("projectIds", project.id)
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
          {filteredLabels.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Labels
              </div>
              <div className="flex flex-wrap gap-1">
                {filteredLabels.map((label) => (
                  <FilterChip
                    key={label.id}
                    label={label.name}
                    active={view.filters.labelIds.includes(label.id)}
                    onClick={() =>
                      handleToggleFilterValue("labelIds", label.id)
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ViewConfigPopover({
  view,
  onUpdateView,
  onToggleDisplayProperty,
}: {
  view: ViewDefinition
  onUpdateView?: (patch: ViewConfigPatch) => void
  onToggleDisplayProperty?: (property: DisplayProperty) => void
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
  const effectiveItemLevel =
    view.entityKind === "items"
      ? (view.itemLevel ?? itemLevelOptions[0] ?? null)
      : null
  const childCopy =
    view.entityKind === "items"
      ? getChildWorkItemCopy(
          effectiveItemLevel,
          team?.settings.experience
        )
      : null
  const canShowChildItems = Boolean(childCopy?.childType)

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
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b px-3 py-2.5">
          <div className="flex rounded-md bg-muted/50 p-0.5">
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
          {view.entityKind === "items" ? (
            <ConfigSelect
              label="Highest parent"
              value={effectiveItemLevel ?? ""}
              options={itemLevelOptions.map((option) => ({
                value: option,
                label: getDisplayLabelForWorkItemType(
                  option,
                  team?.settings.experience
                ),
              }))}
              onValueChange={(value) => {
                const nextItemLevel = value as WorkItemType
                const currentCanShowChildItems =
                  getDefaultShowChildItemsForItemLevel(effectiveItemLevel)
                const nextCanShowChildItems =
                  getDefaultShowChildItemsForItemLevel(nextItemLevel)

                handleUpdateView({
                  itemLevel: nextItemLevel,
                  ...(nextCanShowChildItems
                    ? currentCanShowChildItems
                      ? {}
                      : { showChildItems: true }
                    : { showChildItems: false }),
                })
              }}
            />
          ) : null}
          {canShowChildItems ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-medium">
                  Show {childCopy?.childPluralLabel.toLowerCase()}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Show the next child level beneath each highest parent row or card.
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
}: {
  view: ViewDefinition
  projects: Project[]
}) {
  const users = useAppStore((state) => state.users)
  const teams = useAppStore((state) => state.teams)
  const leadIds = useMemo(
    () => [...new Set(projects.map((project) => project.leadId).filter(Boolean))],
    [projects]
  )
  const teamIds = useMemo(
    () =>
      [
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
  const activeCount =
    view.filters.priority.length +
    view.filters.leadIds.length +
    view.filters.health.length +
    view.filters.teamIds.length

  function handleToggleFilterValue(
    key: "priority" | "leadIds" | "health" | "teamIds",
    value: string
  ) {
    useAppStore.getState().toggleViewFilterValue(view.id, key, value)
  }

  function handleClearFilters() {
    useAppStore.getState().clearViewFilters(view.id)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost" className="relative">
          <FadersHorizontal className="size-3.5" />
          {activeCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Filters
          </span>
          {activeCount > 0 ? (
            <button
              className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={handleClearFilters}
            >
              Clear all
            </button>
          ) : null}
        </div>
        <div className="flex flex-col divide-y p-0">
          <div className="px-3 py-2.5">
            <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Priority
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(priorityMeta).map(([priority, meta]) => (
                <FilterChip
                  key={priority}
                  label={meta.label}
                  active={view.filters.priority.includes(priority as Priority)}
                  onClick={() => handleToggleFilterValue("priority", priority)}
                />
              ))}
            </div>
          </div>
          {healthOptions.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Health
              </div>
              <div className="flex flex-wrap gap-1">
                {healthOptions.map((health) => (
                  <FilterChip
                    key={health}
                    label={
                      projectHealthMeta[
                        health as keyof typeof projectHealthMeta
                      ].label
                    }
                    active={view.filters.health.includes(health as never)}
                    onClick={() => handleToggleFilterValue("health", health)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {leads.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Lead
              </div>
              <div className="flex flex-wrap gap-1">
                {leads.map((lead) => (
                  <FilterChip
                    key={lead.id}
                    label={lead.name}
                    active={view.filters.leadIds.includes(lead.id)}
                    onClick={() => handleToggleFilterValue("leadIds", lead.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {projectTeams.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Team
              </div>
              <div className="flex flex-wrap gap-1">
                {projectTeams.map((team) => (
                  <FilterChip
                    key={team.id}
                    label={team.name}
                    active={view.filters.teamIds.includes(team.id)}
                    onClick={() => handleToggleFilterValue("teamIds", team.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
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
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b px-3 py-2.5">
          <div className="flex rounded-md bg-muted/50 p-0.5">
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
