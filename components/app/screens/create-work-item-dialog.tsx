"use client"

import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  CalendarDots,
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
} from "@/lib/domain/selectors"
import {
  getTextInputLimitState,
  labelNameConstraints,
  workItemTitleConstraints,
} from "@/lib/domain/input-constraints"
import { formatDateInputLabel as formatDateChipLabel } from "@/lib/date-input"
import { getDisplayInitials } from "@/lib/display-initials"
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
  type Label,
  type Priority,
  type Project,
  type Team,
  type TeamMembership,
  type UserProfile,
  type WorkItem,
  type WorkItemType,
  type WorkStatus,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverFoot,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
import { Textarea } from "@/components/ui/textarea"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
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
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size="sm" className="size-4 data-[size=sm]:size-4">
        {imageSrc ? <AvatarImage src={imageSrc} alt={name} /> : null}
        <AvatarFallback>{getDisplayInitials(name, "?")}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">{name}</span>
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

type TextLimitState = ReturnType<typeof getTextInputLimitState>

function TeamSpacePicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  filteredTeams,
  selectedTeamId,
  team,
  teamDotColor,
  onSelectTeam,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  filteredTeams: Team[]
  selectedTeamId: string
  team: Team | null
  teamDotColor: string
  onSelectTeam: (teamId: string) => void
}) {
  const matchingTeams = filteredTeams.filter((entry) =>
    matchesQuery(entry.name, query)
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          onQueryChange("")
        }
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
          value={query}
          onChange={onQueryChange}
        />
        <PropertyPopoverList>
          {filteredTeams.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
              No team spaces
            </div>
          ) : (
            <>
              <PropertyPopoverGroup>Team spaces</PropertyPopoverGroup>
              {matchingTeams.map((teamOption) => {
                const selected = teamOption.id === selectedTeamId
                return (
                  <PropertyPopoverItem
                    key={teamOption.id}
                    selected={selected}
                    onClick={() => onSelectTeam(teamOption.id)}
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
  )
}

function WorkItemTypePicker({
  open,
  onOpenChange,
  availableItemTypes,
  selectedType,
  selectedTypeLabel,
  team,
  onSelectType,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableItemTypes: WorkItemType[]
  selectedType: WorkItemType | null
  selectedTypeLabel: string
  team: Team | null
  onSelectType: (type: WorkItemType) => void
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
                onClick={() => onSelectType(value)}
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
  )
}

function CreateWorkItemCrumbRow({
  filteredTeams,
  selectedTeamId,
  team,
  teamDotColor,
  teamPickerOpen,
  onTeamPickerOpenChange,
  teamQuery,
  onTeamQueryChange,
  onSelectTeam,
  typePickerOpen,
  onTypePickerOpenChange,
  availableItemTypes,
  selectedType,
  selectedTypeLabel,
  onSelectType,
  secondaryContextLabel,
}: {
  filteredTeams: Team[]
  selectedTeamId: string
  team: Team | null
  teamDotColor: string
  teamPickerOpen: boolean
  onTeamPickerOpenChange: (open: boolean) => void
  teamQuery: string
  onTeamQueryChange: (query: string) => void
  onSelectTeam: (teamId: string) => void
  typePickerOpen: boolean
  onTypePickerOpenChange: (open: boolean) => void
  availableItemTypes: WorkItemType[]
  selectedType: WorkItemType | null
  selectedTypeLabel: string
  onSelectType: (type: WorkItemType) => void
  secondaryContextLabel: string | null
}) {
  return (
    <div className="flex items-center gap-1 border-b border-line-soft px-3.5 py-2 text-[12.5px] text-fg-3">
      <TeamSpacePicker
        open={teamPickerOpen}
        onOpenChange={onTeamPickerOpenChange}
        query={teamQuery}
        onQueryChange={onTeamQueryChange}
        filteredTeams={filteredTeams}
        selectedTeamId={selectedTeamId}
        team={team}
        teamDotColor={teamDotColor}
        onSelectTeam={onSelectTeam}
      />

      <WorkItemTypePicker
        open={typePickerOpen}
        onOpenChange={onTypePickerOpenChange}
        availableItemTypes={availableItemTypes}
        selectedType={selectedType}
        selectedTypeLabel={selectedTypeLabel}
        team={team}
        onSelectType={onSelectType}
      />

      {secondaryContextLabel ? (
        <span className="ml-0.5 text-fg-4">-&gt; {secondaryContextLabel}</span>
      ) : null}

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
  )
}

function CreateWorkItemTitleFields({
  title,
  onTitleChange,
  titlePlaceholder,
  titleLimitState,
  description,
  onDescriptionChange,
}: {
  title: string
  onTitleChange: (title: string) => void
  titlePlaceholder: string
  titleLimitState: TextLimitState
  description: string
  onDescriptionChange: (description: string) => void
}) {
  return (
    <div className="px-[18px] pt-3 pb-0.5">
      <Input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder={titlePlaceholder}
        maxLength={workItemTitleConstraints.max}
        className="h-auto border-none bg-transparent px-0 py-1 text-[20px] font-semibold tracking-[-0.01em] shadow-none placeholder:font-medium placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
        autoFocus
      />
      <FieldCharacterLimit
        state={titleLimitState}
        limit={workItemTitleConstraints.max}
        className="mt-1"
      />
      <Textarea
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="Add description…"
        rows={3}
        className="mt-0.5 min-h-[60px] resize-none border-none bg-transparent px-0 py-1 text-[13.5px] leading-[1.6] text-fg-2 shadow-none placeholder:text-fg-4 focus-visible:ring-0 dark:bg-transparent"
      />
    </div>
  )
}

function StatusPicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  team,
  status,
  teamStatuses,
  onStatusChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  team: Team | null
  status: WorkStatus
  teamStatuses: WorkStatus[]
  onStatusChange: (status: WorkStatus) => void
}) {
  const activeMatches = teamStatuses.filter(
    (value) =>
      OPEN_STATUSES.includes(value) &&
      matchesQuery(statusMeta[value].label, query)
  )
  const closedMatches = teamStatuses.filter(
    (value) =>
      CLOSED_STATUSES.includes(value) &&
      matchesQuery(statusMeta[value].label, query)
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          onQueryChange("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={chipTriggerClass} disabled={!team}>
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
          value={query}
          onChange={onQueryChange}
        />
        <PropertyPopoverList>
          {activeMatches.length > 0 ? (
            <>
              <PropertyPopoverGroup>Active</PropertyPopoverGroup>
              {activeMatches.map((value) => {
                const selected = value === status
                return (
                  <PropertyPopoverItem
                    key={value}
                    selected={selected}
                    onClick={() => onStatusChange(value)}
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
                    onClick={() => onStatusChange(value)}
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
          {activeMatches.length === 0 && closedMatches.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
              No statuses match
            </div>
          ) : null}
        </PropertyPopoverList>
        <PropertyPopoverFoot>
          <span>↑↓ to navigate · ↵ to select</span>
        </PropertyPopoverFoot>
      </PopoverContent>
    </Popover>
  )
}

function PriorityPicker({
  open,
  onOpenChange,
  team,
  priority,
  onPriorityChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: Team | null
  priority: Priority
  onPriorityChange: (priority: Priority) => void
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className={chipTriggerClass} disabled={!team}>
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
                onClick={() => onPriorityChange(value)}
                trailing={
                  selected ? (
                    <Check className="size-[14px] text-foreground" />
                  ) : null
                }
              >
                <PriorityIcon priority={value} />
                <span>
                  {value === "none" ? "No priority" : priorityMeta[value].label}
                </span>
              </PropertyPopoverItem>
            )
          })}
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function AssigneePicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  team,
  teamMembers,
  selectedAssignee,
  effectiveAssigneeId,
  onAssigneeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  team: Team | null
  teamMembers: UserProfile[]
  selectedAssignee: UserProfile | null
  effectiveAssigneeId: string
  onAssigneeChange: (assigneeId: string) => void
}) {
  const matches = teamMembers.filter((user) => matchesQuery(user.name, query))

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          onQueryChange("")
        }
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
          value={query}
          onChange={onQueryChange}
        />
        <PropertyPopoverList>
          {matches.length > 0 ? (
            <>
              <PropertyPopoverGroup>Members</PropertyPopoverGroup>
              {matches.map((user) => {
                const selected = user.id === effectiveAssigneeId
                return (
                  <PropertyPopoverItem
                    key={user.id}
                    selected={selected}
                    onClick={() => onAssigneeChange(user.id)}
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
            selected={effectiveAssigneeId === "none"}
            onClick={() => onAssigneeChange("none")}
            trailing={
              effectiveAssigneeId === "none" ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <X className="size-[14px] shrink-0" />
            <span>Unassign</span>
          </PropertyPopoverItem>
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function ProjectPicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  team,
  teamProjects,
  selectedProject,
  effectiveProjectId,
  selectedParentItem,
  onProjectChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  team: Team | null
  teamProjects: Project[]
  selectedProject: Project | null
  effectiveProjectId: string
  selectedParentItem: WorkItem | null
  onProjectChange: (projectId: string) => void
}) {
  const matches = teamProjects.filter((project) =>
    matchesQuery(project.name, query)
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          onQueryChange("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            chipTriggerClass,
            !selectedProject && chipTriggerDashedClass
          )}
          disabled={!team || Boolean(selectedParentItem?.primaryProjectId)}
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
          value={query}
          onChange={onQueryChange}
        />
        <PropertyPopoverList>
          {matches.length > 0 ? (
            <>
              <PropertyPopoverGroup>Projects</PropertyPopoverGroup>
              {matches.map((project) => {
                const selected = project.id === effectiveProjectId
                return (
                  <PropertyPopoverItem
                    key={project.id}
                    selected={selected}
                    onClick={() => onProjectChange(project.id)}
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
            onClick={() => onProjectChange("none")}
            trailing={
              effectiveProjectId === "none" ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <X className="size-[14px] shrink-0" />
            <span>No project</span>
          </PropertyPopoverItem>
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function DateChipPicker({
  value,
  label,
  onValueChange,
}: {
  value: string | null
  label: string
  onValueChange: (value: string | null) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(chipTriggerClass, !value && chipTriggerDashedClass)}
        >
          <CalendarDots className="size-[13px]" />
          <span
            className={cn("truncate", value && "font-medium text-foreground")}
          >
            {formatDateChipLabel(value, label)}
          </span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[240px]")}
      >
        <div className="px-3 py-3">
          <div className="mb-2 text-[11px] font-medium text-fg-3">{label}</div>
          <input
            type="date"
            value={value ?? ""}
            onChange={(event) => onValueChange(event.target.value || null)}
            className="h-8 w-full rounded-md border border-line bg-background px-2 text-[12.5px] outline-none"
          />
        </div>
        <PropertyPopoverFoot>
          <button
            type="button"
            className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
            onClick={() => onValueChange(null)}
          >
            Clear
          </button>
        </PropertyPopoverFoot>
      </PopoverContent>
    </Popover>
  )
}

function ParentPicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  team,
  parentOptions,
  selectedParentId,
  selectedParentItem,
  onParentChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  team: Team | null
  parentOptions: WorkItem[]
  selectedParentId: string
  selectedParentItem: WorkItem | null
  onParentChange: (parentId: string) => void
}) {
  const matches = parentOptions.filter(
    (item) => matchesQuery(item.key, query) || matchesQuery(item.title, query)
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          onQueryChange("")
        }
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
            {selectedParentItem ? `${selectedParentItem.key}` : "Parent"}
          </span>
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={PROPERTY_POPOVER_CLASS}>
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-[14px]" />}
          placeholder="Find parent…"
          value={query}
          onChange={onQueryChange}
        />
        <PropertyPopoverList>
          {matches.length > 0 ? (
            <>
              <PropertyPopoverGroup>Available parents</PropertyPopoverGroup>
              {matches.map((parentOption) => {
                const selected = parentOption.id === selectedParentId
                return (
                  <PropertyPopoverItem
                    key={parentOption.id}
                    selected={selected}
                    onClick={() => onParentChange(parentOption.id)}
                    trailing={
                      selected ? (
                        <Check className="size-[14px] text-foreground" />
                      ) : null
                    }
                  >
                    <TreeStructure className="size-[14px] shrink-0 text-fg-3" />
                    <span className="truncate">
                      <span className="text-fg-3">{parentOption.key}</span>{" "}
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
            onClick={() => onParentChange("none")}
            trailing={
              selectedParentId === "none" ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <X className="size-[14px] shrink-0" />
            <span>No parent</span>
          </PropertyPopoverItem>
        </PropertyPopoverList>
      </PopoverContent>
    </Popover>
  )
}

function getLabelsTriggerText(selectedLabels: Label[]) {
  if (selectedLabels.length === 0) {
    return "Add label"
  }

  if (selectedLabels.length === 1) {
    return selectedLabels[0]?.name ?? "Labels"
  }

  return `${selectedLabels[0]?.name ?? "Label"} +${selectedLabels.length - 1}`
}

function getMatchedLabelGroups(input: {
  availableLabels: Label[]
  query: string
  selectedLabelIds: string[]
}) {
  const matched = input.availableLabels.filter((label) =>
    matchesQuery(label.name, input.query.trim())
  )

  return {
    matched,
    selected: matched.filter((label) =>
      input.selectedLabelIds.includes(label.id)
    ),
    unselected: matched.filter(
      (label) => !input.selectedLabelIds.includes(label.id)
    ),
  }
}

function LabelOptionItem({
  label,
  selected,
  onToggleLabel,
}: {
  label: Label
  selected?: boolean
  onToggleLabel: (labelId: string) => void
}) {
  return (
    <PropertyPopoverItem
      selected={selected}
      onClick={() => onToggleLabel(label.id)}
      trailing={
        selected ? <Check className="size-[14px] text-foreground" /> : null
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
}

function LabelOptionsGroup({
  labels,
  selected,
  title,
  onToggleLabel,
}: {
  labels: Label[]
  selected?: boolean
  title: string
  onToggleLabel: (labelId: string) => void
}) {
  if (labels.length === 0) {
    return null
  }

  return (
    <>
      <PropertyPopoverGroup>{title}</PropertyPopoverGroup>
      {labels.map((label) => (
        <LabelOptionItem
          key={label.id}
          label={label}
          selected={selected}
          onToggleLabel={onToggleLabel}
        />
      ))}
    </>
  )
}

function LabelsEmptyState({
  availableLabels,
  matchedLabels,
}: {
  availableLabels: Label[]
  matchedLabels: Label[]
}) {
  if (matchedLabels.length > 0) {
    return null
  }

  return (
    <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
      {availableLabels.length === 0 ? "No labels yet" : "No labels match"}
    </div>
  )
}

function NewLabelInput({
  creatingLabel,
  labelNameLimitState,
  newLabelName,
  team,
  onCreateLabel,
  onNewLabelNameChange,
}: {
  creatingLabel: boolean
  labelNameLimitState: TextLimitState
  newLabelName: string
  team: Team | null
  onCreateLabel: () => void
  onNewLabelNameChange: (name: string) => void
}) {
  const trimmedNewLabelName = newLabelName.trim()

  return (
    <>
      <div className="mt-1 flex items-center gap-2 border-t border-line-soft px-2.5 pt-2 pb-1 text-fg-3">
        <Plus className="size-[14px] shrink-0" />
        <input
          value={newLabelName}
          onChange={(event) => onNewLabelNameChange(event.target.value)}
          maxLength={labelNameConstraints.max}
          placeholder="Create new label"
          className="h-5 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-fg-4"
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return
            }
            event.preventDefault()
            onCreateLabel()
          }}
          disabled={!team || creatingLabel}
        />
        {trimmedNewLabelName.length > 0 ? (
          <button
            type="button"
            className="text-[11px] font-medium text-fg-2 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!team || creatingLabel || !labelNameLimitState.canSubmit}
            onClick={onCreateLabel}
          >
            Add
          </button>
        ) : null}
      </div>
      {newLabelName.length > 0 ? (
        <FieldCharacterLimit
          state={labelNameLimitState}
          limit={labelNameConstraints.max}
          className="mt-0 border-t border-line-soft px-2.5 pt-2"
        />
      ) : null}
    </>
  )
}

function LabelsPicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  team,
  availableLabels,
  selectedLabels,
  selectedLabelIds,
  newLabelName,
  onNewLabelNameChange,
  labelNameLimitState,
  creatingLabel,
  onToggleLabel,
  onClearLabels,
  onCreateLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  team: Team | null
  availableLabels: Label[]
  selectedLabels: Label[]
  selectedLabelIds: string[]
  newLabelName: string
  onNewLabelNameChange: (name: string) => void
  labelNameLimitState: TextLimitState
  creatingLabel: boolean
  onToggleLabel: (labelId: string) => void
  onClearLabels: () => void
  onCreateLabel: () => void
}) {
  const labelsTriggerText = getLabelsTriggerText(selectedLabels)
  const { matched, selected, unselected } = getMatchedLabelGroups({
    availableLabels,
    query,
    selectedLabelIds,
  })

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          onQueryChange("")
          onNewLabelNameChange("")
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
          value={query}
          onChange={onQueryChange}
          trailing={
            selectedLabelIds.length > 0 ? (
              <button
                type="button"
                className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
                onClick={onClearLabels}
              >
                Clear
              </button>
            ) : undefined
          }
        />
        <PropertyPopoverList>
          <LabelOptionsGroup
            labels={selected}
            selected
            title={`Selected · ${selected.length}`}
            onToggleLabel={onToggleLabel}
          />
          <LabelOptionsGroup
            labels={unselected}
            title="All"
            onToggleLabel={onToggleLabel}
          />
          <LabelsEmptyState
            availableLabels={availableLabels}
            matchedLabels={matched}
          />
          <NewLabelInput
            creatingLabel={creatingLabel}
            labelNameLimitState={labelNameLimitState}
            newLabelName={newLabelName}
            team={team}
            onCreateLabel={onCreateLabel}
            onNewLabelNameChange={onNewLabelNameChange}
          />
        </PropertyPopoverList>
        <PropertyPopoverFoot>
          <span>Tap to toggle · Esc to close</span>
        </PropertyPopoverFoot>
      </PopoverContent>
    </Popover>
  )
}

function CreateWorkItemPropertiesRow({
  team,
  status,
  teamStatuses,
  statusPickerOpen,
  setStatusPickerOpen,
  statusQuery,
  setStatusQuery,
  onStatusChange,
  priority,
  priorityPickerOpen,
  setPriorityPickerOpen,
  onPriorityChange,
  assigneePickerOpen,
  setAssigneePickerOpen,
  assigneeQuery,
  setAssigneeQuery,
  teamMembers,
  selectedAssignee,
  effectiveAssigneeId,
  onAssigneeChange,
  projectPickerOpen,
  setProjectPickerOpen,
  projectQuery,
  setProjectQuery,
  teamProjects,
  selectedProject,
  effectiveProjectId,
  selectedParentItem,
  onProjectChange,
  startDate,
  setStartDate,
  targetDate,
  setTargetDate,
  showParentSelect,
  parentPickerOpen,
  setParentPickerOpen,
  parentQuery,
  setParentQuery,
  parentOptions,
  selectedParentId,
  onParentChange,
  labelsPickerOpen,
  setLabelsPickerOpen,
  labelQuery,
  setLabelQuery,
  availableLabels,
  selectedLabels,
  selectedLabelIds,
  newLabelName,
  setNewLabelName,
  labelNameLimitState,
  creatingLabel,
  onToggleLabel,
  onClearLabels,
  onCreateLabel,
}: {
  team: Team | null
  status: WorkStatus
  teamStatuses: WorkStatus[]
  statusPickerOpen: boolean
  setStatusPickerOpen: Dispatch<SetStateAction<boolean>>
  statusQuery: string
  setStatusQuery: Dispatch<SetStateAction<string>>
  onStatusChange: (status: WorkStatus) => void
  priority: Priority
  priorityPickerOpen: boolean
  setPriorityPickerOpen: Dispatch<SetStateAction<boolean>>
  onPriorityChange: (priority: Priority) => void
  assigneePickerOpen: boolean
  setAssigneePickerOpen: Dispatch<SetStateAction<boolean>>
  assigneeQuery: string
  setAssigneeQuery: Dispatch<SetStateAction<string>>
  teamMembers: UserProfile[]
  selectedAssignee: UserProfile | null
  effectiveAssigneeId: string
  onAssigneeChange: (assigneeId: string) => void
  projectPickerOpen: boolean
  setProjectPickerOpen: Dispatch<SetStateAction<boolean>>
  projectQuery: string
  setProjectQuery: Dispatch<SetStateAction<string>>
  teamProjects: Project[]
  selectedProject: Project | null
  effectiveProjectId: string
  selectedParentItem: WorkItem | null
  onProjectChange: (projectId: string) => void
  startDate: string | null
  setStartDate: Dispatch<SetStateAction<string | null>>
  targetDate: string | null
  setTargetDate: Dispatch<SetStateAction<string | null>>
  showParentSelect: boolean
  parentPickerOpen: boolean
  setParentPickerOpen: Dispatch<SetStateAction<boolean>>
  parentQuery: string
  setParentQuery: Dispatch<SetStateAction<string>>
  parentOptions: WorkItem[]
  selectedParentId: string
  onParentChange: (parentId: string) => void
  labelsPickerOpen: boolean
  setLabelsPickerOpen: Dispatch<SetStateAction<boolean>>
  labelQuery: string
  setLabelQuery: Dispatch<SetStateAction<string>>
  availableLabels: Label[]
  selectedLabels: Label[]
  selectedLabelIds: string[]
  newLabelName: string
  setNewLabelName: Dispatch<SetStateAction<string>>
  labelNameLimitState: TextLimitState
  creatingLabel: boolean
  onToggleLabel: (labelId: string) => void
  onClearLabels: () => void
  onCreateLabel: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-background px-[18px] py-2.5">
      <StatusPicker
        open={statusPickerOpen}
        onOpenChange={setStatusPickerOpen}
        query={statusQuery}
        onQueryChange={setStatusQuery}
        team={team}
        status={status}
        teamStatuses={teamStatuses}
        onStatusChange={onStatusChange}
      />

      <PriorityPicker
        open={priorityPickerOpen}
        onOpenChange={setPriorityPickerOpen}
        team={team}
        priority={priority}
        onPriorityChange={onPriorityChange}
      />

      <AssigneePicker
        open={assigneePickerOpen}
        onOpenChange={setAssigneePickerOpen}
        query={assigneeQuery}
        onQueryChange={setAssigneeQuery}
        team={team}
        teamMembers={teamMembers}
        selectedAssignee={selectedAssignee}
        effectiveAssigneeId={effectiveAssigneeId}
        onAssigneeChange={onAssigneeChange}
      />

      <ProjectPicker
        open={projectPickerOpen}
        onOpenChange={setProjectPickerOpen}
        query={projectQuery}
        onQueryChange={setProjectQuery}
        team={team}
        teamProjects={teamProjects}
        selectedProject={selectedProject}
        effectiveProjectId={effectiveProjectId}
        selectedParentItem={selectedParentItem}
        onProjectChange={onProjectChange}
      />

      <DateChipPicker
        value={startDate}
        label="Start date"
        onValueChange={setStartDate}
      />
      <DateChipPicker
        value={targetDate}
        label="Target date"
        onValueChange={setTargetDate}
      />

      {showParentSelect ? (
        <ParentPicker
          open={parentPickerOpen}
          onOpenChange={setParentPickerOpen}
          query={parentQuery}
          onQueryChange={setParentQuery}
          team={team}
          parentOptions={parentOptions}
          selectedParentId={selectedParentId}
          selectedParentItem={selectedParentItem}
          onParentChange={onParentChange}
        />
      ) : null}

      <LabelsPicker
        open={labelsPickerOpen}
        onOpenChange={setLabelsPickerOpen}
        query={labelQuery}
        onQueryChange={setLabelQuery}
        team={team}
        availableLabels={availableLabels}
        selectedLabels={selectedLabels}
        selectedLabelIds={selectedLabelIds}
        newLabelName={newLabelName}
        onNewLabelNameChange={setNewLabelName}
        labelNameLimitState={labelNameLimitState}
        creatingLabel={creatingLabel}
        onToggleLabel={onToggleLabel}
        onClearLabels={onClearLabels}
        onCreateLabel={onCreateLabel}
      />
    </div>
  )
}

function CreateWorkItemWarnings({
  hasEditableTeams,
  hasAvailableItemTypes,
}: {
  hasEditableTeams: boolean
  hasAvailableItemTypes: boolean
}) {
  return (
    <>
      {!hasEditableTeams ? (
        <p className="px-[18px] pt-2 text-xs text-destructive">
          No editable team spaces support this work item type yet.
        </p>
      ) : null}

      {hasEditableTeams && !hasAvailableItemTypes ? (
        <p className="px-[18px] pt-2 text-xs text-destructive">
          This team space cannot create top-level work items in the current
          configuration.
        </p>
      ) : null}
    </>
  )
}

function CreateWorkItemFooter({
  selectedProject,
  team,
  canCreate,
  selectedTypeLabel,
  shortcutModifierLabel,
  onCancel,
  onCreate,
}: {
  selectedProject: Project | null
  team: Team | null
  canCreate: boolean
  selectedTypeLabel: string
  shortcutModifierLabel: string
  onCancel: () => void
  onCreate: () => void
}) {
  return (
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
          onClick={onCancel}
          className="text-fg-2"
        >
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
          onClick={onCreate}
          className="gap-1 bg-foreground text-background hover:bg-foreground/90"
        >
          Create {selectedTypeLabel.toLowerCase()}
          <ShortcutKeys
            keys={[shortcutModifierLabel, "Enter"]}
            variant="inline"
            className="ml-0.5 gap-0.5 text-background/65"
          />
        </Button>
      </div>
    </div>
  )
}

type CreateWorkItemDefaultValues = Partial<{
  status: WorkStatus
  priority: Priority
  assigneeId: string | null
  primaryProjectId: string | null
  parentId: string | null
  labelIds: string[]
  startDate: string | null
  dueDate: string | null
  targetDate: string | null
}>

type InitialCreateWorkItemState = {
  teamId: string
  type: WorkItemType
  status: WorkStatus
  priority: Priority
  assigneeId: string
  projectId: string
}

type WorkSurfaceCopy = ReturnType<typeof getWorkSurfaceCopy>

function hasItems(items: readonly unknown[]) {
  return items.length > 0
}

function getDefaultPriority(
  defaultValues: CreateWorkItemDefaultValues | undefined
) {
  return defaultValues?.priority ?? "none"
}

function getHasExplicitProjectDefault(
  defaultValues: CreateWorkItemDefaultValues | undefined,
  defaultProjectId: string | null | undefined
) {
  return (
    defaultValues?.primaryProjectId !== undefined ||
    defaultProjectId !== undefined
  )
}

function getInitialDates(
  defaultValues: CreateWorkItemDefaultValues | undefined
) {
  return {
    startDate: defaultValues?.startDate ?? null,
    dueDate: defaultValues?.dueDate ?? null,
    targetDate: defaultValues?.targetDate ?? null,
  }
}

function getWorkCopyForTeam(team: Team | null) {
  return getWorkSurfaceCopy(team?.settings.experience)
}

function getFilteredTeamsForInitialType(
  availableTeams: Team[],
  initialType: WorkItemType | null | undefined
) {
  return availableTeams.filter((team) => {
    if (!initialType) {
      return true
    }

    return getDefaultWorkItemTypesForTeamExperience(
      team.settings.experience
    ).includes(initialType)
  })
}

function getTeamById(teams: Team[], teamId: string) {
  return teams.find((entry) => entry.id === teamId) ?? null
}

function getInitialTeamId(
  filteredTeams: Team[],
  defaultTeamId: string | null | undefined
) {
  if (
    defaultTeamId &&
    filteredTeams.some((team) => team.id === defaultTeamId)
  ) {
    return defaultTeamId
  }

  return filteredTeams[0]?.id ?? ""
}

function getProjectsForTeamCreateScope(projects: Project[], team: Team | null) {
  if (!team) {
    return []
  }

  return projects.filter(
    (project) =>
      (project.scopeType === "team" && project.scopeId === team.id) ||
      (project.scopeType === "workspace" &&
        project.scopeId === team.workspaceId)
  )
}

function getInitialWorkItemType(
  initialType: WorkItemType | null | undefined,
  team: Team | null
) {
  const templateType = getDefaultTemplateTypeForTeamExperience(
    team?.settings.experience
  )

  if (
    initialType &&
    getDefaultWorkItemTypesForTeamExperience(
      team?.settings.experience
    ).includes(initialType)
  ) {
    return initialType
  }

  return getPreferredCreateDialogType(templateType)
}

function getInitialStatus(
  defaultValues: CreateWorkItemDefaultValues | undefined,
  statuses: WorkStatus[]
) {
  if (defaultValues?.status && statuses.includes(defaultValues.status)) {
    return defaultValues.status
  }

  if (statuses.includes("todo")) {
    return "todo"
  }

  return statuses[0] ?? "backlog"
}

function getTeamMemberIds(teamMemberships: TeamMembership[], teamId: string) {
  return new Set(
    teamMemberships
      .filter((membership) => membership.teamId === teamId)
      .map((membership) => membership.userId)
  )
}

function getInitialAssigneeId(
  defaultValues: CreateWorkItemDefaultValues | undefined,
  teamMemberships: TeamMembership[],
  teamId: string
) {
  const memberIds = getTeamMemberIds(teamMemberships, teamId)

  if (defaultValues?.assigneeId && memberIds.has(defaultValues.assigneeId)) {
    return defaultValues.assigneeId
  }

  return "none"
}

function getInitialProjectId({
  defaultValues,
  defaultProjectId,
  projects,
}: {
  defaultValues: CreateWorkItemDefaultValues | undefined
  defaultProjectId: string | null | undefined
  projects: Project[]
}) {
  if (
    defaultValues?.primaryProjectId &&
    projects.some((project) => project.id === defaultValues.primaryProjectId)
  ) {
    return defaultValues.primaryProjectId
  }

  if (
    defaultProjectId &&
    projects.some((project) => project.id === defaultProjectId)
  ) {
    return defaultProjectId
  }

  return "none"
}

function getInitialCreateWorkItemState({
  filteredTeams,
  defaultTeamId,
  initialType,
  projects,
  defaultProjectId,
  defaultValues,
  teamMemberships,
}: {
  filteredTeams: Team[]
  defaultTeamId: string | null | undefined
  initialType: WorkItemType | null | undefined
  projects: Project[]
  defaultProjectId: string | null | undefined
  defaultValues: CreateWorkItemDefaultValues | undefined
  teamMemberships: TeamMembership[]
}): InitialCreateWorkItemState {
  const teamId = getInitialTeamId(filteredTeams, defaultTeamId)
  const team = getTeamById(filteredTeams, teamId)
  const statuses = getStatusOrderForTeam(team)
  const scopedProjects = getProjectsForTeamCreateScope(projects, team)

  return {
    teamId,
    type: getInitialWorkItemType(initialType, team),
    status: getInitialStatus(defaultValues, statuses),
    priority: defaultValues?.priority ?? "none",
    assigneeId: getInitialAssigneeId(defaultValues, teamMemberships, teamId),
    projectId: getInitialProjectId({
      defaultValues,
      defaultProjectId,
      projects: scopedProjects,
    }),
  }
}

function getLabelsForTeam(labels: Label[], team: Team | null) {
  return team
    ? labels.filter((label) => label.workspaceId === team.workspaceId)
    : []
}

function getTeamMembers(
  users: UserProfile[],
  teamMemberships: TeamMembership[],
  teamId: string
) {
  const memberIds = getTeamMemberIds(teamMemberships, teamId)
  return users.filter((user) => memberIds.has(user.id))
}

function getSelectedProject(projectId: string, teamProjects: Project[]) {
  return projectId === "none"
    ? null
    : (teamProjects.find((project) => project.id === projectId) ?? null)
}

function getEffectiveAssigneeId(
  assigneeId: string,
  teamMembers: UserProfile[]
) {
  if (
    assigneeId !== "none" &&
    teamMembers.some((member) => member.id === assigneeId)
  ) {
    return assigneeId
  }

  return "none"
}

function getSelectedAssignee(
  effectiveAssigneeId: string,
  teamMembers: UserProfile[]
) {
  return effectiveAssigneeId === "none"
    ? null
    : (teamMembers.find((user) => user.id === effectiveAssigneeId) ?? null)
}

function getParentOptionsForCreate({
  workItems,
  selectedTeamId,
  selectedType,
  scopedProjectId,
  selectedParentId,
}: {
  workItems: WorkItem[]
  selectedTeamId: string
  selectedType: WorkItemType | null
  scopedProjectId: string | null
  selectedParentId: string
}) {
  if (!selectedTeamId || !selectedType) {
    return []
  }

  return [...workItems]
    .filter(
      (item) =>
        item.teamId === selectedTeamId &&
        canParentWorkItemTypeAcceptChild(item.type, selectedType)
    )
    .filter((item) => {
      if (!scopedProjectId) {
        return true
      }

      return (
        item.primaryProjectId === scopedProjectId ||
        item.id === selectedParentId
      )
    })
    .sort((left, right) =>
      left.key.localeCompare(right.key, undefined, { numeric: true })
    )
}

function getSelectedParentItem(
  selectedParentId: string,
  parentOptions: WorkItem[]
) {
  return selectedParentId === "none"
    ? null
    : (parentOptions.find((item) => item.id === selectedParentId) ?? null)
}

function getEffectiveProjectId({
  hasExplicitProjectDefault,
  projectId,
  selectedParentItem,
}: {
  hasExplicitProjectDefault: boolean
  projectId: string
  selectedParentItem: WorkItem | null
}) {
  return hasExplicitProjectDefault
    ? projectId
    : (selectedParentItem?.primaryProjectId ?? projectId)
}

function getActiveTemplateType(
  selectedProject: Project | null,
  team: Team | null
) {
  return (
    selectedProject?.templateType ??
    getDefaultTemplateTypeForTeamExperience(team?.settings.experience)
  )
}

function getSelectedWorkItemType(
  availableItemTypes: WorkItemType[],
  type: WorkItemType
) {
  return (
    availableItemTypes.find((value) => value === type) ??
    availableItemTypes[0] ??
    null
  )
}

function getSelectedLabels(
  availableLabels: Label[],
  selectedLabelIds: string[]
) {
  return availableLabels.filter((label) => selectedLabelIds.includes(label.id))
}

function getSelectedTypeLabel({
  selectedType,
  team,
  workCopy,
}: {
  selectedType: WorkItemType | null
  team: Team | null
  workCopy: WorkSurfaceCopy
}) {
  return selectedType
    ? getDisplayLabelForWorkItemType(selectedType, team?.settings.experience)
    : workCopy.singularLabel
}

function getSecondaryContextLabel(
  selectedParentItem: WorkItem | null,
  selectedProject: Project | null
) {
  return selectedParentItem
    ? `${selectedParentItem.key} · child`
    : (selectedProject?.name ?? null)
}

function getTitlePlaceholder({
  selectedType,
  selectedTypeLabel,
  workCopy,
}: {
  selectedType: WorkItemType | null
  selectedTypeLabel: string
  workCopy: WorkSurfaceCopy
}) {
  return selectedType ? `${selectedTypeLabel} title` : workCopy.titlePlaceholder
}

function requiresParentType(selectedType: WorkItemType | null) {
  return selectedType === "sub-task" || selectedType === "sub-issue"
}

function shouldShowParentSelect({
  selectedType,
  requiresParent,
  parentOptions,
  selectedParentItem,
}: {
  selectedType: WorkItemType | null
  requiresParent: boolean
  parentOptions: WorkItem[]
  selectedParentItem: WorkItem | null
}) {
  return (
    Boolean(selectedType) &&
    (requiresParent || parentOptions.length > 0 || selectedParentItem !== null)
  )
}

function canSubmitCreateWorkItem({
  filteredTeams,
  titleLimitState,
  selectedType,
  requiresParent,
  selectedParentItem,
}: {
  filteredTeams: Team[]
  titleLimitState: TextLimitState
  selectedType: WorkItemType | null
  requiresParent: boolean
  selectedParentItem: WorkItem | null
}) {
  return (
    filteredTeams.length > 0 &&
    titleLimitState.canSubmit &&
    selectedType !== null &&
    (!requiresParent || selectedParentItem !== null)
  )
}

function getTeamWorkspaceId(team: Team | null) {
  return team?.workspaceId ?? null
}

function canUseCommandSubmit(open: boolean, canCreate: boolean) {
  return open && canCreate
}

function getTeamSelectionDefaults({
  teamId,
  filteredTeams,
  projects,
  initialType,
  defaultProjectId,
  priority,
}: {
  teamId: string
  filteredTeams: Team[]
  projects: Project[]
  initialType: WorkItemType | null | undefined
  defaultProjectId: string | null | undefined
  priority: Priority
}) {
  const team = getTeamById(filteredTeams, teamId)
  const statuses = getStatusOrderForTeam(team)
  const scopedProjects = getProjectsForTeamCreateScope(projects, team)
  const nextType =
    initialType &&
    getDefaultRootWorkItemTypesForTeamExperience(
      team?.settings.experience
    ).includes(initialType)
      ? initialType
      : getPreferredCreateDialogType(
          getDefaultTemplateTypeForTeamExperience(team?.settings.experience)
        )

  return {
    type: nextType,
    status: statuses.includes("todo") ? "todo" : (statuses[0] ?? "backlog"),
    priority,
    projectId:
      defaultProjectId &&
      scopedProjects.some((project) => project.id === defaultProjectId)
        ? defaultProjectId
        : "none",
  }
}

function toggleSelectionValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((currentId) => currentId !== value)
    : [...current, value]
}

function applyTeamSelection({
  nextTeamId,
  filteredTeams,
  projects,
  initialType,
  defaultProjectId,
  defaultPriority,
  setSelectedTeamId,
  setType,
  setStatus,
  setPriority,
  setAssigneeId,
  setStartDate,
  setDueDate,
  setTargetDate,
  setProjectId,
  setSelectedParentId,
  setSelectedLabelIds,
  setNewLabelName,
  setCreatingLabel,
}: {
  nextTeamId: string
  filteredTeams: Team[]
  projects: Project[]
  initialType: WorkItemType | null | undefined
  defaultProjectId: string | null | undefined
  defaultPriority: Priority
  setSelectedTeamId: Dispatch<SetStateAction<string>>
  setType: Dispatch<SetStateAction<WorkItemType>>
  setStatus: Dispatch<SetStateAction<WorkStatus>>
  setPriority: Dispatch<SetStateAction<Priority>>
  setAssigneeId: Dispatch<SetStateAction<string>>
  setStartDate: Dispatch<SetStateAction<string | null>>
  setDueDate: Dispatch<SetStateAction<string | null>>
  setTargetDate: Dispatch<SetStateAction<string | null>>
  setProjectId: Dispatch<SetStateAction<string>>
  setSelectedParentId: Dispatch<SetStateAction<string>>
  setSelectedLabelIds: Dispatch<SetStateAction<string[]>>
  setNewLabelName: Dispatch<SetStateAction<string>>
  setCreatingLabel: Dispatch<SetStateAction<boolean>>
}) {
  const nextDefaults = getTeamSelectionDefaults({
    teamId: nextTeamId,
    filteredTeams,
    projects,
    initialType,
    defaultProjectId,
    priority: defaultPriority,
  })

  setSelectedTeamId(nextTeamId)
  setType(nextDefaults.type)
  setStatus(nextDefaults.status)
  setPriority(nextDefaults.priority)
  setAssigneeId("none")
  setStartDate(null)
  setDueDate(null)
  setTargetDate(null)
  setProjectId(nextDefaults.projectId)
  setSelectedParentId("none")
  setSelectedLabelIds([])
  setNewLabelName("")
  setCreatingLabel(false)
}

function applySelectedType({
  nextType,
  selectedParentItem,
  setType,
  setSelectedParentId,
  setTypePickerOpen,
}: {
  nextType: WorkItemType
  selectedParentItem: WorkItem | null
  setType: Dispatch<SetStateAction<WorkItemType>>
  setSelectedParentId: Dispatch<SetStateAction<string>>
  setTypePickerOpen: Dispatch<SetStateAction<boolean>>
}) {
  const nextParentStillValid =
    selectedParentItem &&
    canParentWorkItemTypeAcceptChild(selectedParentItem.type, nextType)

  setType(nextType)
  if (!nextParentStillValid) {
    setSelectedParentId("none")
  }
  setTypePickerOpen(false)
}

function applyProjectChange({
  nextProjectId,
  selectedParentItem,
  setProjectId,
  setSelectedParentId,
  setProjectPickerOpen,
}: {
  nextProjectId: string
  selectedParentItem: WorkItem | null
  setProjectId: Dispatch<SetStateAction<string>>
  setSelectedParentId: Dispatch<SetStateAction<string>>
  setProjectPickerOpen: Dispatch<SetStateAction<boolean>>
}) {
  setProjectId(nextProjectId)
  if (
    nextProjectId !== "none" &&
    selectedParentItem &&
    selectedParentItem.primaryProjectId !== nextProjectId
  ) {
    setSelectedParentId("none")
  }
  setProjectPickerOpen(false)
}

function applyParentChange({
  nextParentId,
  parentOptions,
  setSelectedParentId,
  setProjectId,
  setParentPickerOpen,
}: {
  nextParentId: string
  parentOptions: WorkItem[]
  setSelectedParentId: Dispatch<SetStateAction<string>>
  setProjectId: Dispatch<SetStateAction<string>>
  setParentPickerOpen: Dispatch<SetStateAction<boolean>>
}) {
  const parentOption =
    parentOptions.find((item) => item.id === nextParentId) ?? null

  setSelectedParentId(nextParentId)
  if (parentOption?.primaryProjectId) {
    setProjectId(parentOption.primaryProjectId)
  }
  setParentPickerOpen(false)
}

async function createLabelAndSelect({
  newLabelName,
  creatingLabel,
  canSubmit,
  workspaceId,
  setCreatingLabel,
  setNewLabelName,
  setSelectedLabelIds,
}: {
  newLabelName: string
  creatingLabel: boolean
  canSubmit: boolean
  workspaceId: string | null
  setCreatingLabel: Dispatch<SetStateAction<boolean>>
  setNewLabelName: Dispatch<SetStateAction<string>>
  setSelectedLabelIds: Dispatch<SetStateAction<string[]>>
}) {
  const normalizedName = newLabelName.trim()

  if (!normalizedName || creatingLabel || !canSubmit) {
    return
  }

  setCreatingLabel(true)
  const created = await useAppStore
    .getState()
    .createLabel(normalizedName, workspaceId)
  setCreatingLabel(false)

  if (!created) {
    return
  }

  setNewLabelName("")
  setSelectedLabelIds((current) =>
    current.includes(created.id) ? current : [...current, created.id]
  )
}

function createWorkItemFromDialogState({
  selectedType,
  selectedTeamId,
  canCreate,
  normalizedTitle,
  selectedParentItem,
  priority,
  status,
  selectedLabelIds,
  effectiveAssigneeId,
  effectiveProjectId,
  startDate,
  dueDate,
  targetDate,
  normalizedDescription,
  onOpenChange,
}: {
  selectedType: WorkItemType | null
  selectedTeamId: string
  canCreate: boolean
  normalizedTitle: string
  selectedParentItem: WorkItem | null
  priority: Priority
  status: WorkStatus
  selectedLabelIds: string[]
  effectiveAssigneeId: string
  effectiveProjectId: string
  startDate: string | null
  dueDate: string | null
  targetDate: string | null
  normalizedDescription: string
  onOpenChange: (open: boolean) => void
}) {
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
    assigneeId: effectiveAssigneeId === "none" ? null : effectiveAssigneeId,
    primaryProjectId: effectiveProjectId === "none" ? null : effectiveProjectId,
    startDate,
    dueDate,
    targetDate,
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

export function CreateWorkItemDialog({
  open,
  onOpenChange,
  defaultTeamId,
  defaultProjectId,
  initialType,
  defaultValues,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTeamId?: string | null
  defaultProjectId?: string | null
  initialType?: WorkItemType | null
  defaultValues?: CreateWorkItemDefaultValues
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
    () => getFilteredTeamsForInitialType(availableTeams, initialType),
    [availableTeams, initialType]
  )
  const initialState = useMemo(
    () =>
      getInitialCreateWorkItemState({
        filteredTeams,
        defaultTeamId,
        initialType,
        projects,
        defaultProjectId,
        defaultValues,
        teamMemberships,
      }),
    [
      defaultProjectId,
      defaultTeamId,
      defaultValues,
      filteredTeams,
      initialType,
      projects,
      teamMemberships,
    ]
  )
  const hasExplicitProjectDefault = getHasExplicitProjectDefault(
    defaultValues,
    defaultProjectId
  )
  const initialDates = getInitialDates(defaultValues)
  const defaultPriority = getDefaultPriority(defaultValues)
  const [selectedTeamId, setSelectedTeamId] = useState(initialState.teamId)
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
  const shortcutModifierLabel = useShortcutModifierLabel()
  const team = useMemo(
    () => getTeamById(filteredTeams, selectedTeamId),
    [filteredTeams, selectedTeamId]
  )
  const labels = useMemo(
    () => getLabelsForTeam(allLabels, team),
    [allLabels, team]
  )
  const teamMembers = useMemo(
    () => getTeamMembers(users, teamMemberships, selectedTeamId),
    [selectedTeamId, teamMemberships, users]
  )
  const teamProjects = useMemo(
    () => getProjectsForTeamCreateScope(projects, team),
    [projects, team]
  )
  const availableLabels = useMemo(
    () =>
      [...labels].sort((left, right) => left.name.localeCompare(right.name)),
    [labels]
  )
  const [type, setType] = useState<WorkItemType>(initialState.type)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<WorkStatus>(initialState.status)
  const [priority, setPriority] = useState<Priority>(initialState.priority)
  const [assigneeId, setAssigneeId] = useState<string>(initialState.assigneeId)
  const [startDate, setStartDate] = useState<string | null>(
    initialDates.startDate
  )
  const [dueDate, setDueDate] = useState<string | null>(initialDates.dueDate)
  const [targetDate, setTargetDate] = useState<string | null>(
    initialDates.targetDate
  )
  const [projectId, setProjectId] = useState<string>(initialState.projectId)
  const [selectedParentId, setSelectedParentId] = useState<string>(
    defaultValues?.parentId ?? "none"
  )
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(
    defaultValues?.labelIds ?? []
  )
  const [newLabelName, setNewLabelName] = useState("")
  const [creatingLabel, setCreatingLabel] = useState(false)
  const selectedProject = getSelectedProject(projectId, teamProjects)
  const effectiveAssigneeId = getEffectiveAssigneeId(assigneeId, teamMembers)
  const selectedAssignee = getSelectedAssignee(effectiveAssigneeId, teamMembers)
  const workCopy = getWorkCopyForTeam(team)
  const teamStatuses = getStatusOrderForTeam(team)
  const activeTemplateType = getActiveTemplateType(selectedProject, team)
  const availableItemTypes =
    getAllowedWorkItemTypesForTemplate(activeTemplateType)
  const selectedType = getSelectedWorkItemType(availableItemTypes, type)
  const scopedProjectId = projectId === "none" ? null : projectId
  const parentOptions = getParentOptionsForCreate({
    workItems,
    selectedTeamId,
    selectedType,
    scopedProjectId,
    selectedParentId,
  })
  const selectedParentItem = getSelectedParentItem(
    selectedParentId,
    parentOptions
  )
  const effectiveProjectId = getEffectiveProjectId({
    hasExplicitProjectDefault,
    projectId,
    selectedParentItem,
  })
  const selectedLabels = getSelectedLabels(availableLabels, selectedLabelIds)
  const selectedTypeLabel = getSelectedTypeLabel({
    selectedType,
    team,
    workCopy,
  })
  const secondaryContextLabel = getSecondaryContextLabel(
    selectedParentItem,
    selectedProject
  )
  const titlePlaceholder = getTitlePlaceholder({
    selectedType,
    selectedTypeLabel,
    workCopy,
  })
  const titleLimitState = getTextInputLimitState(
    title,
    workItemTitleConstraints
  )
  const normalizedTitle = title.trim()
  const normalizedDescription = description.trim()
  const labelNameLimitState = getTextInputLimitState(
    newLabelName,
    labelNameConstraints
  )
  const requiresParent = requiresParentType(selectedType)
  const showParentSelect = shouldShowParentSelect({
    selectedType,
    requiresParent,
    parentOptions,
    selectedParentItem,
  })
  const canCreate = canSubmitCreateWorkItem({
    filteredTeams,
    titleLimitState,
    selectedType,
    requiresParent,
    selectedParentItem,
  })
  const teamDotColor = getTeamDotColor(team?.id ?? null)
  const hasEditableTeams = hasItems(filteredTeams)
  const hasAvailableItemTypes = hasItems(availableItemTypes)

  function toggleLabel(labelId: string) {
    setSelectedLabelIds((current) => toggleSelectionValue(current, labelId))
  }

  async function handleCreateLabel() {
    await createLabelAndSelect({
      newLabelName,
      creatingLabel,
      canSubmit: labelNameLimitState.canSubmit,
      workspaceId: getTeamWorkspaceId(team),
      setCreatingLabel,
      setNewLabelName,
      setSelectedLabelIds,
    })
  }

  function handleCreate() {
    createWorkItemFromDialogState({
      selectedType,
      selectedTeamId,
      canCreate,
      normalizedTitle,
      selectedParentItem,
      priority,
      status,
      selectedLabelIds,
      effectiveAssigneeId,
      effectiveProjectId,
      startDate,
      dueDate,
      targetDate,
      normalizedDescription,
      onOpenChange,
    })
  }

  function handleSelectTeam(nextTeamId: string) {
    applyTeamSelection({
      nextTeamId,
      filteredTeams,
      projects,
      initialType,
      defaultProjectId,
      defaultPriority,
      setSelectedTeamId,
      setType,
      setStatus,
      setPriority,
      setAssigneeId,
      setStartDate,
      setDueDate,
      setTargetDate,
      setProjectId,
      setSelectedParentId,
      setSelectedLabelIds,
      setNewLabelName,
      setCreatingLabel,
    })
    setTeamPickerOpen(false)
    setTeamQuery("")
  }

  function handleSelectType(nextType: WorkItemType) {
    applySelectedType({
      nextType,
      selectedParentItem,
      setType,
      setSelectedParentId,
      setTypePickerOpen,
    })
  }

  function handleStatusChange(nextStatus: WorkStatus) {
    setStatus(nextStatus)
    setStatusPickerOpen(false)
  }

  function handlePriorityChange(nextPriority: Priority) {
    setPriority(nextPriority)
    setPriorityPickerOpen(false)
  }

  function handleAssigneeChange(nextAssigneeId: string) {
    setAssigneeId(nextAssigneeId)
    setAssigneePickerOpen(false)
  }

  function handleProjectChange(nextProjectId: string) {
    applyProjectChange({
      nextProjectId,
      selectedParentItem,
      setProjectId,
      setSelectedParentId,
      setProjectPickerOpen,
    })
  }

  function handleParentChange(nextParentId: string) {
    applyParentChange({
      nextParentId,
      parentOptions,
      setSelectedParentId,
      setProjectId,
      setParentPickerOpen,
    })
  }

  useCommandEnterSubmit(canUseCommandSubmit(open, canCreate), handleCreate)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-6 max-h-[calc(100vh-3rem)] translate-y-0 gap-0 overflow-hidden rounded-xl border border-line bg-surface p-0 shadow-lg sm:top-10 sm:max-w-[640px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{workCopy.createLabel}</DialogTitle>
          <DialogDescription>
            Create a new work item and seed its initial description.
          </DialogDescription>
        </DialogHeader>

        <CreateWorkItemCrumbRow
          filteredTeams={filteredTeams}
          selectedTeamId={selectedTeamId}
          team={team}
          teamDotColor={teamDotColor}
          teamPickerOpen={teamPickerOpen}
          onTeamPickerOpenChange={setTeamPickerOpen}
          teamQuery={teamQuery}
          onTeamQueryChange={setTeamQuery}
          onSelectTeam={handleSelectTeam}
          typePickerOpen={typePickerOpen}
          onTypePickerOpenChange={setTypePickerOpen}
          availableItemTypes={availableItemTypes}
          selectedType={selectedType}
          selectedTypeLabel={selectedTypeLabel}
          onSelectType={handleSelectType}
          secondaryContextLabel={secondaryContextLabel}
        />

        <CreateWorkItemTitleFields
          title={title}
          onTitleChange={setTitle}
          titlePlaceholder={titlePlaceholder}
          titleLimitState={titleLimitState}
          description={description}
          onDescriptionChange={setDescription}
        />

        <CreateWorkItemPropertiesRow
          team={team}
          status={status}
          teamStatuses={teamStatuses}
          statusPickerOpen={statusPickerOpen}
          setStatusPickerOpen={setStatusPickerOpen}
          statusQuery={statusQuery}
          setStatusQuery={setStatusQuery}
          onStatusChange={handleStatusChange}
          priority={priority}
          priorityPickerOpen={priorityPickerOpen}
          setPriorityPickerOpen={setPriorityPickerOpen}
          onPriorityChange={handlePriorityChange}
          assigneePickerOpen={assigneePickerOpen}
          setAssigneePickerOpen={setAssigneePickerOpen}
          assigneeQuery={assigneeQuery}
          setAssigneeQuery={setAssigneeQuery}
          teamMembers={teamMembers}
          selectedAssignee={selectedAssignee}
          effectiveAssigneeId={effectiveAssigneeId}
          onAssigneeChange={handleAssigneeChange}
          projectPickerOpen={projectPickerOpen}
          setProjectPickerOpen={setProjectPickerOpen}
          projectQuery={projectQuery}
          setProjectQuery={setProjectQuery}
          teamProjects={teamProjects}
          selectedProject={selectedProject}
          effectiveProjectId={effectiveProjectId}
          selectedParentItem={selectedParentItem}
          onProjectChange={handleProjectChange}
          startDate={startDate}
          setStartDate={setStartDate}
          targetDate={targetDate}
          setTargetDate={setTargetDate}
          showParentSelect={showParentSelect}
          parentPickerOpen={parentPickerOpen}
          setParentPickerOpen={setParentPickerOpen}
          parentQuery={parentQuery}
          setParentQuery={setParentQuery}
          parentOptions={parentOptions}
          selectedParentId={selectedParentId}
          onParentChange={handleParentChange}
          labelsPickerOpen={labelsPickerOpen}
          setLabelsPickerOpen={setLabelsPickerOpen}
          labelQuery={labelQuery}
          setLabelQuery={setLabelQuery}
          availableLabels={availableLabels}
          selectedLabels={selectedLabels}
          selectedLabelIds={selectedLabelIds}
          newLabelName={newLabelName}
          setNewLabelName={setNewLabelName}
          labelNameLimitState={labelNameLimitState}
          creatingLabel={creatingLabel}
          onToggleLabel={toggleLabel}
          onClearLabels={() => setSelectedLabelIds([])}
          onCreateLabel={() => {
            void handleCreateLabel()
          }}
        />

        <CreateWorkItemWarnings
          hasEditableTeams={hasEditableTeams}
          hasAvailableItemTypes={hasAvailableItemTypes}
        />

        <CreateWorkItemFooter
          selectedProject={selectedProject}
          team={team}
          canCreate={canCreate}
          selectedTypeLabel={selectedTypeLabel}
          shortcutModifierLabel={shortcutModifierLabel}
          onCancel={() => onOpenChange(false)}
          onCreate={handleCreate}
        />
      </DialogContent>
    </Dialog>
  )
}
