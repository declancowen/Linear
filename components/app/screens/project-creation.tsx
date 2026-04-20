"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { format } from "date-fns"
import { useShallow } from "zustand/react/shallow"
import {
  CalendarDots,
  CaretDown,
  Check,
  FolderSimple,
  MagnifyingGlass,
  Tag,
  User,
  UsersThree,
  X,
} from "@phosphor-icons/react"

import {
  getEditableTeamsForFeature,
  getTemplateDefaultsForTeam,
  getVisibleWorkItems,
} from "@/lib/domain/selectors"
import {
  createDefaultProjectPresentationConfig,
  getDefaultTemplateTypeForTeamExperience,
  priorityMeta,
  projectStatusMeta,
  type AppData,
  type DisplayProperty,
  type Priority,
  type ProjectPresentationConfig,
  type ProjectStatus,
  type ViewDefinition,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Button } from "@/components/ui/button"
import {
  ShortcutKeys,
  useCommandEnterSubmit,
  useShortcutModifierLabel,
} from "@/components/app/shortcut-keys"
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
import { Textarea } from "@/components/ui/textarea"
import {
  PriorityIcon,
} from "@/components/app/screens/shared"
import { TeamSpaceCrumbPicker } from "@/components/app/screens/team-space-crumb-picker"
import { WorkItemAssigneeAvatar } from "@/components/app/screens/work-item-ui"
import {
  cloneViewFilters,
  createEmptyViewFilters,
  getProjectPresentationGroupOptions,
  selectAppDataSnapshot,
  type ViewFilterKey,
} from "@/components/app/screens/helpers"
import {
  FilterPopover,
  GroupChipPopover,
  LayoutChipPopover,
  LevelChipPopover,
  PropertiesChipPopover,
  SortChipPopover,
  type ViewConfigPatch,
} from "@/components/app/screens/work-surface-controls"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverFoot,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
import { cn } from "@/lib/utils"

const PROJECT_PRESENTATION_PROPERTY_OPTIONS: DisplayProperty[] = [
  "id",
  "status",
  "assignee",
  "priority",
  "dueDate",
  "milestone",
  "labels",
  "created",
  "updated",
]

const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "backlog",
  "planning",
  "planned",
  "in-progress",
  "completed",
  "cancelled",
]

const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  backlog: "var(--status-backlog)",
  planning: "var(--status-todo)",
  planned: "var(--status-todo)",
  "in-progress": "var(--status-doing)",
  completed: "var(--status-done)",
  cancelled: "var(--status-cancel)",
}

function matchesQuery(value: string, query: string) {
  if (!query.trim()) {
    return true
  }

  return value.toLowerCase().includes(query.trim().toLowerCase())
}

function toggleSelection(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value]
}

function formatDateChipLabel(value: string | null | undefined, emptyLabel: string) {
  if (!value) {
    return emptyLabel
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return emptyLabel
  }

  return format(date, "MMM d")
}

function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={{ background: PROJECT_STATUS_COLOR[status] }}
      />
      <span>{projectStatusMeta[status].label}</span>
    </span>
  )
}

const chipTriggerClass =
  "inline-flex h-7 w-fit max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

const chipTriggerDashedClass =
  "border-dashed bg-transparent text-fg-3 hover:bg-surface-3 hover:text-foreground"

const crumbTriggerClass =
  "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

function UserOption({
  user,
  secondaryLabel,
}: {
  user: AppData["users"][number]
  secondaryLabel?: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <WorkItemAssigneeAvatar
        user={user}
        className="size-4 data-[size=sm]:size-4"
      />
      <span className="min-w-0 flex-1 truncate">
        <span>{user.name}</span>
        {secondaryLabel ? (
          <span className="ml-1 text-fg-3">{secondaryLabel}</span>
        ) : null}
      </span>
    </span>
  )
}

function getDialogTeamMembers(
  teamId: string,
  teamMemberships: AppData["teamMemberships"],
  users: AppData["users"]
) {
  const memberIds = new Set(
    teamMemberships
      .filter((membership) => membership.teamId === teamId)
      .map((membership) => membership.userId)
  )

  return users
    .filter((user) => memberIds.has(user.id))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function createInitialProjectPresentationConfig(
  templateType: Parameters<typeof createDefaultProjectPresentationConfig>[0]
): ProjectPresentationConfig {
  return {
    ...createDefaultProjectPresentationConfig(templateType, {
      layout: "list",
    }),
    layout: "list",
    ordering: "createdAt",
    displayProps: [],
    filters: createEmptyViewFilters(),
    showChildItems: false,
  }
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
  const appData = useAppStore(useShallow(selectAppDataSnapshot))
  const availableTeams = useAppStore(
    useShallow((state) => getEditableTeamsForFeature(state, "projects"))
  )
  const allLabels = useAppStore((state) => state.labels)
  const teamMemberships = useAppStore((state) => state.teamMemberships)
  const users = useAppStore((state) => state.users)
  const currentUserId = useAppStore((state) => state.currentUserId)
  const shortcutModifierLabel = useShortcutModifierLabel()

  const initialTeamId =
    defaultTeamId && availableTeams.some((team) => team.id === defaultTeamId)
      ? defaultTeamId
      : (availableTeams[0]?.id ?? "")
  const initialTeam =
    availableTeams.find((entry) => entry.id === initialTeamId) ?? null
  const initialTeamMembers = getDialogTeamMembers(
    initialTeamId,
    teamMemberships,
    users
  )
  const initialTemplateType = getDefaultTemplateTypeForTeamExperience(
    initialTeam?.settings.experience
  )
  const initialLeadId =
    initialTeamMembers.find((member) => member.id === currentUserId)?.id ??
    initialTeamMembers[0]?.id ??
    null
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
  const teamMembers = useMemo(
    () => getDialogTeamMembers(selectedTeamId, teamMemberships, users),
    [selectedTeamId, teamMemberships, users]
  )
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
  const [name, setName] = useState("")
  const [summary, setSummary] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("backlog")
  const [priority, setPriority] = useState<Priority>("none")
  const [leadId, setLeadId] = useState<string | null>(initialLeadId)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<string | null>(null)
  const [targetDate, setTargetDate] = useState<string | null>(null)
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [presentation, setPresentation] = useState<ProjectPresentationConfig>(
    () => createInitialProjectPresentationConfig(initialTemplateType)
  )
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false)
  const [leadPickerOpen, setLeadPickerOpen] = useState(false)
  const [membersPickerOpen, setMembersPickerOpen] = useState(false)
  const [labelsPickerOpen, setLabelsPickerOpen] = useState(false)
  const [leadQuery, setLeadQuery] = useState("")
  const [memberQuery, setMemberQuery] = useState("")
  const [labelQuery, setLabelQuery] = useState("")
  const normalizedName = name.trim()
  const normalizedSummary = summary.trim()
  const resolvedSummary =
    normalizedSummary.length >= 2
      ? normalizedSummary
      : templateDefaults.summaryHint
  const resolvedMemberIds = useMemo(
    () => [...new Set(memberIds)].filter(Boolean),
    [memberIds]
  )
  const defaultLeadIdForSelectedTeam =
    teamMembers.find((member) => member.id === currentUserId)?.id ??
    teamMembers[0]?.id ??
    null
  const selectedLead = useMemo(
    () => teamMembers.find((member) => member.id === leadId) ?? null,
    [teamMembers, leadId]
  )
  const selectedMembers = useMemo(
    () => teamMembers.filter((member) => resolvedMemberIds.includes(member.id)),
    [teamMembers, resolvedMemberIds]
  )
  const selectedLabels = useMemo(
    () => availableLabels.filter((label) => selectedLabelIds.includes(label.id)),
    [availableLabels, selectedLabelIds]
  )
  const canCreate =
    availableTeams.length > 0 &&
    normalizedName.length >= 2 &&
    Boolean(selectedTeamId) &&
    Boolean(leadId)
  const triggerClassName = chipTriggerClass
  const presentationGroupOptions = useMemo(
    () => getProjectPresentationGroupOptions(templateType),
    [templateType]
  )
  const scopedTeamItems = useMemo(
    () =>
      selectedTeamId
        ? getVisibleWorkItems(appData, { teamId: selectedTeamId })
        : [],
    [appData, selectedTeamId]
  )
  const presentationView = useMemo<ViewDefinition | null>(() => {
    if (!selectedTeamId) {
      return null
    }

    return {
      id: "__draft_project_presentation__",
      name: "Project view",
      description: "",
      scopeType: "team",
      scopeId: selectedTeamId,
      entityKind: "items",
      itemLevel: presentation.itemLevel ?? null,
      showChildItems: presentation.showChildItems ?? false,
      layout: presentation.layout,
      filters: presentation.filters,
      grouping: presentation.grouping,
      subGrouping: null,
      ordering: presentation.ordering,
      displayProps: presentation.displayProps,
      hiddenState: {
        groups: [],
        subgroups: [],
      },
      isShared: true,
      route: settingsTeam ? `/team/${settingsTeam.slug}/projects` : "",
      createdAt: "__draft__",
      updatedAt: "__draft__",
    }
  }, [presentation, selectedTeamId, settingsTeam])

  function updatePresentationView(patch: ViewConfigPatch) {
    setPresentation((current) => ({
      ...current,
      ...(patch.layout !== undefined ? { layout: patch.layout } : {}),
      ...(patch.grouping !== undefined ? { grouping: patch.grouping } : {}),
      ...(patch.ordering !== undefined ? { ordering: patch.ordering } : {}),
      ...(patch.itemLevel !== undefined ? { itemLevel: patch.itemLevel } : {}),
      ...(patch.showChildItems !== undefined
        ? { showChildItems: patch.showChildItems }
        : {}),
      ...(patch.showCompleted !== undefined
        ? {
            filters: {
              ...current.filters,
              showCompleted: patch.showCompleted,
            },
          }
        : {}),
    }))
  }

  function togglePresentationFilterValue(key: ViewFilterKey, value: string) {
    setPresentation((current) => {
      const currentValues = current.filters[key] as string[]
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value]

      return {
        ...current,
        filters: {
          ...current.filters,
          [key]: nextValues as never,
        },
      }
    })
  }

  function clearPresentationFilters() {
    setPresentation((current) => ({
      ...current,
      filters: createEmptyViewFilters(),
    }))
  }

  function clearPresentationDisplayProperties() {
    setPresentation((current) => ({
      ...current,
      displayProps: [],
    }))
  }

  function togglePresentationDisplayProperty(property: DisplayProperty) {
    if (property === "project") {
      return
    }

    setPresentation((current) => ({
      ...current,
      displayProps: current.displayProps.includes(property)
        ? current.displayProps.filter((value) => value !== property)
        : [...current.displayProps, property],
    }))
  }

  function syncTeamSelection(nextTeamId: string) {
    const nextTeam =
      availableTeams.find((entry) => entry.id === nextTeamId) ?? null
    const nextTemplateType = getDefaultTemplateTypeForTeamExperience(
      nextTeam?.settings.experience
    )
    const nextTeamMembers = getDialogTeamMembers(
      nextTeamId,
      teamMemberships,
      users
    )
    const nextLeadId =
      nextTeamMembers.find((member) => member.id === currentUserId)?.id ??
      nextTeamMembers[0]?.id ??
      null

    setSelectedTeamId(nextTeamId)
    setStatus("backlog")
    setPriority("none")
    setLeadId(nextLeadId)
    setMemberIds([])
    setStartDate(null)
    setTargetDate(null)
    setSelectedLabelIds([])
    setPresentation(createInitialProjectPresentationConfig(nextTemplateType))
  }

  const handleCreate = useCallback(() => {
    if (!selectedTeamId || !leadId) {
      return
    }

    useAppStore.getState().createProject({
      scopeType: "team",
      scopeId: selectedTeamId,
      templateType,
      name: normalizedName,
      summary: resolvedSummary,
      status,
      priority,
      leadId,
      memberIds: resolvedMemberIds,
      startDate,
      targetDate,
      labelIds: selectedLabelIds,
      settingsTeamId: selectedTeamId,
      presentation: {
        ...presentation,
        displayProps: [...presentation.displayProps],
        filters: cloneViewFilters(presentation.filters),
      },
    })
    onOpenChange(false)
  }, [
    leadId,
    normalizedName,
    onOpenChange,
    presentation,
    priority,
    resolvedMemberIds,
    resolvedSummary,
    selectedLabelIds,
    selectedTeamId,
    startDate,
    status,
    targetDate,
    templateType,
  ])

  useEffect(() => {
    if (!open) {
      return
    }

    setSelectedTeamId(initialTeamId)
    setName("")
    setSummary("")
    setStatus("backlog")
    setPriority("none")
    setLeadId(initialLeadId)
    setMemberIds([])
    setStartDate(null)
    setTargetDate(null)
    setSelectedLabelIds([])
    setPresentation(createInitialProjectPresentationConfig(initialTemplateType))
  }, [
    initialLeadId,
    initialTeamId,
    initialTemplateType,
    open,
  ])

  useCommandEnterSubmit(open && canCreate, handleCreate)

  const labelsTriggerText =
    selectedLabels.length === 0
      ? "Labels"
      : selectedLabels.length === 1
        ? selectedLabels[0]?.name ?? "Labels"
        : `${selectedLabels.length} labels`
  const membersTriggerText =
    selectedMembers.length === 0
      ? "Members"
      : selectedMembers.length === 1
        ? selectedMembers[0]?.name ?? "Members"
        : `${selectedMembers.length} members`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-6 max-h-[calc(100vh-3rem)] translate-y-0 gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg sm:top-10 sm:max-w-[640px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Create a project and configure its default presentation before
            teammates start using it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b border-line-soft px-3.5 py-2 text-[12.5px] text-fg-3">
          <TeamSpaceCrumbPicker
            options={availableTeams.map((team) => ({
              id: team.id,
              label: team.name,
              teamId: team.id,
            }))}
            selectedId={selectedTeamId}
            onSelect={syncTeamSelection}
            triggerClassName={crumbTriggerClass}
          />
          <span className={crumbTriggerClass}>
            <span className="font-medium text-foreground">Project</span>
          </span>
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
          <Popover open={statusPickerOpen} onOpenChange={setStatusPickerOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={triggerClassName}>
                <ProjectStatusBadge status={status} />
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
            >
              <PropertyPopoverList>
                {PROJECT_STATUS_ORDER.map((value) => {
                  const selected = value === status
                  return (
                    <PropertyPopoverItem
                      key={value}
                      selected={selected}
                      onClick={() => {
                        setStatus(value)
                        setStatusPickerOpen(false)
                      }}
                      trailing={
                        selected ? (
                          <Check className="size-[14px] text-foreground" />
                        ) : null
                      }
                    >
                      <ProjectStatusBadge status={value} />
                    </PropertyPopoverItem>
                  )
                })}
              </PropertyPopoverList>
            </PopoverContent>
          </Popover>

          <Popover
            open={priorityPickerOpen}
            onOpenChange={setPriorityPickerOpen}
          >
            <PopoverTrigger asChild>
              <button type="button" className={triggerClassName}>
                <PriorityIcon priority={priority} />
                <span className="font-medium text-foreground">
                  {priorityMeta[priority].label}
                </span>
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
            >
              <PropertyPopoverList>
                {Object.keys(priorityMeta).map((value) => {
                  const typedValue = value as Priority
                  const selected = typedValue === priority

                  return (
                    <PropertyPopoverItem
                      key={value}
                      selected={selected}
                      onClick={() => {
                        setPriority(typedValue)
                        setPriorityPickerOpen(false)
                      }}
                      trailing={
                        selected ? (
                          <Check className="size-[14px] text-foreground" />
                        ) : null
                      }
                    >
                      <PriorityIcon priority={typedValue} />
                      <span>{priorityMeta[typedValue].label}</span>
                    </PropertyPopoverItem>
                  )
                })}
              </PropertyPopoverList>
            </PopoverContent>
          </Popover>

          <Popover
            open={leadPickerOpen}
            onOpenChange={(next) => {
              setLeadPickerOpen(next)
              if (!next) setLeadQuery("")
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  triggerClassName,
                  !selectedLead && "border-dashed text-fg-3"
                )}
                disabled={teamMembers.length === 0}
              >
                {selectedLead ? (
                  <UserOption user={selectedLead} />
                ) : (
                  <>
                    <User className="size-[13px]" />
                    <span>Lead</span>
                  </>
                )}
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className={cn(PROPERTY_POPOVER_CLASS, "w-[300px]")}
            >
              <PropertyPopoverSearch
                icon={<MagnifyingGlass className="size-[14px]" />}
                placeholder="Choose lead…"
                value={leadQuery}
                onChange={setLeadQuery}
                trailing={
                  leadId !== defaultLeadIdForSelectedTeam &&
                  defaultLeadIdForSelectedTeam ? (
                    <button
                      type="button"
                      className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
                      onClick={() => setLeadId(defaultLeadIdForSelectedTeam)}
                    >
                      Clear
                    </button>
                  ) : undefined
                }
              />
              <PropertyPopoverList>
                {teamMembers
                  .filter((member) => matchesQuery(member.name, leadQuery))
                  .map((member) => {
                    const selected = member.id === leadId
                    return (
                      <PropertyPopoverItem
                        key={member.id}
                        selected={selected}
                        onClick={() => {
                          setLeadId(member.id)
                          setLeadPickerOpen(false)
                        }}
                        trailing={
                          selected ? (
                            <Check className="size-[14px] text-foreground" />
                          ) : null
                        }
                      >
                        <UserOption user={member} />
                      </PropertyPopoverItem>
                    )
                  })}
              </PropertyPopoverList>
            </PopoverContent>
          </Popover>

          <Popover
            open={membersPickerOpen}
            onOpenChange={(next) => {
              setMembersPickerOpen(next)
              if (!next) setMemberQuery("")
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  triggerClassName,
                  selectedMembers.length === 0 && "border-dashed text-fg-3"
                )}
                disabled={teamMembers.length === 0}
              >
                <UsersThree className="size-[13px]" />
                <span
                  className={cn(
                    "truncate",
                    selectedMembers.length > 0 && "font-medium text-foreground"
                  )}
                >
                  {membersTriggerText}
                </span>
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className={cn(PROPERTY_POPOVER_CLASS, "w-[300px]")}
            >
              <PropertyPopoverSearch
                icon={<MagnifyingGlass className="size-[14px]" />}
                placeholder="Add members…"
                value={memberQuery}
                onChange={setMemberQuery}
                trailing={
                  selectedMembers.length > 0 ? (
                    <button
                      type="button"
                      className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
                      onClick={() => setMemberIds([])}
                    >
                      Clear
                    </button>
                  ) : undefined
                }
              />
              <PropertyPopoverList>
                {teamMembers
                  .filter((member) => matchesQuery(member.name, memberQuery))
                  .map((member) => {
                    const selected = memberIds.includes(member.id)
                    const isLead = member.id === leadId
                    return (
                      <PropertyPopoverItem
                        key={member.id}
                        selected={selected}
                        onClick={() => {
                          setMemberIds((current) =>
                            toggleSelection(current, member.id)
                          )
                        }}
                        trailing={
                          selected ? (
                            <Check className="size-[14px] text-foreground" />
                          ) : null
                        }
                      >
                        <UserOption
                          user={member}
                          secondaryLabel={isLead ? "Lead" : undefined}
                        />
                      </PropertyPopoverItem>
                    )
                  })}
              </PropertyPopoverList>
              <PropertyPopoverFoot>
                <span>{selectedMembers.length} selected</span>
              </PropertyPopoverFoot>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  triggerClassName,
                  !startDate && chipTriggerDashedClass
                )}
              >
                <CalendarDots className="size-[13px]" />
                <span
                  className={cn(startDate && "font-medium text-foreground")}
                >
                  {formatDateChipLabel(startDate, "Start date")}
                </span>
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className={cn(PROPERTY_POPOVER_CLASS, "w-[240px]")}
            >
              <div className="px-3 py-3">
                <div className="mb-2 text-[11px] font-medium text-fg-3">
                  Start date
                </div>
                <input
                  type="date"
                  value={startDate ?? ""}
                  onChange={(event) =>
                    setStartDate(event.target.value || null)
                  }
                  className="h-8 w-full rounded-md border border-line bg-background px-2 text-[12.5px] outline-none"
                />
              </div>
              <PropertyPopoverFoot>
                <button
                  type="button"
                  className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
                  onClick={() => setStartDate(null)}
                >
                  Clear
                </button>
              </PropertyPopoverFoot>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  triggerClassName,
                  !targetDate && chipTriggerDashedClass
                )}
              >
                <CalendarDots className="size-[13px]" />
                <span
                  className={cn(targetDate && "font-medium text-foreground")}
                >
                  {formatDateChipLabel(targetDate, "Target date")}
                </span>
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className={cn(PROPERTY_POPOVER_CLASS, "w-[240px]")}
            >
              <div className="px-3 py-3">
                <div className="mb-2 text-[11px] font-medium text-fg-3">
                  Target date
                </div>
                <input
                  type="date"
                  value={targetDate ?? ""}
                  onChange={(event) =>
                    setTargetDate(event.target.value || null)
                  }
                  className="h-8 w-full rounded-md border border-line bg-background px-2 text-[12.5px] outline-none"
                />
              </div>
              <PropertyPopoverFoot>
                <button
                  type="button"
                  className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
                  onClick={() => setTargetDate(null)}
                >
                  Clear
                </button>
              </PropertyPopoverFoot>
            </PopoverContent>
          </Popover>

          <Popover
            open={labelsPickerOpen}
            onOpenChange={(next) => {
              setLabelsPickerOpen(next)
              if (!next) setLabelQuery("")
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  triggerClassName,
                  selectedLabels.length === 0 && "border-dashed text-fg-3"
                )}
              >
                <Tag className="size-[13px]" />
                <span
                  className={cn(
                    "truncate",
                    selectedLabels.length > 0 && "font-medium text-foreground"
                  )}
                >
                  {labelsTriggerText}
                </span>
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className={cn(PROPERTY_POPOVER_CLASS, "w-[260px]")}
            >
              <PropertyPopoverSearch
                icon={<Tag className="size-[14px]" />}
                placeholder="Filter labels…"
                value={labelQuery}
                onChange={setLabelQuery}
                trailing={
                  selectedLabels.length > 0 ? (
                    <button
                      type="button"
                      className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
                      onClick={() => setSelectedLabelIds([])}
                    >
                      Clear
                    </button>
                  ) : undefined
                }
              />
              <PropertyPopoverList>
                {availableLabels
                  .filter((label) => matchesQuery(label.name, labelQuery))
                  .map((label) => {
                    const selected = selectedLabelIds.includes(label.id)
                    return (
                      <PropertyPopoverItem
                        key={label.id}
                        selected={selected}
                        onClick={() =>
                          setSelectedLabelIds((current) =>
                            toggleSelection(current, label.id)
                          )
                        }
                        trailing={
                          selected ? (
                            <Check className="size-[14px] text-foreground" />
                          ) : null
                        }
                      >
                        <span
                          aria-hidden
                          className="inline-block size-2 shrink-0 rounded-full"
                          style={{ background: label.color }}
                        />
                        <span className="truncate">{label.name}</span>
                      </PropertyPopoverItem>
                    )
                  })}
              </PropertyPopoverList>
              <PropertyPopoverFoot>
                <span>{selectedLabels.length} selected</span>
              </PropertyPopoverFoot>
            </PopoverContent>
          </Popover>

          {presentationView ? (
            <>
              <LayoutChipPopover
                view={presentationView}
                onUpdateView={updatePresentationView}
              />
              <FilterPopover
                view={presentationView}
                items={scopedTeamItems}
                onToggleFilterValue={togglePresentationFilterValue}
                onClearFilters={clearPresentationFilters}
                variant="chip"
                chipTone="default"
                dashedWhenEmpty
              />
              <LevelChipPopover
                view={presentationView}
                onUpdateView={updatePresentationView}
              />
              <GroupChipPopover
                view={presentationView}
                groupOptions={presentationGroupOptions}
                onUpdateView={updatePresentationView}
                tone="default"
                showValue={false}
                showSubGrouping={false}
              />
              <SortChipPopover
                view={presentationView}
                onUpdateView={updatePresentationView}
                label="Sort"
                showValue={false}
              />
              <PropertiesChipPopover
                view={presentationView}
                onToggleDisplayProperty={togglePresentationDisplayProperty}
                onClearDisplayProperties={clearPresentationDisplayProperties}
                tone="default"
                dashedWhenEmpty
                propertyOptions={PROJECT_PRESENTATION_PROPERTY_OPTIONS}
              />
            </>
          ) : null}
        </div>

        {availableTeams.length === 0 ? (
          <p className="px-[18px] pt-2 text-xs text-destructive">
            No editable team spaces support project creation right now.
          </p>
        ) : null}

        <div className="flex items-center gap-2.5 border-t border-line-soft bg-background px-3.5 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
            <FolderSimple className="size-[13px] shrink-0" />
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
              Cancel
              <ShortcutKeys
                keys={["Esc"]}
                className="ml-1"
                keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
              />
            </Button>
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={handleCreate}
              className="gap-1"
            >
              Create project
              <ShortcutKeys
                keys={[shortcutModifierLabel, "Enter"]}
                variant="inline"
                className="ml-0.5 gap-0.5 text-background/65"
              />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
