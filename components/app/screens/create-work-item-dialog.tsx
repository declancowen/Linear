"use client"

import { useEffect, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  At,
  CalendarBlank,
  CaretDown,
  Clock,
  Flag,
  FolderSimple,
  Link as LinkIcon,
  ListBullets,
  Paperclip,
  Tag,
  TextB,
  TextItalic,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PriorityDot, StatusIcon } from "@/components/app/screens/shared"
import {
  formatInlineDescriptionContent,
  getPreferredCreateDialogType,
} from "@/components/app/screens/helpers"
import { cn, resolveImageAssetSource } from "@/lib/utils"

const NO_TEAM_VALUE = "__no_team__"

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

const chipTriggerClass =
  "inline-flex h-7 w-fit max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

const chipTriggerDashedClass =
  "border-dashed text-fg-3 bg-transparent hover:bg-surface-3"

const crumbTriggerClass =
  "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

const toolbarIconClass =
  "inline-grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-default disabled:opacity-60"

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
  const [createAnother, setCreateAnother] = useState(false)
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
  const fallbackType = getPreferredCreateDialogType(activeTemplateType)
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

  function resetFormFields(nextTeam = team) {
    const nextStatuses = getStatusOrderForTeam(nextTeam)
    const nextTemplate = getDefaultTemplateTypeForTeamExperience(
      nextTeam?.settings.experience
    )
    setTitle("")
    setDescription("")
    setStatus(
      nextStatuses.includes("todo") ? "todo" : (nextStatuses[0] ?? "backlog")
    )
    setPriority(
      getTemplateDefaultsForTeam(nextTeam, nextTemplate).defaultPriority
    )
    setAssigneeId("none")
    setProjectId("none")
    setSelectedParentId("none")
    setSelectedLabelIds([])
    setNewLabelName("")
    setCreatingLabel(false)
  }

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

    if (createAnother) {
      resetFormFields()
      return
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
    normalizedTitle,
    normalizedDescription,
    priority,
    status,
    selectedLabelIds,
    assigneeId,
    effectiveProjectId,
    createAnother,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg sm:max-w-[640px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{workCopy.createLabel}</DialogTitle>
          <DialogDescription>
            Create a new work item and seed its initial description.
          </DialogDescription>
        </DialogHeader>

        {/* Top / crumb row */}
        <div className="flex items-center gap-1 border-b border-line-soft px-3.5 py-2 text-[12.5px] text-fg-3">
          <Select
            value={selectedTeamId || NO_TEAM_VALUE}
            onValueChange={(value) => {
              if (value === NO_TEAM_VALUE) {
                return
              }
              syncTeamSelection(value)
            }}
            disabled={filteredTeams.length === 0}
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
                    {team?.name ?? "Team space"}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {filteredTeams.length > 0 ? (
                  filteredTeams.map((teamOption) => (
                    <SelectItem key={teamOption.id} value={teamOption.id}>
                      {teamOption.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value={NO_TEAM_VALUE}>No team spaces</SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={selectedType ?? fallbackType}
            onValueChange={(value) => {
              const nextType = value as WorkItemType
              const nextParentStillValid =
                selectedParentItem &&
                canParentWorkItemTypeAcceptChild(
                  selectedParentItem.type,
                  nextType
                )

              setType(nextType)

              if (!nextParentStillValid) {
                setSelectedParentId("none")
              }
            }}
            disabled={availableItemTypes.length === 0 || !team}
          >
            <SelectTrigger size="sm" className={crumbTriggerClass}>
              <SelectValue placeholder="Type">
                <span className="font-medium text-foreground">
                  {selectedTypeLabel}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {availableItemTypes.map((value) => (
                  <SelectItem key={value} value={value}>
                    {getDisplayLabelForWorkItemType(
                      value,
                      team?.settings.experience
                    )}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

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

          <div className="flex items-center gap-0.5 pt-1 pb-2 text-fg-3">
            <button type="button" className={toolbarIconClass} disabled aria-label="Bold">
              <TextB className="size-[13px]" />
            </button>
            <button type="button" className={toolbarIconClass} disabled aria-label="Italic">
              <TextItalic className="size-[13px]" />
            </button>
            <button type="button" className={toolbarIconClass} disabled aria-label="List">
              <ListBullets className="size-[13px]" />
            </button>
            <button type="button" className={toolbarIconClass} disabled aria-label="Mention">
              <At className="size-[13px]" />
            </button>
            <button type="button" className={toolbarIconClass} disabled aria-label="Link">
              <LinkIcon className="size-[13px]" />
            </button>
            <button type="button" className={toolbarIconClass} disabled aria-label="Attach">
              <Paperclip className="size-[13px]" />
            </button>
            <span className="ml-auto text-[11.5px] text-fg-4">
              Markdown supported
            </span>
          </div>
        </div>

        {/* Props row */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-background px-[18px] py-2.5">
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as WorkStatus)}
            disabled={!team}
          >
            <SelectTrigger size="sm" className={chipTriggerClass}>
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <StatusIcon status={status} />
                  <span className="font-medium text-foreground">
                    {statusMeta[status].label}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {teamStatuses.map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusMeta[value].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as Priority)}
            disabled={!team}
          >
            <SelectTrigger size="sm" className={chipTriggerClass}>
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <PriorityDot priority={priority} />
                  <span className="font-medium text-foreground">
                    {priorityMeta[priority].label}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(priorityMeta).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label} priority
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={assigneeId}
            onValueChange={setAssigneeId}
            disabled={!team}
          >
            <SelectTrigger
              size="sm"
              className={cn(
                chipTriggerClass,
                !selectedAssignee && chipTriggerDashedClass
              )}
            >
              <SelectValue placeholder="Assignee">
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
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">Unassigned</SelectItem>
                {teamMembers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <AssigneeOption
                      name={user.name}
                      avatarImageUrl={user.avatarImageUrl}
                      avatarUrl={user.avatarUrl}
                    />
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={effectiveProjectId}
            onValueChange={(value) => {
              setProjectId(value)
              if (
                selectedParentItem &&
                value !== "none" &&
                selectedParentItem.primaryProjectId !== value
              ) {
                setSelectedParentId("none")
              }
            }}
            disabled={!team || Boolean(selectedParentItem?.primaryProjectId)}
          >
            <SelectTrigger
              size="sm"
              className={cn(
                chipTriggerClass,
                !selectedProject && chipTriggerDashedClass
              )}
            >
              <SelectValue placeholder="Project">
                <span className="flex items-center gap-1.5">
                  <FolderSimple className="size-[13px]" />
                  <span
                    className={cn(
                      "truncate",
                      selectedProject && "font-medium text-foreground"
                    )}
                  >
                    {selectedProject ? selectedProject.name : "Project"}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">No project</SelectItem>
                {teamProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {showParentSelect ? (
            <Select
              value={selectedParentItem ? selectedParentId : "none"}
              onValueChange={(value) => {
                setSelectedParentId(value)

                if (value === "none") {
                  return
                }

                const nextParent =
                  parentOptions.find((item) => item.id === value) ?? null

                if (nextParent?.primaryProjectId) {
                  setProjectId(nextParent.primaryProjectId)
                }
              }}
              disabled={!team || parentOptions.length === 0}
            >
              <SelectTrigger
                size="sm"
                className={cn(
                  chipTriggerClass,
                  !selectedParentItem && chipTriggerDashedClass
                )}
              >
                <SelectValue placeholder="Parent">
                  <span className="flex items-center gap-1.5">
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
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="none">No parent</SelectItem>
                  {parentOptions.map((parentOption) => (
                    <SelectItem key={parentOption.id} value={parentOption.id}>
                      {parentOption.key} · {parentOption.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}

          <Popover>
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
            <PopoverContent align="start" className="w-72 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Labels
                </div>
                {selectedLabelIds.length > 0 ? (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setSelectedLabelIds([])}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <ScrollArea className="mt-3 max-h-48 pr-3">
                <div className="flex flex-wrap gap-2">
                  {availableLabels.length > 0 ? (
                    availableLabels.map((label) => {
                      const selected = selectedLabelIds.includes(label.id)

                      return (
                        <button
                          key={label.id}
                          type="button"
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            selected
                              ? "border-primary/40 bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => toggleLabel(label.id)}
                        >
                          {label.name}
                        </button>
                      )
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No labels yet
                    </span>
                  )}
                </div>
              </ScrollArea>
              <div className="mt-3 flex gap-2">
                <Input
                  value={newLabelName}
                  onChange={(event) => setNewLabelName(event.target.value)}
                  placeholder="Create label"
                  className="h-8 text-sm"
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return
                    }

                    event.preventDefault()
                    void handleCreateLabel()
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  disabled={
                    !team || creatingLabel || newLabelName.trim().length === 0
                  }
                  onClick={() => {
                    void handleCreateLabel()
                  }}
                >
                  Add
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            className={cn(chipTriggerClass, chipTriggerDashedClass)}
            disabled
            aria-label="Due date (coming soon)"
          >
            <CalendarBlank className="size-[13px]" />
            <span>Due date</span>
          </button>

          <button
            type="button"
            className={cn(chipTriggerClass, chipTriggerDashedClass)}
            disabled
            aria-label="Milestone (coming soon)"
          >
            <Flag className="size-[13px]" />
            <span>Milestone</span>
          </button>

          <button
            type="button"
            className={cn(chipTriggerClass, chipTriggerDashedClass)}
            disabled
            aria-label="Estimate (coming soon)"
          >
            <Clock className="size-[13px]" />
            <span>Estimate</span>
          </button>
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
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-fg-3 select-none">
              <input
                type="checkbox"
                checked={createAnother}
                onChange={(event) => setCreateAnother(event.target.checked)}
                className="size-3.5 rounded border-line accent-[color:var(--accent-fg)]"
              />
              Create another
            </label>
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
