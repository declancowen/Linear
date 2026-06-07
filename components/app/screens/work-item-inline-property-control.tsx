"use client"

import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
} from "react"
import {
  Check,
  FolderSimple,
  MagnifyingGlass,
  User,
} from "@phosphor-icons/react"

import { ProjectIconGlyph } from "@/components/app/entity-icons"
import { useWorkItemSurfacePortalContainer } from "@/components/app/screens/work-item-surface-portal-context"
import { WorkItemAssigneeAvatar } from "@/components/app/screens/work-item-ui"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  PROPERTY_POPOVER_CLASS,
  PropertyPopoverGroup,
  PropertyPopoverItem,
  PropertyPopoverList,
  PropertyPopoverSearch,
} from "@/components/ui/template-primitives"
import {
  canEditTeam,
  getStatusOrderForTeam,
  getTeam,
  getTeamMembers,
  getUser,
  hasWorkspaceAccess,
} from "@/lib/domain/selectors"
import {
  getCustomPropertyIdFromDisplayReference,
  priorityMeta,
  statusMeta,
  type AppData,
  type CustomPropertyDisplayReference,
  type Priority,
  type UserProfile,
  type WorkItem,
  type WorkStatus,
} from "@/lib/domain/types"
import {
  getWorkItemAssigneeIds,
  toggleWorkItemAssigneeId,
} from "@/lib/domain/work-item-assignees"
import { isCustomPropertyDefinitionForWorkItem } from "@/lib/domain/labels"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"

import { getTeamProjectOptions } from "./helpers"
import { CustomPropertyValueControl } from "./custom-property-controls"
import { matchesPropertyQuery } from "./property-chips"
import { useWorkItemProjectCascadeConfirmation } from "./use-work-item-project-cascade-confirmation"
import {
  buildPropertyStatusOptions,
  PriorityIcon,
  PROPERTY_SELECT_SEPARATOR_VALUE,
  StatusIcon,
} from "./shared"

const OPEN_STATUSES: WorkStatus[] = ["on-hold", "backlog", "todo", "in-progress"]
const CLOSED_STATUSES: WorkStatus[] = ["done", "cancelled", "duplicate"]
const PRIORITY_ORDER: Priority[] = ["none", "urgent", "high", "medium", "low"]

type InlineEditableProperty =
  | "status"
  | "priority"
  | "assignee"
  | "project"
  | CustomPropertyDisplayReference
type InlinePropertyControlVariant = "surface" | "child"
type StatusOption = ReturnType<typeof buildPropertyStatusOptions>[number]

function stopInteractivePropagation(event: SyntheticEvent) {
  event.stopPropagation()
}

function matchesQuery(value: string, query: string) {
  return matchesPropertyQuery(value, query)
}

function InlineStatusOptionGroup({
  options,
  selectedStatus,
  title,
  onSelect,
}: {
  options: StatusOption[]
  selectedStatus: WorkStatus
  title: string
  onSelect: (status: WorkStatus) => void
}) {
  if (options.length === 0) {
    return null
  }

  return (
    <>
      <PropertyPopoverGroup>{title}</PropertyPopoverGroup>
      {options.map((option) => {
        const status = option.value as WorkStatus
        const selected = status === selectedStatus

        return (
          <PropertyPopoverItem
            key={option.value}
            selected={selected}
            onClick={() => onSelect(status)}
            trailing={
              selected ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <StatusIcon status={status} />
            <span>{option.label}</span>
          </PropertyPopoverItem>
        )
      })}
    </>
  )
}

function getTriggerClassName(
  variant: InlinePropertyControlVariant,
  empty = false
) {
  return cn(
    "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0 text-[11px] text-fg-2 transition-colors",
    variant === "surface" ? "h-5 bg-surface" : "h-6 bg-background",
    empty
      ? "border-dashed text-fg-3 hover:bg-surface-3 hover:text-foreground"
      : "border-line hover:bg-surface-3 hover:text-foreground"
  )
}

function getAssigneeTriggerClassName(
  variant: InlinePropertyControlVariant,
  empty: boolean
) {
  if (empty) {
    return getTriggerClassName(variant, true)
  }

  return cn(
    "inline-flex max-w-full items-center justify-center rounded-full px-0 py-0 text-[11px] text-fg-2 transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
    variant === "surface" ? "h-5" : "h-6"
  )
}

function getAssigneeTriggerLabel(currentAssignees: UserProfile[]) {
  if (currentAssignees.length === 0) {
    return "Assignee"
  }

  return `Assignees: ${currentAssignees
    .map((assignee) => assignee.name)
    .join(", ")}`
}

const TriggerButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function TriggerButton(
  { children, className, onClick, onPointerDown, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      data-no-drag="true"
      className={className}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        stopInteractivePropagation(event)
      }}
      onClick={(event) => {
        onClick?.(event)
        stopInteractivePropagation(event)
      }}
      {...props}
    >
      {children}
    </button>
  )
})

function StaticChip({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel?: string
  children: ReactNode
  className?: string
}) {
  return (
    <span aria-label={ariaLabel} data-no-drag="true" className={className}>
      {children}
    </span>
  )
}

function createResettingOpenChange(
  setOpen: (open: boolean) => void,
  reset: () => void
) {
  return (next: boolean) => {
    setOpen(next)
    if (!next) {
      reset()
    }
  }
}

function InlinePropertyPopover({
  afterContent,
  children,
  contentClassName = PROPERTY_POPOVER_CLASS,
  onOpenChange,
  open,
  triggerAriaLabel,
  triggerClassName,
  triggerContents,
}: {
  afterContent?: ReactNode
  children: ReactNode
  contentClassName?: string
  onOpenChange: (open: boolean) => void
  open: boolean
  triggerAriaLabel?: string
  triggerClassName: string
  triggerContents: ReactNode
}) {
  const portalContainer = useWorkItemSurfacePortalContainer()

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <TriggerButton
          aria-label={triggerAriaLabel}
          className={triggerClassName}
        >
          {triggerContents}
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        portalContainer={portalContainer}
        className={contentClassName}
        data-no-drag="true"
        onPointerDown={stopInteractivePropagation}
      >
        {children}
      </PopoverContent>
      {afterContent}
    </Popover>
  )
}

function InlineStatusPropertyControl({
  editable,
  item,
  statusOptions,
  variant,
}: {
  editable: boolean
  item: WorkItem
  statusOptions: ReturnType<typeof buildPropertyStatusOptions>
  variant: InlinePropertyControlVariant
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const triggerClassName = getTriggerClassName(variant)
  const triggerContents = (
    <>
      <StatusIcon status={item.status} />
      <span className="truncate">{statusMeta[item.status].label}</span>
    </>
  )

  if (!editable) {
    return (
      <StaticChip className={triggerClassName}>{triggerContents}</StaticChip>
    )
  }

  const activeMatches = statusOptions.filter(
    (option) =>
      option.value !== PROPERTY_SELECT_SEPARATOR_VALUE &&
      OPEN_STATUSES.includes(option.value as WorkStatus) &&
      matchesQuery(option.label, query)
  )
  const closedMatches = statusOptions.filter(
    (option) =>
      option.value !== PROPERTY_SELECT_SEPARATOR_VALUE &&
      CLOSED_STATUSES.includes(option.value as WorkStatus) &&
      matchesQuery(option.label, query)
  )

  function selectStatus(status: WorkStatus) {
    useAppStore.getState().updateWorkItem(item.id, { status })
    setOpen(false)
  }

  return (
    <InlinePropertyPopover
      open={open}
      onOpenChange={createResettingOpenChange(setOpen, () => setQuery(""))}
      triggerClassName={triggerClassName}
      triggerContents={triggerContents}
    >
      <PropertyPopoverSearch
        icon={<MagnifyingGlass className="size-[14px]" />}
        placeholder="Change status..."
        value={query}
        onChange={setQuery}
      />
      <PropertyPopoverList>
        <InlineStatusOptionGroup
          options={activeMatches}
          selectedStatus={item.status}
          title="Active"
          onSelect={selectStatus}
        />
        <InlineStatusOptionGroup
          options={closedMatches}
          selectedStatus={item.status}
          title="Closed"
          onSelect={selectStatus}
        />
      </PropertyPopoverList>
    </InlinePropertyPopover>
  )
}

function InlinePriorityPropertyControl({
  editable,
  item,
  variant,
}: {
  editable: boolean
  item: WorkItem
  variant: InlinePropertyControlVariant
}) {
  const [open, setOpen] = useState(false)
  const empty = item.priority === "none"

  if (!editable && empty) {
    return null
  }

  const triggerClassName = getTriggerClassName(variant, empty)
  const triggerContents = (
    <>
      <PriorityIcon priority={item.priority} />
      <span className="truncate">
        {empty ? "Priority" : priorityMeta[item.priority].label}
      </span>
    </>
  )

  if (!editable) {
    return (
      <StaticChip className={triggerClassName}>{triggerContents}</StaticChip>
    )
  }

  return (
    <InlinePropertyPopover
      open={open}
      onOpenChange={setOpen}
      triggerClassName={triggerClassName}
      triggerContents={triggerContents}
      contentClassName={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
    >
      <PropertyPopoverList>
        {PRIORITY_ORDER.map((value) => (
          <PropertyPopoverItem
            key={value}
            selected={value === item.priority}
            onClick={() => {
              useAppStore.getState().updateWorkItem(item.id, {
                priority: value,
              })
              setOpen(false)
            }}
            trailing={
              value === item.priority ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <PriorityIcon priority={value} />
            <span>{priorityMeta[value].label}</span>
          </PropertyPopoverItem>
        ))}
      </PropertyPopoverList>
    </InlinePropertyPopover>
  )
}

function InlineAssigneePropertyControl({
  currentAssignees,
  editable,
  item,
  teamMembers,
  variant,
}: {
  currentAssignees: UserProfile[]
  editable: boolean
  item: WorkItem
  teamMembers: ReturnType<typeof getTeamMembers>
  variant: InlinePropertyControlVariant
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const empty = currentAssignees.length === 0

  if (empty && (!editable || variant === "surface")) {
    return null
  }

  const triggerClassName = getAssigneeTriggerClassName(variant, empty)
  const triggerLabel = getAssigneeTriggerLabel(currentAssignees)
  const triggerContents =
    currentAssignees.length > 0 ? (
      <span className="flex -space-x-1">
        {currentAssignees.slice(0, 3).map((assignee) => (
          <WorkItemAssigneeAvatar
            key={assignee.id}
            user={assignee}
            size="xs"
            className="border border-surface data-[size=sm]:size-4"
          />
        ))}
      </span>
    ) : (
      <>
        <User className="size-3.5 shrink-0" />
        <span>Assignee</span>
      </>
    )

  if (!editable) {
    return (
      <StaticChip ariaLabel={triggerLabel} className={triggerClassName}>
        {triggerContents}
      </StaticChip>
    )
  }

  const assigneeMatches = teamMembers.filter((member) =>
    matchesQuery(member.name, query)
  )

  return (
    <InlinePropertyPopover
      open={open}
      onOpenChange={createResettingOpenChange(setOpen, () => setQuery(""))}
      triggerAriaLabel={triggerLabel}
      triggerClassName={triggerClassName}
      triggerContents={triggerContents}
    >
      <PropertyPopoverSearch
        icon={<MagnifyingGlass className="size-[14px]" />}
        placeholder="Assign to..."
        value={query}
        onChange={setQuery}
      />
      <PropertyPopoverList>
        <PropertyPopoverGroup>Assignee</PropertyPopoverGroup>
        <PropertyPopoverItem
          selected={currentAssignees.length === 0}
          onClick={() => {
            useAppStore.getState().updateWorkItem(item.id, {
              assigneeId: null,
              assigneeIds: [],
            })
            setOpen(false)
          }}
          trailing={
            currentAssignees.length === 0 ? (
              <Check className="size-[14px] text-foreground" />
            ) : null
          }
        >
          <User className="size-3.5 shrink-0 text-fg-3" />
          <span>Unassigned</span>
        </PropertyPopoverItem>
        {assigneeMatches.map((member) => (
          <PropertyPopoverItem
            key={member.id}
            selected={getWorkItemAssigneeIds(item).includes(member.id)}
            onClick={() => {
              const assigneeIds = toggleWorkItemAssigneeId(
                getWorkItemAssigneeIds(item),
                member.id
              )
              useAppStore.getState().updateWorkItem(item.id, {
                assigneeId: assigneeIds[0] ?? null,
                assigneeIds,
              })
            }}
            trailing={
              getWorkItemAssigneeIds(item).includes(member.id) ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <WorkItemAssigneeAvatar
              user={member}
              size="xs"
              className="data-[size=sm]:size-4"
            />
            <span>{member.name}</span>
          </PropertyPopoverItem>
        ))}
      </PropertyPopoverList>
    </InlinePropertyPopover>
  )
}

function InlineProjectPropertyControl({
  currentProject,
  editable,
  item,
  teamProjects,
  variant,
}: {
  currentProject: ReturnType<typeof getTeamProjectOptions>[number] | null
  editable: boolean
  item: WorkItem
  teamProjects: ReturnType<typeof getTeamProjectOptions>
  variant: InlinePropertyControlVariant
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { requestUpdate: requestConfirmedWorkItemUpdate, confirmationDialog } =
    useWorkItemProjectCascadeConfirmation()
  const empty = !currentProject

  if (empty && (!editable || variant === "surface")) {
    return null
  }

  const triggerClassName = getTriggerClassName(variant, empty)
  const triggerContents = currentProject ? (
    <>
      <ProjectIconGlyph
        project={currentProject}
        className="size-3.5 shrink-0 text-fg-3"
      />
      <span className="max-w-[112px] truncate">{currentProject.name}</span>
    </>
  ) : (
    <>
      <FolderSimple className="size-3.5 shrink-0" />
      <span>Project</span>
    </>
  )

  if (!editable) {
    return (
      <StaticChip className={triggerClassName}>{triggerContents}</StaticChip>
    )
  }

  const projectMatches = teamProjects.filter((project) =>
    matchesQuery(project.name, query)
  )

  return (
    <InlinePropertyPopover
      open={open}
      onOpenChange={createResettingOpenChange(setOpen, () => setQuery(""))}
      triggerClassName={triggerClassName}
      triggerContents={triggerContents}
      afterContent={confirmationDialog}
    >
      <PropertyPopoverSearch
        icon={<MagnifyingGlass className="size-[14px]" />}
        placeholder="Move to project..."
        value={query}
        onChange={setQuery}
      />
      <PropertyPopoverList>
        <PropertyPopoverGroup>Project</PropertyPopoverGroup>
        <PropertyPopoverItem
          selected={currentProject === null}
          onClick={() => {
            requestConfirmedWorkItemUpdate(item.id, {
              primaryProjectId: null,
            })
            setOpen(false)
          }}
          trailing={
            currentProject === null ? (
              <Check className="size-[14px] text-foreground" />
            ) : null
          }
        >
          <FolderSimple className="size-3.5 shrink-0 text-fg-3" />
          <span>No project</span>
        </PropertyPopoverItem>
        {projectMatches.map((project) => (
          <PropertyPopoverItem
            key={project.id}
            selected={project.id === item.primaryProjectId}
            onClick={() => {
              requestConfirmedWorkItemUpdate(item.id, {
                primaryProjectId: project.id,
              })
              setOpen(false)
            }}
            trailing={
              project.id === item.primaryProjectId ? (
                <Check className="size-[14px] text-foreground" />
              ) : null
            }
          >
            <ProjectIconGlyph
              project={project}
              className="size-4 shrink-0 text-fg-3"
            />
            <span>{project.name}</span>
          </PropertyPopoverItem>
        ))}
      </PropertyPopoverList>
    </InlinePropertyPopover>
  )
}

export function InlineWorkItemPropertyControl({
  data,
  item,
  property,
  variant = "surface",
}: {
  data: AppData
  item: WorkItem
  property: InlineEditableProperty
  variant?: InlinePropertyControlVariant
}) {
  const team = getTeam(data, item.teamId)
  const workspaceId =
    (item.visibility ?? "team") === "private"
      ? (item.workspaceId ?? null)
      : (item.workspaceId ?? team?.workspaceId ?? null)
  const editable =
    (item.visibility ?? "team") === "private"
      ? item.creatorId === data.currentUserId &&
        Boolean(
          workspaceId &&
          hasWorkspaceAccess(data, workspaceId, data.currentUserId)
        )
      : canEditTeam(data, team?.id)
  const customPropertyId = getCustomPropertyIdFromDisplayReference(property)

  if (customPropertyId) {
    return (
      <InlineCustomPropertyControl
        data={data}
        customPropertyId={customPropertyId}
        editable={editable}
        item={item}
        variant={variant}
      />
    )
  }

  return (
    <InlineBuiltinPropertyControl
      data={data}
      editable={editable}
      item={item}
      property={property}
      team={team}
      variant={variant}
    />
  )
}

function InlineCustomPropertyControl({
  customPropertyId,
  data,
  editable,
  item,
  variant,
}: {
  customPropertyId: string
  data: AppData
  editable: boolean
  item: WorkItem
  variant: InlinePropertyControlVariant
}) {
  const definition =
    data.customPropertyDefinitions.find(
      (entry) =>
        entry.id === customPropertyId &&
        isCustomPropertyDefinitionForWorkItem(entry, item, data.currentUserId)
    ) ?? null

  if (!definition) {
    return null
  }

  return (
    <CustomPropertyValueControl
      data={data}
      definition={definition}
      item={item}
      value={
        data.customPropertyValues.find(
          (entry) =>
            entry.workItemId === item.id && entry.propertyId === definition.id
        ) ?? null
      }
      editable={editable}
      variant={variant === "child" ? "chip" : "row"}
    />
  )
}

function InlineBuiltinPropertyControl({
  data,
  editable,
  item,
  property,
  team,
  variant,
}: {
  data: AppData
  editable: boolean
  item: WorkItem
  property: InlineEditableProperty
  team: AppData["teams"][number] | null | undefined
  variant: InlinePropertyControlVariant
}) {
  const currentAssignees = getWorkItemAssigneeIds(item)
    .map((assigneeId) => getUser(data, assigneeId))
    .filter((user): user is UserProfile => Boolean(user))
  const teamMembers = team ? getTeamMembers(data, team.id) : []
  const teamProjects = getTeamProjectOptions(
    data,
    team?.id,
    item.primaryProjectId
  )
  const currentProject =
    item.primaryProjectId === null
      ? null
      : (teamProjects.find((project) => project.id === item.primaryProjectId) ??
        null)
  const statusOptions = buildPropertyStatusOptions(getStatusOrderForTeam(team))

  if (property === "status") {
    return (
      <InlineStatusPropertyControl
        editable={editable}
        item={item}
        statusOptions={statusOptions}
        variant={variant}
      />
    )
  }

  if (property === "priority") {
    return (
      <InlinePriorityPropertyControl
        editable={editable}
        item={item}
        variant={variant}
      />
    )
  }

  if (property === "assignee") {
    return renderInlineAssigneePropertyControl({
      currentAssignees,
      editable,
      item,
      teamMembers,
      variant,
    })
  }

  return (
    <InlineProjectPropertyControl
      currentProject={currentProject}
      editable={editable}
      item={item}
      teamProjects={teamProjects}
      variant={variant}
    />
  )
}

function renderInlineAssigneePropertyControl({
  currentAssignees,
  editable,
  item,
  teamMembers,
  variant,
}: {
  currentAssignees: UserProfile[]
  editable: boolean
  item: WorkItem
  teamMembers: UserProfile[]
  variant: InlinePropertyControlVariant
}) {
  if ((item.visibility ?? "team") === "private") {
    return null
  }

  return (
    <InlineAssigneePropertyControl
      currentAssignees={currentAssignees}
      editable={editable}
      item={item}
      teamMembers={teamMembers}
      variant={variant}
    />
  )
}
