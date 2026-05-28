"use client"

import {
  useState,
  type ElementType,
  type ReactNode,
  type SyntheticEvent,
} from "react"
import {
  ArrowSquareOut,
  CircleDashed,
  DotsThree,
  Flag,
  FolderSimple,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react"

import { useAppRouter } from "@/lib/browser/app-navigation"
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
  type WorkStatus,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { ProjectIconGlyph } from "@/components/app/entity-icons"
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
import { useWorkItemProjectCascadeConfirmation } from "./use-work-item-project-cascade-confirmation"
import { WorkItemAssigneeAvatar } from "./work-item-ui"

export function stopMenuEvent(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function stopDragPropagation(event: SyntheticEvent) {
  event.stopPropagation()
}

type WorkItemMenuComponents = {
  MenuItem: ElementType
  MenuLabel: ElementType
  MenuSeparator: ElementType
  MenuSub: ElementType
  MenuSubContent: ElementType
  MenuSubTrigger: ElementType
}

function getWorkItemMenuComponents(
  kind: "dropdown" | "context"
): WorkItemMenuComponents {
  return {
    MenuItem: kind === "dropdown" ? DropdownMenuItem : ContextMenuItem,
    MenuLabel: kind === "dropdown" ? DropdownMenuLabel : ContextMenuLabel,
    MenuSeparator:
      kind === "dropdown" ? DropdownMenuSeparator : ContextMenuSeparator,
    MenuSub: kind === "dropdown" ? DropdownMenuSub : ContextMenuSub,
    MenuSubContent:
      kind === "dropdown" ? DropdownMenuSubContent : ContextMenuSubContent,
    MenuSubTrigger:
      kind === "dropdown" ? DropdownMenuSubTrigger : ContextMenuSubTrigger,
  }
}

function WorkItemContextActions({
  itemId,
  menu,
  onEditItem,
  onOpenItem,
}: {
  itemId: string
  menu: WorkItemMenuComponents
  onEditItem?: (itemId: string) => void
  onOpenItem?: (itemId: string) => void
}) {
  const { MenuItem, MenuSeparator } = menu

  return (
    <>
      <MenuItem onSelect={() => onOpenItem?.(itemId)}>
        <ArrowSquareOut className="size-4" />
        Open item
      </MenuItem>
      {onEditItem ? (
        <MenuItem onSelect={() => onEditItem(itemId)}>
          <PencilSimple className="size-4" />
          Edit item
        </MenuItem>
      ) : null}
      <MenuSeparator />
    </>
  )
}

function WorkItemStatusMenuSection({
  editable,
  item,
  menu,
  statusOptions,
}: {
  editable: boolean
  item: WorkItem
  menu: WorkItemMenuComponents
  statusOptions: WorkStatus[]
}) {
  const { MenuItem, MenuSub, MenuSubContent, MenuSubTrigger } = menu

  return (
    <MenuSub>
      <MenuSubTrigger disabled={!editable}>
        <CircleDashed className="size-4" />
        <span>Status</span>
      </MenuSubTrigger>
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
  )
}

function WorkItemPriorityMenuSection({
  editable,
  item,
  menu,
}: {
  editable: boolean
  item: WorkItem
  menu: WorkItemMenuComponents
}) {
  const { MenuItem, MenuSub, MenuSubContent, MenuSubTrigger } = menu

  return (
    <MenuSub>
      <MenuSubTrigger disabled={!editable}>
        <Flag className="size-4" />
        <span>Priority</span>
      </MenuSubTrigger>
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
  )
}

function WorkItemAssigneeMenuSection({
  assigneeMenuMembers,
  currentUser,
  currentUserId,
  editable,
  item,
  menu,
}: {
  assigneeMenuMembers: AppData["users"]
  currentUser: AppData["users"][number] | null
  currentUserId: string
  editable: boolean
  item: WorkItem
  menu: WorkItemMenuComponents
}) {
  const { MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger } =
    menu

  return (
    <MenuSub>
      <MenuSubTrigger disabled={!editable}>
        <Plus className="size-4" />
        <span>Assignee</span>
      </MenuSubTrigger>
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
              assigneeId: currentUserId,
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
  )
}

function WorkItemProjectMenuSection({
  editable,
  item,
  menu,
  requestConfirmedWorkItemUpdate,
  teamProjects,
}: {
  editable: boolean
  item: WorkItem
  menu: WorkItemMenuComponents
  requestConfirmedWorkItemUpdate: ReturnType<
    typeof useWorkItemProjectCascadeConfirmation
  >["requestUpdate"]
  teamProjects: AppData["projects"]
}) {
  const { MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger } =
    menu

  return (
    <MenuSub>
      <MenuSubTrigger disabled={!editable}>
        <FolderSimple className="size-4" />
        <span>Project</span>
      </MenuSubTrigger>
      <MenuSubContent>
        <MenuItem
          onSelect={() =>
            requestConfirmedWorkItemUpdate(item.id, {
              primaryProjectId: null,
            })
          }
        >
          <FolderSimple className="size-4 text-fg-3" />
          <span className="text-fg-3">No project</span>
        </MenuItem>
        {teamProjects.length > 0 ? <MenuSeparator /> : null}
        {teamProjects.map((project) => (
          <MenuItem
            key={`${item.id}-${project.id}`}
            onSelect={() =>
              requestConfirmedWorkItemUpdate(item.id, {
                primaryProjectId: project.id,
              })
            }
          >
            <ProjectIconGlyph project={project} className="size-4 text-fg-3" />
            <span>{project.name}</span>
          </MenuItem>
        ))}
      </MenuSubContent>
    </MenuSub>
  )
}

function IssueActionMenuContent({
  data,
  item,
  kind,
  onEditItem,
  onOpenItem,
  requestConfirmedWorkItemUpdate,
}: {
  data: AppData
  item: WorkItem
  kind: "dropdown" | "context"
  onEditItem?: (itemId: string) => void
  onOpenItem?: (itemId: string) => void
  requestConfirmedWorkItemUpdate: ReturnType<
    typeof useWorkItemProjectCascadeConfirmation
  >["requestUpdate"]
}) {
  const team = getTeam(data, item.teamId)
  const editable = team ? canEditTeam(data, team.id) : false
  const itemLabel = getDisplayLabelForWorkItemType(
    item.type,
    team?.settings.experience
  ).toLowerCase()
  const teamMembers = team ? getTeamMembers(data, team.id) : []
  const currentUser = getUser(data, data.currentUserId) ?? null
  const isPrivateItem = item.visibility === "private"
  const assigneeMenuMembers = teamMembers.filter(
    (member) => member.id !== data.currentUserId
  )
  const teamProjects = getTeamProjectOptions(
    data,
    team?.id,
    item.primaryProjectId
  )
  const statusOptions = getStatusOrderForTeam(team)
  const menu = getWorkItemMenuComponents(kind)
  const { MenuItem, MenuLabel, MenuSeparator } = menu
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  async function handleDelete() {
    await useAppStore.getState().deleteWorkItem(item.id)
    setDeleteDialogOpen(false)
  }

  return (
    <>
      <MenuLabel>{item.key}</MenuLabel>
      <MenuSeparator />
      {kind === "context" ? (
        <WorkItemContextActions
          itemId={item.id}
          menu={menu}
          onEditItem={onEditItem}
          onOpenItem={onOpenItem}
        />
      ) : null}
      <WorkItemStatusMenuSection
        editable={editable}
        item={item}
        menu={menu}
        statusOptions={statusOptions}
      />
      <WorkItemPriorityMenuSection
        editable={editable}
        item={item}
        menu={menu}
      />
      {isPrivateItem ? null : (
        <WorkItemAssigneeMenuSection
          assigneeMenuMembers={assigneeMenuMembers}
          currentUser={currentUser}
          currentUserId={data.currentUserId}
          editable={editable}
          item={item}
          menu={menu}
        />
      )}
      {isPrivateItem ? null : (
        <WorkItemProjectMenuSection
          editable={editable}
          item={item}
          menu={menu}
          requestConfirmedWorkItemUpdate={requestConfirmedWorkItemUpdate}
          teamProjects={teamProjects}
        />
      )}
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
  const { requestUpdate: requestConfirmedWorkItemUpdate, confirmationDialog } =
    useWorkItemProjectCascadeConfirmation()

  return (
    <>
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
          <IssueActionMenuContent
            data={data}
            item={item}
            kind="dropdown"
            requestConfirmedWorkItemUpdate={requestConfirmedWorkItemUpdate}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmationDialog}
    </>
  )
}

export function IssueContextMenu({
  data,
  item,
  onEditItem,
  onOpenItem,
  children,
}: {
  data: AppData
  item: WorkItem
  onEditItem?: (itemId: string) => void
  onOpenItem?: (itemId: string) => void
  children: ReactNode
}) {
  const router = useAppRouter()
  const { requestUpdate: requestConfirmedWorkItemUpdate, confirmationDialog } =
    useWorkItemProjectCascadeConfirmation()
  const handleOpenItem =
    onOpenItem ?? ((itemId: string) => router.push(`/items/${itemId}`))

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <IssueActionMenuContent
            data={data}
            item={item}
            kind="context"
            onEditItem={onEditItem}
            onOpenItem={handleOpenItem}
            requestConfirmedWorkItemUpdate={requestConfirmedWorkItemUpdate}
          />
        </ContextMenuContent>
      </ContextMenu>
      {confirmationDialog}
    </>
  )
}
