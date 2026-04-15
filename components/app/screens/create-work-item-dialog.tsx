"use client"

import { useState } from "react"
import { CaretDown } from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import {
  getStatusOrderForTeam,
  getTeam,
  getTeamMembers,
  getTemplateDefaultsForTeam,
} from "@/lib/domain/selectors"
import {
  getDefaultTemplateTypeForTeamExperience,
  getDisplayLabelForWorkItemType,
  getWorkSurfaceCopy,
  priorityMeta,
  statusMeta,
  type Priority,
  type WorkItemType,
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
  getCreateDialogItemTypes,
  getPreferredCreateDialogType,
  getTeamProjectOptions,
} from "@/components/app/screens/helpers"
import { cn } from "@/lib/utils"

export function CreateWorkItemDialog({
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
  const { availableLabels, team, teamMembers, teamProjects } = useAppStore(
    useShallow((state) => {
      const team = getTeam(state, teamId)

      return {
        team,
        teamMembers: team ? getTeamMembers(state, teamId) : [],
        teamProjects: getTeamProjectOptions(state, teamId),
        availableLabels: [...state.labels].sort((left, right) =>
          left.name.localeCompare(right.name)
        ),
      }
    })
  )
  const workCopy = getWorkSurfaceCopy(team?.settings.experience)
  const teamStatuses = getStatusOrderForTeam(team)
  const defaultTemplateType = getDefaultTemplateTypeForTeamExperience(
    team?.settings.experience
  )
  const [type, setType] = useState<WorkItemType>(
    getPreferredCreateDialogType(defaultTemplateType)
  )
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<WorkStatus>(
    teamStatuses.includes("todo") ? "todo" : (teamStatuses[0] ?? "backlog")
  )
  const [priority, setPriority] = useState<Priority>(
    getTemplateDefaultsForTeam(
      team,
      getDefaultTemplateTypeForTeamExperience(team?.settings.experience)
    ).defaultPriority
  )
  const [assigneeId, setAssigneeId] = useState<string>("none")
  const [projectId, setProjectId] = useState<string>("none")
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [newLabelName, setNewLabelName] = useState("")
  const [creatingLabel, setCreatingLabel] = useState(false)
  const selectedProject =
    projectId === "none"
      ? null
      : (teamProjects.find((project) => project.id === projectId) ?? null)
  const activeTemplateType =
    selectedProject?.templateType ?? defaultTemplateType
  const availableItemTypes = getCreateDialogItemTypes(activeTemplateType)
  const fallbackType = getPreferredCreateDialogType(activeTemplateType)
  const selectedType =
    availableItemTypes.find((value) => value === type) ??
    availableItemTypes[0] ??
    null
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
  const canCreate =
    !disabled && normalizedTitle.length >= 2 && selectedType !== null
  const triggerClassName =
    "h-9 w-auto max-w-full rounded-full border-border/60 bg-background px-3 text-xs font-medium shadow-none"
  const labelsTriggerText =
    selectedLabels.length === 0
      ? "Labels"
      : selectedLabels.length === 1
        ? (selectedLabels[0]?.name ?? "Labels")
        : `${selectedLabels[0]?.name ?? "Label"} +${selectedLabels.length - 1}`

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
    const created = await useAppStore.getState().createLabel(normalizedName)
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
    if (!selectedType) {
      return
    }

    const createdItemId = useAppStore.getState().createWorkItem({
      teamId,
      type: selectedType,
      title: normalizedTitle,
      priority,
      status,
      labelIds: selectedLabelIds,
      assigneeId: assigneeId === "none" ? null : assigneeId,
      primaryProjectId: projectId === "none" ? null : projectId,
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
      <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{workCopy.createLabel}</DialogTitle>
        </DialogHeader>

        <div className="border-b border-border/60 bg-muted/[0.35] px-6 pt-6 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            <Badge
              variant="outline"
              className="h-7 rounded-full border-border/60 bg-background px-3 text-[11px] font-medium tracking-normal normal-case"
            >
              {team?.name ?? "Team"}
            </Badge>
            <span className="text-muted-foreground/50">/</span>
            <span className="tracking-normal normal-case">
              Create top-level item
            </span>
          </div>

          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={titlePlaceholder}
            className="mt-5 h-auto border-none bg-transparent px-0 py-0 text-3xl font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/45 focus-visible:ring-0 md:text-[2rem]"
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add description..."
            rows={4}
            className="mt-3 min-h-[112px] resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Create it at the team level first. Parent links can be added later.
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
              value={status}
              onValueChange={(value) => setStatus(value as WorkStatus)}
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

            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className={triggerClassName}>
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teamMembers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={projectId} onValueChange={setProjectId}>
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

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    triggerClassName,
                    "border",
                    "inline-flex items-center gap-2 overflow-hidden text-left"
                  )}
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
                    disabled={creatingLabel || newLabelName.trim().length === 0}
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
              onValueChange={(value) => setType(value as WorkItemType)}
              disabled={availableItemTypes.length === 0}
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

          {availableItemTypes.length === 0 ? (
            <p className="mt-3 text-xs text-destructive">
              This team cannot create work items in the current configuration.
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
