"use client"

import { useMemo, useState } from "react"
import {
  CalendarDots,
  CaretDown,
  FadersHorizontal,
  GearSix,
  Kanban,
  Rows,
} from "@phosphor-icons/react"

import {
  getLabelsForTeamScope,
  getStatusOrderForTeam,
  getTemplateDefaultsForTeam,
} from "@/lib/domain/selectors"
import {
  createDefaultProjectPresentationConfig,
  getDefaultTemplateTypeForTeamExperience,
  getDisplayLabelForWorkItemType,
  priorityMeta,
  statusMeta,
  type AppData,
  type DisplayProperty,
  type GroupField,
  type OrderingField,
  type Priority,
  type Project,
  type ProjectPresentationConfig,
  type ViewDefinition,
  type WorkStatus,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  ConfigSelect,
  FilterChip,
} from "@/components/app/screens/shared"
import {
  cloneViewFilters,
  countActiveViewFilters,
  createEmptyViewFilters,
  getCreateDialogItemTypes,
  getProjectPresentationGroupOptions,
  getViewLayoutLabel,
  type ViewFilterKey,
} from "@/components/app/screens/helpers"
import {
  displayPropertyOptions,
  getGroupFieldOptionLabel,
  orderingOptions,
} from "@/components/app/screens/work-surface-controls"
import { cn } from "@/lib/utils"

function ProjectPresentationPopover({
  templateType,
  presentation,
  triggerClassName,
  onUpdatePresentation,
  onToggleDisplayProperty,
}: {
  templateType: Project["templateType"]
  presentation: ProjectPresentationConfig
  triggerClassName: string
  onUpdatePresentation: (
    patch: Partial<
      Pick<ProjectPresentationConfig, "layout" | "grouping" | "ordering">
    >
  ) => void
  onToggleDisplayProperty: (property: DisplayProperty) => void
}) {
  const groupingOptions = getProjectPresentationGroupOptions(templateType)
  const projectDisplayPropertyOptions = displayPropertyOptions.filter(
    (property) => property !== "project"
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            triggerClassName,
            "inline-flex items-center gap-2 overflow-hidden text-left"
          )}
        >
          <GearSix className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {getViewLayoutLabel(presentation.layout)} setup
          </span>
          <CaretDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Showcase
          </span>
        </div>
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
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] py-1.5 text-[11px] transition-all",
                  presentation.layout === layout.value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() =>
                  onUpdatePresentation({
                    layout: layout.value as ViewDefinition["layout"],
                    ordering:
                      layout.value === "timeline" &&
                      presentation.ordering === "priority"
                        ? "targetDate"
                        : layout.value !== "timeline" &&
                            presentation.ordering === "targetDate"
                          ? "priority"
                          : presentation.ordering,
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
            value={presentation.grouping}
            options={groupingOptions.map((option) => ({
              value: option,
              label: getGroupFieldOptionLabel(option as GroupField),
            }))}
            onValueChange={(value) =>
              onUpdatePresentation({ grouping: value as GroupField })
            }
          />
          <ConfigSelect
            label="Ordering"
            value={presentation.ordering}
            options={orderingOptions.map((option) => ({
              value: option,
              label: option,
            }))}
            onValueChange={(value) =>
              onUpdatePresentation({ ordering: value as OrderingField })
            }
          />
        </div>

        <Separator />

        <div className="px-3 py-2.5">
          <div className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Properties
          </div>
          <div className="flex flex-wrap gap-1">
            {projectDisplayPropertyOptions.map((property) => (
              <button
                key={property}
                type="button"
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  presentation.displayProps.includes(property)
                    ? "border-primary/30 bg-primary/10 font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
                onClick={() => onToggleDisplayProperty(property)}
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

function ProjectFiltersPopover({
  templateType,
  filters,
  teamMembers,
  teamStatuses,
  availableLabels,
  triggerClassName,
  onToggleFilterValue,
  onSetShowCompleted,
  onClearFilters,
}: {
  templateType: Project["templateType"]
  filters: ViewDefinition["filters"]
  teamMembers: AppData["users"]
  teamStatuses: WorkStatus[]
  availableLabels: AppData["labels"]
  triggerClassName: string
  onToggleFilterValue: (key: ViewFilterKey, value: string) => void
  onSetShowCompleted: (showCompleted: boolean) => void
  onClearFilters: () => void
}) {
  const activeCount = countActiveViewFilters(filters)
  const availableItemTypes = getCreateDialogItemTypes(templateType)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            triggerClassName,
            "inline-flex items-center gap-2 overflow-hidden text-left"
          )}
        >
          <FadersHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">Filters</span>
          {activeCount > 0 ? (
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-foreground">
              {activeCount}
            </span>
          ) : null}
          <CaretDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Filters
          </span>
          {activeCount > 0 ? (
            <button
              type="button"
              className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={onClearFilters}
            >
              Clear all
            </button>
          ) : null}
        </div>
        <div className="border-b px-3 py-2.5">
          <ConfigSelect
            label="Completed"
            value={String(filters.showCompleted)}
            options={[
              { value: "true", label: "Show all" },
              { value: "false", label: "Hide done" },
            ]}
            onValueChange={(value) => onSetShowCompleted(value === "true")}
          />
        </div>
        <div className="flex max-h-[24rem] flex-col divide-y overflow-y-auto">
          <div className="px-3 py-2.5">
            <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Status
            </div>
            <div className="flex flex-wrap gap-1">
              {teamStatuses.map((status) => (
                <FilterChip
                  key={status}
                  label={statusMeta[status].label}
                  active={filters.status.includes(status)}
                  onClick={() => onToggleFilterValue("status", status)}
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
                  active={filters.priority.includes(priority as Priority)}
                  onClick={() => onToggleFilterValue("priority", priority)}
                />
              ))}
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Type
            </div>
            <div className="flex flex-wrap gap-1">
              {availableItemTypes.map((itemType) => (
                <FilterChip
                  key={itemType}
                  label={getDisplayLabelForWorkItemType(itemType, null)}
                  active={filters.itemTypes.includes(itemType)}
                  onClick={() => onToggleFilterValue("itemTypes", itemType)}
                />
              ))}
            </div>
          </div>
          {teamMembers.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Assignee
              </div>
              <div className="flex flex-wrap gap-1">
                {teamMembers.map((member) => (
                  <FilterChip
                    key={member.id}
                    label={member.name}
                    active={filters.assigneeIds.includes(member.id)}
                    onClick={() =>
                      onToggleFilterValue("assigneeIds", member.id)
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
          {teamMembers.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Lead
              </div>
              <div className="flex flex-wrap gap-1">
                {teamMembers.map((member) => (
                  <FilterChip
                    key={member.id}
                    label={member.name}
                    active={filters.leadIds.includes(member.id)}
                    onClick={() => onToggleFilterValue("leadIds", member.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {availableLabels.length > 0 ? (
            <div className="px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Labels
              </div>
              <div className="flex flex-wrap gap-1">
                {availableLabels.map((label) => (
                  <FilterChip
                    key={label.id}
                    label={label.name}
                    active={filters.labelIds.includes(label.id)}
                    onClick={() => onToggleFilterValue("labelIds", label.id)}
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

export function CreateProjectDialog({
  open,
  onOpenChange,
  teamId,
  disabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  disabled: boolean
}) {
  const teams = useAppStore((state) => state.teams)
  const teamMemberships = useAppStore((state) => state.teamMemberships)
  const users = useAppStore((state) => state.users)
  const labels = useAppStore((state) => getLabelsForTeamScope(state, teamId))
  const settingsTeam = useMemo(
    () => teams.find((entry) => entry.id === teamId) ?? null,
    [teamId, teams]
  )
  const teamMembers = useMemo(() => {
    const memberIds = new Set(
      teamMemberships
        .filter((membership) => membership.teamId === teamId)
        .map((membership) => membership.userId)
    )

    return users.filter((user) => memberIds.has(user.id))
  }, [teamId, teamMemberships, users])
  const availableLabels = useMemo(
    () => [...labels].sort((left, right) => left.name.localeCompare(right.name)),
    [labels]
  )
  const templateType = getDefaultTemplateTypeForTeamExperience(
    settingsTeam?.settings.experience
  )
  const templateDefaults = getTemplateDefaultsForTeam(
    settingsTeam,
    templateType
  )
  const teamStatuses = getStatusOrderForTeam(settingsTeam)
  const [name, setName] = useState("")
  const [summary, setSummary] = useState("")
  const [presentation, setPresentation] = useState<ProjectPresentationConfig>(
    () =>
      createDefaultProjectPresentationConfig(templateType, {
        layout: templateDefaults.defaultViewLayout,
      })
  )
  const normalizedName = name.trim()
  const normalizedSummary = summary.trim()
  const resolvedSummary =
    normalizedSummary.length >= 2
      ? normalizedSummary
      : templateDefaults.summaryHint
  const canCreate = !disabled && normalizedName.length >= 2
  const triggerClassName =
    "h-9 w-auto max-w-full rounded-full border-border/60 bg-background px-3 text-xs font-medium shadow-none"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>

        <div className="border-b border-border/60 bg-muted/[0.35] px-6 pt-6 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            <Badge
              variant="outline"
              className="h-7 rounded-full border-border/60 bg-background px-3 text-[11px] font-medium tracking-normal normal-case"
            >
              {settingsTeam?.name ?? "Team"}
            </Badge>
            <span className="text-muted-foreground/50">/</span>
            <span className="tracking-normal normal-case">New project</span>
          </div>

          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project name"
            className="mt-5 h-auto border-none bg-transparent px-0 py-0 text-3xl font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/45 focus-visible:ring-0 md:text-[2rem]"
            autoFocus
          />
          <Textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={templateDefaults.summaryHint}
            rows={4}
            className="mt-3 min-h-[112px] resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Configure the default project view before the team starts using it.
          </p>
        </div>

        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectPresentationPopover
              templateType={templateType}
              presentation={presentation}
              triggerClassName={triggerClassName}
              onUpdatePresentation={(patch) =>
                setPresentation((current) => ({
                  ...current,
                  ...patch,
                }))
              }
              onToggleDisplayProperty={(property) =>
                setPresentation((current) => ({
                  ...current,
                  displayProps: current.displayProps.includes(property)
                    ? current.displayProps.filter((value) => value !== property)
                    : [...current.displayProps, property],
                }))
              }
            />

            <ProjectFiltersPopover
              templateType={templateType}
              filters={presentation.filters}
              teamMembers={teamMembers}
              teamStatuses={teamStatuses}
              availableLabels={availableLabels}
              triggerClassName={triggerClassName}
              onToggleFilterValue={(key, value) =>
                setPresentation((current) => {
                  const nextFilters = {
                    ...current.filters,
                  } as ViewDefinition["filters"]
                  const currentValues = nextFilters[key] as string[]
                  const nextValues = currentValues.includes(value)
                    ? currentValues.filter((entry) => entry !== value)
                    : [...currentValues, value]

                  nextFilters[key] = nextValues as never

                  return { ...current, filters: nextFilters }
                })
              }
              onSetShowCompleted={(showCompleted) =>
                setPresentation((current) => ({
                  ...current,
                  filters: {
                    ...current.filters,
                    showCompleted,
                  },
                }))
              }
              onClearFilters={() =>
                setPresentation((current) => ({
                  ...current,
                  filters: createEmptyViewFilters(),
                }))
              }
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={() => {
                useAppStore.getState().createProject({
                  scopeType: "team",
                  scopeId: teamId,
                  templateType,
                  name: normalizedName,
                  summary: resolvedSummary,
                  priority: templateDefaults.defaultPriority,
                  settingsTeamId: teamId,
                  presentation: {
                    ...presentation,
                    displayProps: [...presentation.displayProps],
                    filters: cloneViewFilters(presentation.filters),
                  },
                })
                onOpenChange(false)
              }}
            >
              Create project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
