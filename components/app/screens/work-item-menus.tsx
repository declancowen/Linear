"use client"

import {
  useState,
  type ElementType,
  type ReactNode,
  type SyntheticEvent,
} from "react"
import { DotsThree, Trash } from "@phosphor-icons/react"

import {
  canEditTeam,
  getStatusOrderForTeam,
  getTeam,
  getTeamMembers,
  getUser,
} from "@/lib/domain/selectors"
import {
  getDisplayLabelForWorkItemType,
  priorityMeta,
  statusMeta,
  type AppData,
  type Priority,
  type WorkItem,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { ProjectTemplateGlyph } from "@/components/app/entity-icons"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getTeamProjectOptions } from "./helpers"
import { PriorityIcon, StatusIcon } from "./shared"
import { WorkItemAssigneeAvatar } from "./work-item-ui"

export function stopMenuEvent(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function stopDragPropagation(event: SyntheticEvent) {
  event.stopPropagation()
}

function IssueActionMenuContent({
  data,
  item,
  kind,
}: {
  data: AppData
  item: WorkItem
  kind: "dropdown" | "context"
}) {
  const team = getTeam(data, item.teamId)
  const editable = team ? canEditTeam(data, team.id) : false
  const itemLabel = getDisplayLabelForWorkItemType(
    item.type,
    team?.settings.experience
  ).toLowerCase()
  const teamMembers = team ? getTeamMembers(data, team.id) : []
  const currentUser = getUser(data, data.currentUserId)
  const assigneeMenuMembers = teamMembers.filter(
    (member) => member.id !== data.currentUserId
  )
  const teamProjects = getTeamProjectOptions(data, team?.id, item.primaryProjectId)
  const statusOptions = getStatusOrderForTeam(team)
  const MenuLabel: ElementType =
    kind === "dropdown" ? DropdownMenuLabel : ContextMenuLabel
  const MenuSeparator: ElementType =
    kind === "dropdown" ? DropdownMenuSeparator : ContextMenuSeparator
  const MenuSub: ElementType =
    kind === "dropdown" ? DropdownMenuSub : ContextMenuSub
  const MenuSubTrigger: ElementType =
    kind === "dropdown" ? DropdownMenuSubTrigger : ContextMenuSubTrigger
  const MenuSubContent: ElementType =
    kind === "dropdown" ? DropdownMenuSubContent : ContextMenuSubContent
  const MenuItem: ElementType =
    kind === "dropdown" ? DropdownMenuItem : ContextMenuItem
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  async function handleDelete() {
    await useAppStore.getState().deleteWorkItem(item.id)
    setDeleteDialogOpen(false)
  }

  return (
    <>
      <MenuLabel>{item.key}</MenuLabel>
      <MenuSeparator />
      <MenuSub>
        <MenuSubTrigger disabled={!editable}>Status</MenuSubTrigger>
        <MenuSubContent>
          {statusOptions.map((status) => (
            <MenuItem
              key={`${item.id}-${status}`}
              onSelect={() =>
                useAppStore.getState().updateWorkItem(item.id, { status })
              }
            >
              <StatusIcon status={status} />
              <span>{statusMeta[status].label}</span>
            </MenuItem>
          ))}
        </MenuSubContent>
      </MenuSub>
      <MenuSub>
        <MenuSubTrigger disabled={!editable}>Priority</MenuSubTrigger>
        <MenuSubContent>
          {Object.entries(priorityMeta).map(([priority, meta]) => (
            <MenuItem
              key={`${item.id}-${priority}`}
              onSelect={() =>
                useAppStore.getState().updateWorkItem(item.id, {
                  priority: priority as Priority,
                })
              }
            >
              <PriorityIcon priority={priority as Priority} />
              <span>{meta.label}</span>
            </MenuItem>
          ))}
        </MenuSubContent>
      </MenuSub>
      <MenuSub>
        <MenuSubTrigger disabled={!editable}>Assignee</MenuSubTrigger>
        <MenuSubContent>
          <MenuItem
            onSelect={() =>
              useAppStore.getState().updateWorkItem(item.id, {
                assigneeId: null,
              })
            }
          >
            <span className="text-fg-3">Unassigned</span>
          </MenuItem>
          <MenuItem
            onSelect={() =>
              useAppStore.getState().updateWorkItem(item.id, {
                assigneeId: data.currentUserId,
              })
            }
          >
            {currentUser ? (
              <WorkItemAssigneeAvatar
                user={currentUser}
                className="size-4 data-[size=sm]:size-4"
              />
            ) : null}
            <span>Assign to me</span>
          </MenuItem>
          <MenuSeparator />
          {assigneeMenuMembers.map((member) => (
            <MenuItem
              key={`${item.id}-${member.id}`}
              onSelect={() =>
                useAppStore.getState().updateWorkItem(item.id, {
                  assigneeId: member.id,
                })
              }
            >
              <WorkItemAssigneeAvatar
                user={member}
                className="size-4 data-[size=sm]:size-4"
              />
              <span>{member.name}</span>
            </MenuItem>
          ))}
        </MenuSubContent>
      </MenuSub>
      <MenuSub>
        <MenuSubTrigger disabled={!editable}>Project</MenuSubTrigger>
        <MenuSubContent>
          <MenuItem
            onSelect={() =>
              useAppStore.getState().updateWorkItem(item.id, {
                primaryProjectId: null,
              })
            }
          >
            <span className="text-fg-3">No project</span>
          </MenuItem>
          {teamProjects.length > 0 ? <MenuSeparator /> : null}
          {teamProjects.map((project) => (
            <MenuItem
              key={`${item.id}-${project.id}`}
              onSelect={() =>
                useAppStore.getState().updateWorkItem(item.id, {
                  primaryProjectId: project.id,
                })
              }
            >
              <ProjectTemplateGlyph
                templateType={project.templateType}
                className="size-4 text-fg-3"
              />
              <span>{project.name}</span>
            </MenuItem>
          ))}
        </MenuSubContent>
      </MenuSub>
      {editable ? (
        <>
          <MenuSeparator />
          <MenuItem
            variant="destructive"
            onSelect={(event: Event) => {
              event.preventDefault()
              setDeleteDialogOpen(true)
            }}
          >
            <Trash className="size-4" />
            Delete {itemLabel}
          </MenuItem>
        </>
      ) : null}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${item.key}`}
        description="This work item will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}

export function IssueActionMenu({
  data,
  item,
  triggerClassName,
}: {
  data: AppData
  item: WorkItem
  triggerClassName?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClassName}
          onPointerDown={stopDragPropagation}
          onClick={stopMenuEvent}
        >
          <DotsThree className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <IssueActionMenuContent data={data} item={item} kind="dropdown" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function IssueContextMenu({
  data,
  item,
  children,
}: {
  data: AppData
  item: WorkItem
  children: ReactNode
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <IssueActionMenuContent data={data} item={item} kind="context" />
      </ContextMenuContent>
    </ContextMenu>
  )
}
