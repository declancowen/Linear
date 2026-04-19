"use client"

import { useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CaretDown,
  Check,
  FolderSimple,
  MagnifyingGlass,
  Plus,
  Tag,
  TreeStructure,
  X,
} from "@phosphor-icons/react"

import {
  getEditableTeamsForFeature,
  getStatusOrderForTeam,
  getTemplateDefaultsForTeam,
} from "@/lib/domain/selectors"
import {
  canParentWorkItemTypeAcceptChild,
  getAllowedWorkItemTypesForTemplate,
  getDefaultRootWorkItemTypesForTeamExperience,
  getDefaultTemplateTypeForTeamExperience,
  getDefaultWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  getWorkSurfaceCopy,
  priorityMeta,
  statusMeta,
  type Priority,
  type WorkItemType,
  type WorkStatus,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverFoot,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
import { Textarea } from "@/components/ui/textarea"
import {
  PriorityDot,
  PriorityIcon,
  StatusIcon,
} from "@/components/app/screens/shared"
import {
  formatInlineDescriptionContent,
  getPreferredCreateDialogType,
} from "@/components/app/screens/helpers"
import { cn, resolveImageAssetSource } from "@/lib/utils"

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

function getUserInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

function AssigneeOption({
  name,
  avatarUrl,
  avatarImageUrl,
}: {
  name: string
  avatarUrl?: string | null
  avatarImageUrl?: string | null
}) {
  const imageSrc = resolveImageAssetSource(avatarImageUrl, avatarUrl)

  return (
    <span className="flex items-center gap-2">
      <Avatar size="sm">
        {imageSrc ? <AvatarImage src={imageSrc} alt={name} /> : null}
        <AvatarFallback>{getUserInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  )
}

const OPEN_STATUSES: WorkStatus[] = ["backlog", "todo", "in-progress"]
const CLOSED_STATUSES: WorkStatus[] = ["done", "cancelled", "duplicate"]
const PRIORITY_ORDER: Priority[] = ["none", "urgent", "high", "medium", "low"]

function matchesQuery(value: string, query: string) {
  if (!query) {
    return true
  }
  return value.toLowerCase().includes(query.toLowerCase())
}

const chipTriggerClass =
  "inline-flex h-7 w-fit max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

const chipTriggerDashedClass =
  "border-dashed text-fg-3 bg-transparent hover:bg-surface-3"

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

export function CreateWorkItemDialog({
  open,
  onOpenChange,
  defaultTeamId,
  initialType,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTeamId?: string | null
  initialType?: WorkItemType | null
}) {
  const availableTeams = useAppStore(
    useShallow((state) => getEditableTeamsForFeature(state, "issues"))
  )
  const allLabels = useAppStore((state) => state.labels)
  const teamMemberships = useAppStore((state) => state.teamMemberships)
  const users = useAppStore((state) => state.users)
  const projects = useAppStore((state) => state.projects)
  const workItems = useAppStore((state) => state.workItems)
  const filteredTeams = useMemo(
    () =>
      availableTeams.filter(
        (team) =>
          !initialType ||
          getDefaultWorkItemTypesForTeamExperience(
            team.settings.experience
          ).includes(initialType)
      ),
    [availableTeams, initialType]
  )
  const initialTeamId =
    defaultTeamId && filteredTeams.some((team) => team.id === defaultTeamId)
      ? defaultTeamId
      : (filteredTeams[0]?.id ?? "")
  const initialTeam =
    filteredTeams.find((entry) => entry.id === initialTeamId) ?? null
  const initialTemplateType = getDefaultTemplateTypeForTeamExperience(
    initialTeam?.settings.experience
  )
  const initialStatuses = getStatusOrderForTeam(initialTeam)
  const initialPriority = getTemplateDefaultsForTeam(
    initialTeam,
    initialTemplateType
  ).defaultPriority
  const initialWorkItemType =
    initialType &&
    getDefaultWorkItemTypesForTeamExperience(
      initialTeam?.settings.experience
    ).includes(initialType)
      ? initialType
      : getPreferredCreateDialogType(initialTemplateType)
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId)
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)
  const [teamQuery, setTeamQuery] = useState("")
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)
  const [statusQuery, setStatusQuery] = useState("")
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false)
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false)
  const [assigneeQuery, setAssigneeQuery] = useState("")
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [projectQuery, setProjectQuery] = useState("")
  const [parentPickerOpen, setParentPickerOpen] = useState(false)
  const [parentQuery, setParentQuery] = useState("")
  const [labelsPickerOpen, setLabelsPickerOpen] = useState(false)
  const [labelQuery, setLabelQuery] = useState("")
  const team = useMemo(
    () => filteredTeams.find((entry) => entry.id === selectedTeamId) ?? null,
    [filteredTeams, selectedTeamId]
  )
  const labels = useMemo(
    () =>
      team
        ? allLabels.filter((label) => label.workspaceId === team.workspaceId)
        : [],
    [allLabels, team]
  )
  const teamMembers = useMemo(() => {
    const memberIds = new Set(
      teamMemberships
        .filter((membership) => membership.teamId === selectedTeamId)
        .map((membership) => membership.userId)
    )

    return users.filter((user) => memberIds.has(user.id))
  }, [selectedTeamId, teamMemberships, users])
  const teamProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.scopeType === "team" && project.scopeId === selectedTeamId
      ),
    [projects, selectedTeamId]
  )
  const availableLabels = useMemo(
    () =>
      [...labels].sort((left, right) => left.name.localeCompare(right.name)),
    [labels]
  )
  const [type, setType] = useState<WorkItemType>(initialWorkItemType)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<WorkStatus>(
    initialStatuses.includes("todo")
      ? "todo"
      : (initialStatuses[0] ?? "backlog")
  )
  const [priority, setPriority] = useState<Priority>(initialPriority)
  const [assigneeId, setAssigneeId] = useState<string>("none")
  const [projectId, setProjectId] = useState<string>("none")
  const [selectedParentId, setSelectedParentId] = useState<string>("none")
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [newLabelName, setNewLabelName] = useState("")
  const [creatingLabel, setCreatingLabel] = useState(false)
  const selectedProject =
    projectId === "none"
      ? null
      : (teamProjects.find((project) => project.id === projectId) ?? null)
  const selectedAssignee =
    assigneeId === "none"
      ? null
      : (teamMembers.find((user) => user.id === assigneeId) ?? null)
  const workCopy = getWorkSurfaceCopy(team?.settings.experience)
  const teamStatuses = getStatusOrderForTeam(team)
  const defaultTemplateType = getDefaultTemplateTypeForTeamExperience(
    team?.settings.experience
  )
  const activeTemplateType =
    selectedProject?.templateType ?? defaultTemplateType
  const availableItemTypes = getAllowedWorkItemTypesForTemplate(activeTemplateType)
  const selectedType =
    availableItemTypes.find((value) => value === type) ??
    availableItemTypes[0] ??
    null
  const scopedProjectId = projectId === "none" ? null : projectId
  const parentOptions =
    !selectedTeamId || !selectedType
      ? []
      : [...workItems]
          .filter(
            (item) =>
              item.teamId === selectedTeamId &&
              canParentWorkItemTypeAcceptChild(item.type, selectedType)
          )
          .filter((item) =>
            scopedProjectId ? item.primaryProjectId === scopedProjectId : true
          )
          .sort((left, right) =>
            left.key.localeCompare(right.key, undefined, { numeric: true })
          )
  const selectedParentItem =
    selectedParentId === "none"
      ? null
      : (parentOptions.find((item) => item.id === selectedParentId) ?? null)
  const effectiveProjectId = selectedParentItem?.primaryProjectId ?? projectId
  const selectedLabels = availableLabels.filter((label) =>
    selectedLabelIds.includes(label.id)
  )
  const selectedTypeLabel = selectedType
    ? getDisplayLabelForWorkItemType(selectedType, team?.settings.experience)
    : workCopy.singularLabel
  const titlePlaceholder = selectedType
    ? `${selectedTypeLabel} title`
    : workCopy.titlePlaceholder
  const normalizedTitle = title.trim()
  const normalizedDescription = description.trim()
  const requiresParent =
    selectedType === "sub-task" || selectedType === "sub-issue"
  const showParentSelect =
    Boolean(selectedType) &&
    (requiresParent || parentOptions.length > 0 || selectedParentItem !== null)
  const canCreate =
    filteredTeams.length > 0 &&
    normalizedTitle.length >= 2 &&
    selectedType !== null &&
    (!requiresParent || selectedParentItem !== null)
  const labelsTriggerText =
    selectedLabels.length === 0
      ? "Add label"
      : selectedLabels.length === 1
        ? (selectedLabels[0]?.name ?? "Labels")
        : `${selectedLabels[0]?.name ?? "Label"} +${selectedLabels.length - 1}`
  const teamDotColor = getTeamDotColor(team?.id ?? null)

  function syncTeamSelection(nextTeamId: string) {
    const nextTeam =
      filteredTeams.find((entry) => entry.id === nextTeamId) ?? null
    const nextTemplateType = getDefaultTemplateTypeForTeamExperience(
      nextTeam?.settings.experience
    )
    const nextStatuses = getStatusOrderForTeam(nextTeam)
    const nextPriority = getTemplateDefaultsForTeam(
      nextTeam,
      nextTemplateType
    ).defaultPriority
    const nextType =
      initialType &&
      getDefaultRootWorkItemTypesForTeamExperience(
        nextTeam?.settings.experience
      ).includes(initialType)
        ? initialType
        : getPreferredCreateDialogType(nextTemplateType)

    setSelectedTeamId(nextTeamId)
    setType(nextType)
    setStatus(
      nextStatuses.includes("todo") ? "todo" : (nextStatuses[0] ?? "backlog")
    )
    setPriority(nextPriority)
    setAssigneeId("none")
    setProjectId("none")
    setSelectedParentId("none")
    setSelectedLabelIds([])
    setNewLabelName("")
    setCreatingLabel(false)
  }

  function toggleLabel(labelId: string) {
    setSelectedLabelIds((current) =>
      current.includes(labelId)
        ? current.filter((currentId) => currentId !== labelId)
        : [...current, labelId]
    )
  }

  async function handleCreateLabel() {
    const normalizedName = newLabelName.trim()

    if (!normalizedName || creatingLabel) {
      return
    }

    setCreatingLabel(true)
    const created = await useAppStore
      .getState()
      .createLabel(normalizedName, team?.workspaceId ?? null)
    setCreatingLabel(false)

    if (!created) {
      return
    }

    setNewLabelName("")
    setSelectedLabelIds((current) =>
      current.includes(created.id) ? current : [...current, created.id]
    )
  }

  function handleCreate() {
    if (!selectedType || !selectedTeamId || !canCreate) {
      return
    }

    const createdItemId = useAppStore.getState().createWorkItem({
      teamId: selectedTeamId,
      type: selectedType,
      title: normalizedTitle,
      parentId: selectedParentItem?.id ?? null,
      priority,
      status,
      labelIds: selectedLabelIds,
      assigneeId: assigneeId === "none" ? null : assigneeId,
      primaryProjectId: effectiveProjectId === "none" ? null : effectiveProjectId,
    })

    if (!createdItemId) {
      return
    }

    if (normalizedDescription) {
      useAppStore
        .getState()
        .updateItemDescription(
          createdItemId,
          formatInlineDescriptionContent(normalizedDescription)
        )
    }

    onOpenChange(false)
  }

  useEffect(() => {
    if (!open) {
      return
    }

    function handleKey(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key === "Enter" &&
        canCreate
      ) {
        event.preventDefault()
        handleCreate()
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    canCreate,
    selectedType,
    selectedTeamId,
    selectedParentId,
    normalizedTitle,
    normalizedDescription,
    priority,
    status,
    selectedLabelIds,
    assigneeId,
    effectiveProjectId,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[42%] max-h-[calc(100vh-2rem)] gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg sm:top-[40%] sm:max-w-[640px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{workCopy.createLabel}</DialogTitle>
          <DialogDescription>
            Create a new work item and seed its initial description.
          </DialogDescription>
        </DialogHeader>

        {/* Top / crumb row */}
        <div className="flex items-center gap-1 border-b border-line-soft px-3.5 py-2 text-[12.5px] text-fg-3">
          <Popover
            open={teamPickerOpen}
            onOpenChange={(next) => {
              setTeamPickerOpen(next)
              if (!next) setTeamQuery("")
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(crumbTriggerClass, "min-w-0")}
                disabled={filteredTeams.length === 0}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ background: teamDotColor }}
                  />
                  <span className="truncate font-medium text-foreground">
                    {team?.name ?? "Team space"}
                  </span>
                </span>
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
              <PropertyPopoverSearch
                icon={<MagnifyingGlass className="size-[14px]" />}
                placeholder="Switch team space…"
                value={teamQuery}
                onChange={setTeamQuery}
              />
              <PropertyPopoverList>
                {filteredTeams.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                    No team spaces
                  </div>
                ) : (
                  <>
                    <PropertyPopoverGroup>Team spaces</PropertyPopoverGroup>
                    {filteredTeams
                      .filter((entry) => matchesQuery(entry.name, teamQuery))
                      .map((teamOption) => {
                        const selected = teamOption.id === selectedTeamId
                        return (
                          <PropertyPopoverItem
                            key={teamOption.id}
                            selected={selected}
                            onClick={() => {
                              syncTeamSelection(teamOption.id)
                              setTeamPickerOpen(false)
                              setTeamQuery("")
                            }}
                            trailing={
                              selected ? (
                                <Check className="size-[14px] text-foreground" />
                              ) : null
                            }
                          >
                            <span
                              aria-hidden
                              className="inline-block size-2 shrink-0 rounded-full"
                              style={{
                                background: getTeamDotColor(teamOption.id),
                              }}
                            />
                            <span className="truncate">{teamOption.name}</span>
                          </PropertyPopoverItem>
                        )
                      })}
                  </>
                )}
              </PropertyPopoverList>
            </PopoverContent>
          </Popover>

          <Popover open={typePickerOpen} onOpenChange={setTypePickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={crumbTriggerClass}
                disabled={availableItemTypes.length === 0 || !team}
              >
                <span className="font-medium text-foreground">
                  {selectedTypeLabel}
                </span>
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
            >
              <PropertyPopoverList>
                <PropertyPopoverGroup>Work item type</PropertyPopoverGroup>
                {availableItemTypes.map((value) => {
                  const selected = value === selectedType
                  return (
                    <PropertyPopoverItem
                      key={value}
                      selected={selected}
                      onClick={() => {
                        const nextParentStillValid =
                          selectedParentItem &&
                          canParentWorkItemTypeAcceptChild(
                            selectedParentItem.type,
                            value
                          )
                        setType(value)
                        if (!nextParentStillValid) {
                          setSelectedParentId("none")
                        }
                        setTypePickerOpen(false)
                      }}
                      trailing={
                        selected ? (
                          <Check className="size-[14px] text-foreground" />
                        ) : null
                      }
                    >
                      <span className="truncate">
                        {getDisplayLabelForWorkItemType(
                          value,
                          team?.settings.experience
                        )}
                      </span>
                    </PropertyPopoverItem>
                  )
                })}
              </PropertyPopoverList>
            </PopoverContent>
          </Popover>

          <span className="ml-0.5 text-fg-4">
            →{" "}
            {selectedParentItem
              ? `${selectedParentItem.key} · child`
              : selectedProject
                ? selectedProject.name
                : "New item"}
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

        {/* Body: title + description + formatting toolbar */}
        <div className="px-[18px] pt-3 pb-0.5">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={titlePlaceholder}
            className="h-auto border-none bg-transparent px-0 py-1 text-[20px] font-semibold tracking-[-0.01em] shadow-none placeholder:font-medium placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add description…"
            rows={3}
            className="mt-0.5 min-h-[60px] resize-none border-none bg-transparent px-0 py-1 text-[13.5px] leading-[1.6] text-fg-2 shadow-none placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
          />

        </div>

        {/* Props row */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-background px-[18px] py-2.5">
          <Popover
            open={statusPickerOpen}
            onOpenChange={(next) => {
              setStatusPickerOpen(next)
              if (!next) setStatusQuery("")
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={chipTriggerClass}
                disabled={!team}
              >
                <StatusIcon status={status} />
                <span className="font-medium text-foreground">
                  {statusMeta[status].label}
                </span>
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
              <PropertyPopoverSearch
                icon={<MagnifyingGlass className="size-[14px]" />}
                placeholder="Change status…"
                value={statusQuery}
                onChange={setStatusQuery}
              />
              <PropertyPopoverList>
                {(() => {
                  const activeMatches = teamStatuses.filter(
                    (value) =>
                      OPEN_STATUSES.includes(value) &&
                      matchesQuery(statusMeta[value].label, statusQuery)
                  )
                  const closedMatches = teamStatuses.filter(
                    (value) =>
                      CLOSED_STATUSES.includes(value) &&
                      matchesQuery(statusMeta[value].label, statusQuery)
                  )
                  return (
                    <>
                      {activeMatches.length > 0 ? (
                        <>
                          <PropertyPopoverGroup>Active</PropertyPopoverGroup>
                          {activeMatches.map((value) => {
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
                                <StatusIcon status={value} />
                                <span>{statusMeta[value].label}</span>
                              </PropertyPopoverItem>
                            )
                          })}
                        </>
                      ) : null}
                      {closedMatches.length > 0 ? (
                        <>
                          <PropertyPopoverGroup>Closed</PropertyPopoverGroup>
                          {closedMatches.map((value) => {
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
                                <StatusIcon status={value} />
                                <span>{statusMeta[value].label}</span>
                              </PropertyPopoverItem>
                            )
                          })}
                        </>
                      ) : null}
                      {activeMatches.length === 0 &&
                      closedMatches.length === 0 ? (
                        <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                          No statuses match
                        </div>
                      ) : null}
                    </>
                  )
                })()}
              </PropertyPopoverList>
              <PropertyPopoverFoot>
                <span>↑↓ to navigate · ↵ to select</span>
              </PropertyPopoverFoot>
            </PopoverContent>
          </Popover>

          <Popover
            open={priorityPickerOpen}
            onOpenChange={setPriorityPickerOpen}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={chipTriggerClass}
                disabled={!team}
              >
                <PriorityDot priority={priority} />
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
                {PRIORITY_ORDER.map((value) => {
                  const selected = value === priority
                  return (
                    <PropertyPopoverItem
                      key={value}
                      selected={selected}
                      onClick={() => {
                        setPriority(value)
                        setPriorityPickerOpen(false)
                      }}
                      trailing={
                        selected ? (
                          <Check className="size-[14px] text-foreground" />
                        ) : null
                      }
                    >
                      <PriorityIcon priority={value} />
                      <span>
                        {value === "none"
                          ? "No priority"
                          : priorityMeta[value].label}
                      </span>
                    </PropertyPopoverItem>
                  )
                })}
              </PropertyPopoverList>
            </PopoverContent>
          </Popover>

          <Popover
            open={assigneePickerOpen}
            onOpenChange={(next) => {
              setAssigneePickerOpen(next)
              if (!next) setAssigneeQuery("")
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  chipTriggerClass,
                  !selectedAssignee && chipTriggerDashedClass
                )}
                disabled={!team}
              >
                {selectedAssignee ? (
                  <AssigneeOption
                    name={selectedAssignee.name}
                    avatarImageUrl={selectedAssignee.avatarImageUrl}
                    avatarUrl={selectedAssignee.avatarUrl}
                  />
                ) : (
                  <span className="flex items-center gap-1.5 text-fg-3">
                    <span className="inline-grid size-[18px] place-items-center rounded-full border border-dashed border-line text-[9px] text-fg-3">
                      ?
                    </span>
                    Unassigned
                  </span>
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
                placeholder="Assign someone…"
                value={assigneeQuery}
                onChange={setAssigneeQuery}
              />
              <PropertyPopoverList>
                {(() => {
                  const matches = teamMembers.filter((user) =>
                    matchesQuery(user.name, assigneeQuery)
                  )
                  return (
                    <>
                      {matches.length > 0 ? (
                        <>
                          <PropertyPopoverGroup>Members</PropertyPopoverGroup>
                          {matches.map((user) => {
                            const selected = user.id === assigneeId
                            return (
                              <PropertyPopoverItem
                                key={user.id}
                                selected={selected}
                                onClick={() => {
                                  setAssigneeId(user.id)
                                  setAssigneePickerOpen(false)
                                }}
                                trailing={
                                  selected ? (
                                    <Check className="size-[14px] text-foreground" />
                                  ) : null
                                }
                              >
                                <AssigneeOption
                                  name={user.name}
                                  avatarImageUrl={user.avatarImageUrl}
                                  avatarUrl={user.avatarUrl}
                                />
                              </PropertyPopoverItem>
                            )
                          })}
                        </>
                      ) : (
                        <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                          No members match
                        </div>
                      )}
                      <PropertyPopoverItem
                        muted
                        selected={assigneeId === "none"}
                        onClick={() => {
                          setAssigneeId("none")
                          setAssigneePickerOpen(false)
                        }}
                        trailing={
                          assigneeId === "none" ? (
                            <Check className="size-[14px] text-foreground" />
                          ) : null
                        }
                      >
                        <X className="size-[14px] shrink-0" />
                        <span>Unassign</span>
                      </PropertyPopoverItem>
                    </>
                  )
                })()}
              </PropertyPopoverList>
            </PopoverContent>
          </Popover>

          <Popover
            open={projectPickerOpen}
            onOpenChange={(next) => {
              setProjectPickerOpen(next)
              if (!next) setProjectQuery("")
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  chipTriggerClass,
                  !selectedProject && chipTriggerDashedClass
                )}
                disabled={
                  !team || Boolean(selectedParentItem?.primaryProjectId)
                }
              >
                <FolderSimple className="size-[13px]" />
                <span
                  className={cn(
                    "truncate",
                    selectedProject && "font-medium text-foreground"
                  )}
                >
                  {selectedProject ? selectedProject.name : "Project"}
                </span>
                <CaretDown className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
              <PropertyPopoverSearch
                icon={<MagnifyingGlass className="size-[14px]" />}
                placeholder="Find project…"
                value={projectQuery}
                onChange={setProjectQuery}
              />
              <PropertyPopoverList>
                {(() => {
                  const matches = teamProjects.filter((project) =>
                    matchesQuery(project.name, projectQuery)
                  )
                  return (
                    <>
                      {matches.length > 0 ? (
                        <>
                          <PropertyPopoverGroup>Projects</PropertyPopoverGroup>
                          {matches.map((project) => {
                            const selected = project.id === effectiveProjectId
                            return (
                              <PropertyPopoverItem
                                key={project.id}
                                selected={selected}
                                onClick={() => {
                                  setProjectId(project.id)
                                  if (
                                    selectedParentItem &&
                                    selectedParentItem.primaryProjectId !==
                                      project.id
                                  ) {
                                    setSelectedParentId("none")
                                  }
                                  setProjectPickerOpen(false)
                                }}
                                trailing={
                                  selected ? (
                                    <Check className="size-[14px] text-foreground" />
                                  ) : null
                                }
                              >
                                <FolderSimple className="size-[14px] shrink-0 text-fg-3" />
                                <span className="truncate">{project.name}</span>
                              </PropertyPopoverItem>
                            )
                          })}
                        </>
                      ) : (
                        <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                          No projects match
                        </div>
                      )}
                      <PropertyPopoverItem
                        muted
                        selected={effectiveProjectId === "none"}
                        onClick={() => {
                          setProjectId("none")
                          setProjectPickerOpen(false)
                        }}
                        trailing={
                          effectiveProjectId === "none" ? (
                            <Check className="size-[14px] text-foreground" />
                          ) : null
                        }
                      >
                        <X className="size-[14px] shrink-0" />
                        <span>No project</span>
                      </PropertyPopoverItem>
                    </>
                  )
                })()}
              </PropertyPopoverList>
            </PopoverContent>
          </Popover>

          {showParentSelect ? (
            <Popover
              open={parentPickerOpen}
              onOpenChange={(next) => {
                setParentPickerOpen(next)
                if (!next) setParentQuery("")
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    chipTriggerClass,
                    !selectedParentItem && chipTriggerDashedClass
                  )}
                  disabled={!team || parentOptions.length === 0}
                >
                  <TreeStructure className="size-[13px]" />
                  <span
                    className={cn(
                      "truncate",
                      selectedParentItem && "font-medium text-foreground"
                    )}
                  >
                    {selectedParentItem
                      ? `${selectedParentItem.key}`
                      : "Parent"}
                  </span>
                  <CaretDown className="size-3 shrink-0 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
                <PropertyPopoverSearch
                  icon={<MagnifyingGlass className="size-[14px]" />}
                  placeholder="Find parent…"
                  value={parentQuery}
                  onChange={setParentQuery}
                />
                <PropertyPopoverList>
                  {(() => {
                    const matches = parentOptions.filter(
                      (item) =>
                        matchesQuery(item.key, parentQuery) ||
                        matchesQuery(item.title, parentQuery)
                    )
                    return (
                      <>
                        {matches.length > 0 ? (
                          <>
                            <PropertyPopoverGroup>
                              Available parents
                            </PropertyPopoverGroup>
                            {matches.map((parentOption) => {
                              const selected =
                                parentOption.id === selectedParentId
                              return (
                                <PropertyPopoverItem
                                  key={parentOption.id}
                                  selected={selected}
                                  onClick={() => {
                                    setSelectedParentId(parentOption.id)
                                    if (parentOption.primaryProjectId) {
                                      setProjectId(
                                        parentOption.primaryProjectId
                                      )
                                    }
                                    setParentPickerOpen(false)
                                  }}
                                  trailing={
                                    selected ? (
                                      <Check className="size-[14px] text-foreground" />
                                    ) : null
                                  }
                                >
                                  <TreeStructure className="size-[14px] shrink-0 text-fg-3" />
                                  <span className="truncate">
                                    <span className="text-fg-3">
                                      {parentOption.key}
                                    </span>{" "}
                                    <span>{parentOption.title}</span>
                                  </span>
                                </PropertyPopoverItem>
                              )
                            })}
                          </>
                        ) : (
                          <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                            No parents available
                          </div>
                        )}
                        <PropertyPopoverItem
                          muted
                          selected={selectedParentId === "none"}
                          onClick={() => {
                            setSelectedParentId("none")
                            setParentPickerOpen(false)
                          }}
                          trailing={
                            selectedParentId === "none" ? (
                              <Check className="size-[14px] text-foreground" />
                            ) : null
                          }
                        >
                          <X className="size-[14px] shrink-0" />
                          <span>No parent</span>
                        </PropertyPopoverItem>
                      </>
                    )
                  })()}
                </PropertyPopoverList>
              </PopoverContent>
            </Popover>
          ) : null}

          <Popover
            open={labelsPickerOpen}
            onOpenChange={(next) => {
              setLabelsPickerOpen(next)
              if (!next) {
                setLabelQuery("")
                setNewLabelName("")
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  chipTriggerClass,
                  selectedLabels.length === 0 && chipTriggerDashedClass
                )}
                disabled={!team}
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
                  selectedLabelIds.length > 0 ? (
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
                {(() => {
                  const query = labelQuery.trim()
                  const matched = availableLabels.filter((label) =>
                    matchesQuery(label.name, query)
                  )
                  const selected = matched.filter((label) =>
                    selectedLabelIds.includes(label.id)
                  )
                  const unselected = matched.filter(
                    (label) => !selectedLabelIds.includes(label.id)
                  )

                  return (
                    <>
                      {selected.length > 0 ? (
                        <>
                          <PropertyPopoverGroup>
                            {`Selected · ${selected.length}`}
                          </PropertyPopoverGroup>
                          {selected.map((label) => (
                            <PropertyPopoverItem
                              key={label.id}
                              selected
                              onClick={() => toggleLabel(label.id)}
                              trailing={
                                <Check className="size-[14px] text-foreground" />
                              }
                            >
                              <span
                                aria-hidden
                                className="inline-block size-2 shrink-0 rounded-full"
                                style={{ background: label.color }}
                              />
                              <span className="truncate">{label.name}</span>
                            </PropertyPopoverItem>
                          ))}
                        </>
                      ) : null}

                      {unselected.length > 0 ? (
                        <>
                          <PropertyPopoverGroup>All</PropertyPopoverGroup>
                          {unselected.map((label) => (
                            <PropertyPopoverItem
                              key={label.id}
                              onClick={() => toggleLabel(label.id)}
                            >
                              <span
                                aria-hidden
                                className="inline-block size-2 shrink-0 rounded-full"
                                style={{ background: label.color }}
                              />
                              <span className="truncate">{label.name}</span>
                            </PropertyPopoverItem>
                          ))}
                        </>
                      ) : null}

                      {matched.length === 0 ? (
                        <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                          {availableLabels.length === 0
                            ? "No labels yet"
                            : "No labels match"}
                        </div>
                      ) : null}

                      <div className="mt-1 flex items-center gap-2 border-t border-line-soft px-2.5 pt-2 pb-1 text-fg-3">
                        <Plus className="size-[14px] shrink-0" />
                        <input
                          value={newLabelName}
                          onChange={(event) =>
                            setNewLabelName(event.target.value)
                          }
                          placeholder="Create new label"
                          className="h-5 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-fg-4"
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") {
                              return
                            }
                            event.preventDefault()
                            void handleCreateLabel()
                          }}
                          disabled={!team || creatingLabel}
                        />
                        {newLabelName.trim().length > 0 ? (
                          <button
                            type="button"
                            className="text-[11px] font-medium text-fg-2 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!team || creatingLabel}
                            onClick={() => {
                              void handleCreateLabel()
                            }}
                          >
                            Add
                          </button>
                        ) : null}
                      </div>
                    </>
                  )
                })()}
              </PropertyPopoverList>
              <PropertyPopoverFoot>
                <span>Tap to toggle · Esc to close</span>
              </PropertyPopoverFoot>
            </PopoverContent>
          </Popover>

        </div>

        {filteredTeams.length === 0 ? (
          <p className="px-[18px] pt-2 text-xs text-destructive">
            No editable team spaces support this work item type yet.
          </p>
        ) : null}

        {filteredTeams.length > 0 && availableItemTypes.length === 0 ? (
          <p className="px-[18px] pt-2 text-xs text-destructive">
            This team space cannot create top-level work items in the current
            configuration.
          </p>
        ) : null}

        {/* Footer */}
        <div className="flex items-center gap-2.5 border-t border-line-soft bg-background px-3.5 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
            <FolderSimple className="size-[13px] shrink-0" />
            <span className="truncate">
              {selectedProject ? (
                <>
                  Adding to{" "}
                  <b className="font-medium text-foreground">
                    {selectedProject.name}
                  </b>
                </>
              ) : team ? (
                <>
                  Adding to{" "}
                  <b className="font-medium text-foreground">{team.name}</b>
                </>
              ) : (
                "Select a team space"
              )}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-fg-2"
            >
              Cancel
              <KbdHint>Esc</KbdHint>
            </Button>
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={handleCreate}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Create {selectedTypeLabel.toLowerCase()}
              <KbdHint className="border-foreground/20 bg-foreground/10 text-background/80">
                ⌘⏎
              </KbdHint>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
