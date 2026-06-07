"use client"

import type { ReactNode } from "react"
import {
  CalendarDots,
  CaretDown,
  Check,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react"

import { formatDateInputLabel } from "@/lib/date-input"
import { getDisplayInitials } from "@/lib/display-initials"
import { formatTimeZoneLabel } from "@/lib/time-zone"
import {
  getDisplayLabelForWorkItemType,
  priorityMeta,
  statusMeta,
  type Priority,
  type Team,
  type WorkItemType,
  type WorkStatus,
} from "@/lib/domain/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { PriorityDot, PriorityIcon, StatusIcon } from "./shared"
import { cn, resolveImageAssetSource } from "@/lib/utils"

export const propertyChipTriggerClass =
  "inline-flex h-7 w-fit max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

export const propertyChipTriggerDashedClass =
  "border-dashed bg-transparent text-fg-3 hover:bg-surface-3 hover:text-foreground"

export const propertyCrumbTriggerClass =
  "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-0 text-[12.5px] font-normal text-fg-2 shadow-none transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 data-[size=default]:h-7 [&>svg:last-child]:opacity-60 [&>svg:last-child]:size-3"

const openWorkStatuses: WorkStatus[] = [
  "on-hold",
  "backlog",
  "todo",
  "in-progress",
]
const closedWorkStatuses: WorkStatus[] = ["done", "cancelled", "duplicate"]
const workItemPriorityOrder: Priority[] = [
  "none",
  "urgent",
  "high",
  "medium",
  "low",
]

type PropertyAssignee = {
  id: string
  name: string
  avatarUrl?: string | null
  avatarImageUrl?: string | null
}

type WorkItemPropertyTeam = Pick<Team, "settings">

export function matchesPropertyQuery(value: string, query: string) {
  if (!query) {
    return true
  }
  return value.toLowerCase().includes(query.toLowerCase())
}

export function PropertySelectionPopover({
  children,
  onOpenChange,
  onQueryChange,
  open,
  trigger,
}: {
  children: ReactNode
  onOpenChange: (open: boolean) => void
  onQueryChange: (query: string) => void
  open: boolean
  trigger: ReactNode
}) {
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
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {children}
    </Popover>
  )
}

function SelectedPropertyTrailing({ selected }: { selected: boolean }) {
  return selected ? <Check className="size-[14px] text-foreground" /> : null
}

function getStatusPickerMatches(
  teamStatuses: WorkStatus[],
  statusQuery: string
) {
  return {
    activeMatches: teamStatuses.filter(
      (value) =>
        openWorkStatuses.includes(value) &&
        matchesPropertyQuery(statusMeta[value].label, statusQuery)
    ),
    closedMatches: teamStatuses.filter(
      (value) =>
        closedWorkStatuses.includes(value) &&
        matchesPropertyQuery(statusMeta[value].label, statusQuery)
    ),
  }
}

function WorkItemStatusOptionGroup({
  label,
  onSelect,
  selectedStatus,
  statuses,
}: {
  label: string
  onSelect: (status: WorkStatus) => void
  selectedStatus: WorkStatus
  statuses: WorkStatus[]
}) {
  if (statuses.length === 0) {
    return null
  }

  return (
    <>
      <PropertyPopoverGroup>{label}</PropertyPopoverGroup>
      {statuses.map((value) => {
        const selected = value === selectedStatus
        return (
          <PropertyPopoverItem
            key={value}
            selected={selected}
            onClick={() => onSelect(value)}
            trailing={<SelectedPropertyTrailing selected={selected} />}
          >
            <StatusIcon status={value} />
            <span>{statusMeta[value].label}</span>
          </PropertyPopoverItem>
        )
      })}
    </>
  )
}

export function WorkItemTypePropertyPicker({
  availableItemTypes,
  collapseSingleOption = false,
  hideWhenEmpty = false,
  open,
  selectedType,
  selectedTypeLabel,
  team,
  onOpenChange,
  onSelect,
}: {
  availableItemTypes: WorkItemType[]
  collapseSingleOption?: boolean
  hideWhenEmpty?: boolean
  open: boolean
  selectedType: WorkItemType | null
  selectedTypeLabel: string
  team: WorkItemPropertyTeam | null
  onOpenChange: (open: boolean) => void
  onSelect: (value: WorkItemType) => void
}) {
  if (hideWhenEmpty && availableItemTypes.length === 0) {
    return null
  }

  if (collapseSingleOption && availableItemTypes.length === 1) {
    return (
      <div
        className={cn(
          propertyCrumbTriggerClass,
          "cursor-default hover:bg-transparent"
        )}
      >
        <span className="font-medium text-foreground">{selectedTypeLabel}</span>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={propertyCrumbTriggerClass}
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
                onClick={() => onSelect(value)}
                trailing={<SelectedPropertyTrailing selected={selected} />}
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

export function WorkItemStatusPropertyPicker({
  open,
  onOpenChange,
  query,
  onQueryChange,
  team,
  status,
  teamStatuses,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  team: WorkItemPropertyTeam | null
  status: WorkStatus
  teamStatuses: WorkStatus[]
  onSelect: (status: WorkStatus) => void
}) {
  const { activeMatches, closedMatches } = getStatusPickerMatches(
    teamStatuses,
    query
  )
  const hasMatches = activeMatches.length > 0 || closedMatches.length > 0

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
          className={propertyChipTriggerClass}
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
          value={query}
          onChange={onQueryChange}
        />
        <PropertyPopoverList>
          <WorkItemStatusOptionGroup
            label="Active"
            selectedStatus={status}
            statuses={activeMatches}
            onSelect={onSelect}
          />
          <WorkItemStatusOptionGroup
            label="Closed"
            selectedStatus={status}
            statuses={closedMatches}
            onSelect={onSelect}
          />
          {!hasMatches ? (
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

export function WorkItemPriorityPropertyPicker({
  open,
  priority,
  team,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  priority: Priority
  team: WorkItemPropertyTeam | null
  onOpenChange: (open: boolean) => void
  onSelect: (value: Priority) => void
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={propertyChipTriggerClass}
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
          {workItemPriorityOrder.map((value) => {
            const selected = value === priority
            return (
              <PropertyPopoverItem
                key={value}
                selected={selected}
                onClick={() => onSelect(value)}
                trailing={<SelectedPropertyTrailing selected={selected} />}
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

function AssigneesOption<TUser extends PropertyAssignee>({
  assignees,
}: {
  assignees: TUser[]
}) {
  if (assignees.length === 0) {
    return (
      <span className="flex items-center gap-1.5 text-fg-3">
        <span className="inline-grid size-[18px] place-items-center rounded-full border border-dashed border-line text-[9px] text-fg-3">
          ?
        </span>
        Unassigned
      </span>
    )
  }

  if (assignees.length === 1 && assignees[0]) {
    return (
      <AssigneeOption
        name={assignees[0].name}
        avatarImageUrl={assignees[0].avatarImageUrl}
        avatarUrl={assignees[0].avatarUrl}
      />
    )
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex -space-x-1">
        {assignees.slice(0, 3).map((assignee) => {
          const imageSrc = resolveImageAssetSource(
            assignee.avatarImageUrl,
            assignee.avatarUrl
          )

          return (
            <Avatar
              key={assignee.id}
              size="sm"
              className="size-4 border border-surface data-[size=sm]:size-4"
            >
              {imageSrc ? (
                <AvatarImage src={imageSrc} alt={assignee.name} />
              ) : null}
              <AvatarFallback>
                {getDisplayInitials(assignee.name, "?")}
              </AvatarFallback>
            </Avatar>
          )
        })}
      </span>
      <span className="min-w-0 truncate">{assignees.length} assignees</span>
    </span>
  )
}

export function PropertyAssigneePicker<TUser extends PropertyAssignee>({
  open,
  onOpenChange,
  query,
  onQueryChange,
  members,
  selectedAssignee,
  selectedAssigneeId,
  selectedAssignees,
  selectedAssigneeIds,
  selectionMode = "single",
  disabled,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  members: TUser[]
  selectedAssignee?: TUser | null
  selectedAssigneeId?: string
  selectedAssignees?: TUser[]
  selectedAssigneeIds?: string[]
  selectionMode?: "single" | "multiple"
  disabled: boolean
  onSelect: (assigneeId: string) => void
}) {
  const matches = members.filter((user) =>
    matchesPropertyQuery(user.name, query)
  )
  const resolvedSelectedAssignees =
    selectionMode === "multiple"
      ? (selectedAssignees ?? [])
      : selectedAssignee
        ? [selectedAssignee]
        : []
  const selectedIdSet = new Set(
    selectionMode === "multiple"
      ? (selectedAssigneeIds ?? [])
      : selectedAssigneeId && selectedAssigneeId !== "none"
        ? [selectedAssigneeId]
        : []
  )
  const isUnassigned = selectedIdSet.size === 0

  return (
    <PropertySelectionPopover
      open={open}
      onOpenChange={onOpenChange}
      onQueryChange={onQueryChange}
      trigger={
        <button
          type="button"
          className={cn(
            propertyChipTriggerClass,
            isUnassigned && propertyChipTriggerDashedClass
          )}
          disabled={disabled}
        >
          <AssigneesOption assignees={resolvedSelectedAssignees} />
          <CaretDown className="size-3 shrink-0 opacity-60" />
        </button>
      }
    >
      <PopoverContent
        align="start"
        className={cn(PROPERTY_POPOVER_CLASS, "w-[300px]")}
      >
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-[14px]" />}
          placeholder="Assign someone..."
          value={query}
          onChange={onQueryChange}
        />
        <PropertyPopoverList>
          {matches.length > 0 ? (
            <>
              <PropertyPopoverGroup>Members</PropertyPopoverGroup>
              {matches.map((user) => {
                const selected = selectedIdSet.has(user.id)
                return (
                  <PropertyPopoverItem
                    key={user.id}
                    selected={selected}
                    onClick={() => onSelect(user.id)}
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
            selected={isUnassigned}
            onClick={() => onSelect("none")}
            trailing={
              isUnassigned ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <X className="size-[14px] shrink-0" />
            <span>
              {selectionMode === "multiple" ? "Clear assignees" : "Unassign"}
            </span>
          </PropertyPopoverItem>
        </PropertyPopoverList>
      </PopoverContent>
    </PropertySelectionPopover>
  )
}

export function PropertyDateChip({
  value,
  label,
  timeValue,
  timeZoneValue,
  timeZoneOptions,
  onTimeValueChange,
  onTimeZoneValueChange,
  onValueChange,
}: {
  value: string | null
  label: string
  timeValue?: string | null
  timeZoneValue?: string | null
  timeZoneOptions?: string[]
  onTimeValueChange?: (value: string | null) => void
  onTimeZoneValueChange?: (value: string) => void
  onValueChange: (value: string | null) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            propertyChipTriggerClass,
            !value && propertyChipTriggerDashedClass
          )}
        >
          <CalendarDots className="size-[13px]" />
          <span
            className={cn("truncate", value && "font-medium text-foreground")}
          >
            {formatDateInputLabel(value, label)}
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
          {onTimeValueChange ? (
            <input
              type="time"
              value={timeValue ?? ""}
              onChange={(event) =>
                onTimeValueChange(event.target.value || null)
              }
              className="mt-2 h-8 w-full rounded-md border border-line bg-background px-2 text-[12.5px] outline-none"
            />
          ) : null}
          {timeZoneValue && timeZoneOptions && onTimeZoneValueChange ? (
            <select
              value={timeZoneValue}
              onChange={(event) => onTimeZoneValueChange(event.target.value)}
              className="mt-2 h-8 w-full rounded-md border border-line bg-background px-3 pr-8 text-[12px] text-foreground outline-none"
              aria-label={`${label} time zone`}
            >
              {timeZoneOptions.map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {formatTimeZoneLabel(timeZone)}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <PropertyPopoverFoot>
          <button
            type="button"
            className="text-[11px] text-fg-3 transition-colors hover:text-foreground"
            onClick={() => {
              onValueChange(null)
              onTimeValueChange?.(null)
            }}
          >
            Clear
          </button>
        </PropertyPopoverFoot>
      </PopoverContent>
    </Popover>
  )
}
