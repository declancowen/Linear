"use client"

import { useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CalendarDots,
  CaretDown,
  FadersHorizontal,
  GearSix,
  Kanban,
  Rows,
  X,
} from "@phosphor-icons/react"

import {
  getEditableTeamsForFeature,
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ConfigSelect, FilterChip } from "@/components/app/screens/shared"
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

const TEAM_DOT_COLORS = [
  "var(--label-1)",
  "var(--label-2)",
  "var(--label-3)",
  "var(--label-4)",
  "var(--label-5)",
]

function getTeamDotColor(teamId: string | null | undefined) {
  if (!teamId) {
    return TEAM_DOT_COLORS[3]
  }

  let hash = 0
  for (let index = 0; index < teamId.length; index += 1) {
    hash = (hash * 31 + teamId.charCodeAt(index)) >>> 0
  }

  return TEAM_DOT_COLORS[hash % TEAM_DOT_COLORS.length]
}

const chipTriggerClass =
  "inline-flex h-7 w-fit max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

const crumbTriggerClass =
  "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

function KbdHint({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <kbd
      className={cn(
        "ml-1 inline-flex h-[18px] items-center rounded-[4px] border border-line bg-surface-2 px-1 font-sans text-[10.5px] font-medium text-fg-3",
        className
      )}
    >
      {children}
    </kbd>
  )
}

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
  defaultTeamId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTeamId?: string | null
}) {
  const availableTeams = useAppStore(
    useShallow((state) => getEditableTeamsForFeature(state, "projects"))
  )
  const allLabels = useAppStore((state) => state.labels)
  const teamMemberships = useAppStore((state) => state.teamMemberships)
  const users = useAppStore((state) => state.users)
  const initialTeamId =
    defaultTeamId && availableTeams.some((team) => team.id === defaultTeamId)
      ? defaultTeamId
      : (availableTeams[0]?.id ?? "")
  const initialTeam =
    availableTeams.find((entry) => entry.id === initialTeamId) ?? null
  const initialTemplateType = getDefaultTemplateTypeForTeamExperience(
    initialTeam?.settings.experience
  )
  const initialTemplateDefaults = getTemplateDefaultsForTeam(
    initialTeam,
    initialTemplateType
  )
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId)
  const settingsTeam = useMemo(
    () => availableTeams.find((entry) => entry.id === selectedTeamId) ?? null,
    [availableTeams, selectedTeamId]
  )
  const labels = useMemo(
    () =>
      settingsTeam
        ? allLabels.filter(
            (label) => label.workspaceId === settingsTeam.workspaceId
          )
        : [],
    [allLabels, settingsTeam]
  )
  const teamMembers = useMemo(() => {
    const memberIds = new Set(
      teamMemberships
        .filter((membership) => membership.teamId === selectedTeamId)
        .map((membership) => membership.userId)
    )

    return users.filter((user) => memberIds.has(user.id))
  }, [selectedTeamId, teamMemberships, users])
  const availableLabels = useMemo(
    () =>
      [...labels].sort((left, right) => left.name.localeCompare(right.name)),
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
      createDefaultProjectPresentationConfig(initialTemplateType, {
        layout: initialTemplateDefaults.defaultViewLayout,
      })
  )
  const normalizedName = name.trim()
  const normalizedSummary = summary.trim()
  const resolvedSummary =
    normalizedSummary.length >= 2
      ? normalizedSummary
      : templateDefaults.summaryHint
  const canCreate = availableTeams.length > 0 && normalizedName.length >= 2
  const triggerClassName = chipTriggerClass
  const teamDotColor = getTeamDotColor(settingsTeam?.id ?? null)

  function syncTeamSelection(nextTeamId: string) {
    const nextTeam =
      availableTeams.find((entry) => entry.id === nextTeamId) ?? null
    const nextTemplateType = getDefaultTemplateTypeForTeamExperience(
      nextTeam?.settings.experience
    )
    const nextTemplateDefaults = getTemplateDefaultsForTeam(
      nextTeam,
      nextTemplateType
    )

    setSelectedTeamId(nextTeamId)
    setPresentation(
      createDefaultProjectPresentationConfig(nextTemplateType, {
        layout: nextTemplateDefaults.defaultViewLayout,
      })
    )
  }

  useEffect(() => {
    if (!open) {
      return
    }

    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canCreate) {
        event.preventDefault()

        if (!selectedTeamId) {
          return
        }

        useAppStore.getState().createProject({
          scopeType: "team",
          scopeId: selectedTeamId,
          templateType,
          name: normalizedName,
          summary: resolvedSummary,
          priority: templateDefaults.defaultPriority,
          settingsTeamId: selectedTeamId,
          presentation: {
            ...presentation,
            displayProps: [...presentation.displayProps],
            filters: cloneViewFilters(presentation.filters),
          },
        })
        onOpenChange(false)
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [
    open,
    canCreate,
    selectedTeamId,
    templateType,
    normalizedName,
    resolvedSummary,
    templateDefaults.defaultPriority,
    presentation,
    onOpenChange,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg sm:max-w-[640px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Create a project and configure its default presentation before
            teammates start using it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b border-line-soft px-3.5 py-2 text-[12.5px] text-fg-3">
          <Select
            value={selectedTeamId || "__no_team__"}
            onValueChange={(value) => {
              if (value === "__no_team__") {
                return
              }

              syncTeamSelection(value)
            }}
            disabled={availableTeams.length === 0}
          >
            <SelectTrigger
              size="sm"
              className={cn(crumbTriggerClass, "min-w-0")}
            >
              <SelectValue placeholder="Team space">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ background: teamDotColor }}
                  />
                  <span className="truncate font-medium text-foreground">
                    {settingsTeam?.name ?? "Team space"}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {availableTeams.length > 0 ? (
                  availableTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__no_team__">No team spaces</SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className={crumbTriggerClass}>
            <span className="font-medium text-foreground">Project</span>
          </span>
          <span className="ml-0.5 text-fg-4">→ Team roadmap</span>
          <div className="ml-auto flex items-center gap-0.5">
            <DialogClose asChild>
              <button
                type="button"
                className="inline-grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-[14px]" />
              </button>
            </DialogClose>
          </div>
        </div>

        <div className="px-[18px] pt-3 pb-0.5">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project name"
            className="h-auto border-none bg-transparent px-0 py-1 text-[20px] font-semibold tracking-[-0.01em] shadow-none placeholder:font-medium placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
            autoFocus
          />
          <Textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={templateDefaults.summaryHint}
            rows={4}
            className="mt-0.5 min-h-[96px] resize-none border-none bg-transparent px-0 py-1 text-[13.5px] leading-[1.6] text-fg-2 shadow-none placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="pt-1 pb-2 text-[11.5px] text-fg-4">
            Configure the default project view before the team starts using it.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-background px-[18px] py-2.5">
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

        {availableTeams.length === 0 ? (
          <p className="px-[18px] pt-2 text-xs text-destructive">
            No editable team spaces support project creation right now.
          </p>
        ) : null}

        <div className="flex items-center gap-2.5 border-t border-line-soft bg-background px-3.5 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
            <GearSix className="size-[13px] shrink-0" />
            <span className="truncate">
              {settingsTeam ? (
                <>
                  Adding to{" "}
                  <b className="font-medium text-foreground">
                    {settingsTeam.name}
                  </b>
                </>
              ) : (
                "Select a team space"
              )}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel <KbdHint>Esc</KbdHint>
            </Button>
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={() => {
                if (!selectedTeamId) {
                  return
                }

                useAppStore.getState().createProject({
                  scopeType: "team",
                  scopeId: selectedTeamId,
                  templateType,
                  name: normalizedName,
                  summary: resolvedSummary,
                  priority: templateDefaults.defaultPriority,
                  settingsTeamId: selectedTeamId,
                  presentation: {
                    ...presentation,
                    displayProps: [...presentation.displayProps],
                    filters: cloneViewFilters(presentation.filters),
                  },
                })
                onOpenChange(false)
              }}
            >
              Create project{" "}
              <KbdHint className="bg-[oklch(0.32_0_0)] text-background border-[oklch(0.38_0_0)]">
                ⌘⏎
              </KbdHint>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
