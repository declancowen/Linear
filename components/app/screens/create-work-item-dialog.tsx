"use client"

import { useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { CaretDown } from "@phosphor-icons/react"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
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
import {
  formatInlineDescriptionContent,
  getPreferredCreateDialogType,
} from "@/components/app/screens/helpers"
import { cn, resolveImageAssetSource } from "@/lib/utils"

const NO_TEAM_VALUE = "__no_team__"

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
  const titlePlaceholder = selectedType
    ? `${getDisplayLabelForWorkItemType(
        selectedType,
        team?.settings.experience
      )} title`
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
  const triggerClassName =
    "h-9 w-auto max-w-full rounded-full border-border/60 bg-background px-3 text-xs font-medium shadow-none"
  const labelsTriggerText =
    selectedLabels.length === 0
      ? "Labels"
      : selectedLabels.length === 1
        ? (selectedLabels[0]?.name ?? "Labels")
        : `${selectedLabels[0]?.name ?? "Label"} +${selectedLabels.length - 1}`

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
    if (!selectedType || !selectedTeamId) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{workCopy.createLabel}</DialogTitle>
          <DialogDescription>
            Create a new work item and seed its initial description.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/60 bg-muted/[0.35] px-6 pt-6 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            <Badge
              variant="outline"
              className="h-7 rounded-full border-border/60 bg-background px-3 text-[11px] font-medium tracking-normal normal-case"
            >
              {team?.name ?? "Team space"}
            </Badge>
            <span className="text-muted-foreground/50">/</span>
            <span className="tracking-normal normal-case">
              {selectedParentItem ? "Create child item" : "Create item"}
            </span>
          </div>

          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={titlePlaceholder}
            className="mt-5 h-auto border-none bg-transparent px-0 py-0 text-3xl font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/45 focus-visible:ring-0 md:text-[2rem] dark:bg-transparent"
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add description..."
            rows={4}
            className="mt-3 min-h-[112px] resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 dark:bg-transparent"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Pick the team space first, then choose a parent when creating a child
            type.
          </p>
          {selectedLabels.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {selectedLabels.map((label) => (
                <Badge
                  key={label.id}
                  variant="secondary"
                  className="h-6 rounded-full px-2.5 text-[11px]"
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
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
              <SelectTrigger className={triggerClassName}>
                <SelectValue placeholder="Team space" />
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
                    <SelectItem value={NO_TEAM_VALUE}>
                      No team spaces
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(value) => setStatus(value as WorkStatus)}
              disabled={!team}
            >
              <SelectTrigger className={triggerClassName}>
                <SelectValue />
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
              <SelectTrigger className={triggerClassName}>
                <SelectValue />
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
              <SelectTrigger className={triggerClassName}>
                <SelectValue placeholder="Assignee">
                  {selectedAssignee ? (
                    <AssigneeOption
                      name={selectedAssignee.name}
                      avatarImageUrl={selectedAssignee.avatarImageUrl}
                      avatarUrl={selectedAssignee.avatarUrl}
                    />
                  ) : (
                    "Unassigned"
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
              <SelectTrigger className={triggerClassName}>
                <SelectValue placeholder="Project" />
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
                <SelectTrigger className={triggerClassName}>
                  <SelectValue placeholder="Parent">
                    {selectedParentItem
                      ? `${selectedParentItem.key} · ${selectedParentItem.title}`
                      : "No parent"}
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
                    triggerClassName,
                    "border",
                    "inline-flex items-center gap-2 overflow-hidden text-left"
                  )}
                  disabled={!team}
                >
                  <span className="truncate">{labelsTriggerText}</span>
                  <CaretDown className="size-3 shrink-0 text-muted-foreground" />
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
              <SelectTrigger className={triggerClassName}>
                <SelectValue placeholder="Type" />
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
          </div>

          {filteredTeams.length === 0 ? (
            <p className="mt-3 text-xs text-destructive">
              No editable team spaces support this work item type yet.
            </p>
          ) : null}

          {filteredTeams.length > 0 && availableItemTypes.length === 0 ? (
            <p className="mt-3 text-xs text-destructive">
              This team space cannot create top-level work items in the current
              configuration.
            </p>
          ) : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={!canCreate} onClick={handleCreate}>
              Create{" "}
              {selectedType
                ? getDisplayLabelForWorkItemType(
                    selectedType,
                    team?.settings.experience
                  ).toLowerCase()
                : workCopy.singularLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
