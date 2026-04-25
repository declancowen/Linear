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

import { ProjectTemplateGlyph } from "@/components/app/entity-icons"
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
} from "@/lib/domain/selectors"
import {
  priorityMeta,
  statusMeta,
  type AppData,
  type Priority,
  type WorkItem,
  type WorkStatus,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"

import { getTeamProjectOptions } from "./helpers"
import { useWorkItemProjectCascadeConfirmation } from "./use-work-item-project-cascade-confirmation"
import {
  buildPropertyStatusOptions,
  PriorityIcon,
  PROPERTY_SELECT_SEPARATOR_VALUE,
  StatusIcon,
} from "./shared"

const OPEN_STATUSES: WorkStatus[] = ["backlog", "todo", "in-progress"]
const CLOSED_STATUSES: WorkStatus[] = ["done", "cancelled", "duplicate"]
const PRIORITY_ORDER: Priority[] = ["none", "urgent", "high", "medium", "low"]

type InlineEditableProperty = "status" | "priority" | "assignee" | "project"
type InlinePropertyControlVariant = "surface" | "child"

function stopInteractivePropagation(event: SyntheticEvent) {
  event.stopPropagation()
}

function matchesQuery(value: string, query: string) {
  if (!query) {
    return true
  }

  return value.toLowerCase().includes(query.toLowerCase())
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
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span data-no-drag="true" className={className}>
      {children}
    </span>
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
  const editable = team ? canEditTeam(data, team.id) : false
  const currentAssignee = item.assigneeId ? getUser(data, item.assigneeId) : null
  const teamMembers = team ? getTeamMembers(data, team.id) : []
  const teamProjects = getTeamProjectOptions(data, team?.id, item.primaryProjectId)
  const currentProject =
    item.primaryProjectId === null
      ? null
      : (teamProjects.find((project) => project.id === item.primaryProjectId) ??
        null)
  const statusOptions = buildPropertyStatusOptions(getStatusOrderForTeam(team))

  const [statusOpen, setStatusOpen] = useState(false)
  const [statusQuery, setStatusQuery] = useState("")
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [assigneeQuery, setAssigneeQuery] = useState("")
  const [projectOpen, setProjectOpen] = useState(false)
  const [projectQuery, setProjectQuery] = useState("")
  const { requestUpdate: requestConfirmedWorkItemUpdate, confirmationDialog } =
    useWorkItemProjectCascadeConfirmation()

  if (property === "status") {
    const triggerClassName = getTriggerClassName(variant)
    const triggerContents = (
      <>
        <StatusIcon status={item.status} />
        <span className="truncate">{statusMeta[item.status].label}</span>
      </>
    )

    if (!editable) {
      return <StaticChip className={triggerClassName}>{triggerContents}</StaticChip>
    }

    const activeMatches = statusOptions.filter(
      (option) =>
        option.value !== PROPERTY_SELECT_SEPARATOR_VALUE &&
        OPEN_STATUSES.includes(option.value as WorkStatus) &&
        matchesQuery(option.label, statusQuery)
    )
    const closedMatches = statusOptions.filter(
      (option) =>
        option.value !== PROPERTY_SELECT_SEPARATOR_VALUE &&
        CLOSED_STATUSES.includes(option.value as WorkStatus) &&
        matchesQuery(option.label, statusQuery)
    )

    return (
      <Popover
        open={statusOpen}
        onOpenChange={(next) => {
          setStatusOpen(next)
          if (!next) {
            setStatusQuery("")
          }
        }}
      >
        <PopoverTrigger asChild>
          <TriggerButton className={triggerClassName}>{triggerContents}</TriggerButton>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={PROPERTY_POPOVER_CLASS}
          data-no-drag="true"
          onPointerDown={stopInteractivePropagation}
        >
          <PropertyPopoverSearch
            icon={<MagnifyingGlass className="size-[14px]" />}
            placeholder="Change status..."
            value={statusQuery}
            onChange={setStatusQuery}
          />
          <PropertyPopoverList>
            {activeMatches.length > 0 ? (
              <>
                <PropertyPopoverGroup>Active</PropertyPopoverGroup>
                {activeMatches.map((option) => (
                  <PropertyPopoverItem
                    key={option.value}
                    selected={option.value === item.status}
                    onClick={() => {
                      useAppStore.getState().updateWorkItem(item.id, {
                        status: option.value as WorkStatus,
                      })
                      setStatusOpen(false)
                    }}
                    trailing={
                      option.value === item.status ? (
                        <Check className="size-[14px] text-foreground" />
                      ) : null
                    }
                  >
                    <StatusIcon status={option.value} />
                    <span>{option.label}</span>
                  </PropertyPopoverItem>
                ))}
              </>
            ) : null}
            {closedMatches.length > 0 ? (
              <>
                <PropertyPopoverGroup>Closed</PropertyPopoverGroup>
                {closedMatches.map((option) => (
                  <PropertyPopoverItem
                    key={option.value}
                    selected={option.value === item.status}
                    onClick={() => {
                      useAppStore.getState().updateWorkItem(item.id, {
                        status: option.value as WorkStatus,
                      })
                      setStatusOpen(false)
                    }}
                    trailing={
                      option.value === item.status ? (
                        <Check className="size-[14px] text-foreground" />
                      ) : null
                    }
                  >
                    <StatusIcon status={option.value} />
                    <span>{option.label}</span>
                  </PropertyPopoverItem>
                ))}
              </>
            ) : null}
          </PropertyPopoverList>
        </PopoverContent>
      </Popover>
    )
  }

  if (property === "priority") {
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
      return <StaticChip className={triggerClassName}>{triggerContents}</StaticChip>
    }

    return (
      <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
        <PopoverTrigger asChild>
          <TriggerButton className={triggerClassName}>{triggerContents}</TriggerButton>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(PROPERTY_POPOVER_CLASS, "w-[220px]")}
          data-no-drag="true"
          onPointerDown={stopInteractivePropagation}
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
                  setPriorityOpen(false)
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
        </PopoverContent>
      </Popover>
    )
  }

  if (property === "assignee") {
    const empty = !currentAssignee
    if (empty) {
      return null
    }

    const triggerClassName = getTriggerClassName(variant, empty)
    const triggerContents = currentAssignee ? (
      <>
        <WorkItemAssigneeAvatar
          user={currentAssignee}
          size="xs"
          className="data-[size=sm]:size-4"
        />
        <span className="max-w-[96px] truncate">{currentAssignee.name}</span>
      </>
    ) : (
      <>
        <User className="size-3.5 shrink-0" />
        <span>Assignee</span>
      </>
    )

    if (!editable) {
      return <StaticChip className={triggerClassName}>{triggerContents}</StaticChip>
    }

    const assigneeMatches = teamMembers.filter((member) =>
      matchesQuery(member.name, assigneeQuery)
    )

    return (
      <Popover
        open={assigneeOpen}
        onOpenChange={(next) => {
          setAssigneeOpen(next)
          if (!next) {
            setAssigneeQuery("")
          }
        }}
      >
        <PopoverTrigger asChild>
          <TriggerButton className={triggerClassName}>{triggerContents}</TriggerButton>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={PROPERTY_POPOVER_CLASS}
          data-no-drag="true"
          onPointerDown={stopInteractivePropagation}
        >
          <PropertyPopoverSearch
            icon={<MagnifyingGlass className="size-[14px]" />}
            placeholder="Assign to..."
            value={assigneeQuery}
            onChange={setAssigneeQuery}
          />
          <PropertyPopoverList>
            <PropertyPopoverGroup>Assignee</PropertyPopoverGroup>
            <PropertyPopoverItem
              selected={currentAssignee === null}
              onClick={() => {
                useAppStore.getState().updateWorkItem(item.id, {
                  assigneeId: null,
                })
                setAssigneeOpen(false)
              }}
              trailing={
                currentAssignee === null ? (
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
                selected={member.id === item.assigneeId}
                onClick={() => {
                  useAppStore.getState().updateWorkItem(item.id, {
                    assigneeId: member.id,
                  })
                  setAssigneeOpen(false)
                }}
                trailing={
                  member.id === item.assigneeId ? (
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
        </PopoverContent>
      </Popover>
    )
  }

  const empty = !currentProject
  if (empty) {
    return null
  }

  const triggerClassName = getTriggerClassName(variant, empty)
  const triggerContents = currentProject ? (
    <>
      <ProjectTemplateGlyph
        templateType={currentProject.templateType}
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
    return <StaticChip className={triggerClassName}>{triggerContents}</StaticChip>
  }

  const projectMatches = teamProjects.filter((project) =>
    matchesQuery(project.name, projectQuery)
  )

  return (
    <Popover
      open={projectOpen}
      onOpenChange={(next) => {
        setProjectOpen(next)
        if (!next) {
          setProjectQuery("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <TriggerButton className={triggerClassName}>{triggerContents}</TriggerButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={PROPERTY_POPOVER_CLASS}
        data-no-drag="true"
        onPointerDown={stopInteractivePropagation}
      >
        <PropertyPopoverSearch
          icon={<MagnifyingGlass className="size-[14px]" />}
          placeholder="Move to project..."
          value={projectQuery}
          onChange={setProjectQuery}
        />
        <PropertyPopoverList>
          <PropertyPopoverGroup>Project</PropertyPopoverGroup>
          <PropertyPopoverItem
            selected={currentProject === null}
            onClick={() => {
              requestConfirmedWorkItemUpdate(item.id, {
                primaryProjectId: null,
              })
              setProjectOpen(false)
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
                setProjectOpen(false)
              }}
              trailing={
                project.id === item.primaryProjectId ? (
                  <Check className="size-[14px] text-foreground" />
                ) : null
              }
            >
              <ProjectTemplateGlyph
                templateType={project.templateType}
                className="size-4 shrink-0 text-fg-3"
              />
              <span>{project.name}</span>
            </PropertyPopoverItem>
          ))}
        </PropertyPopoverList>
      </PopoverContent>
      {confirmationDialog}
    </Popover>
  )
}
