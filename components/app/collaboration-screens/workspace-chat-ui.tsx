"use client"

import {
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { CheckCircle, Circle, X } from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"
import {
  conversationTitleConstraints,
  getTextInputLimitState,
} from "@/lib/domain/input-constraints"
import type { AppData } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import {
  useCommandEnterSubmit,
  useShortcutModifierLabel,
} from "@/components/app/shortcut-keys"
import {
  shouldRemoveLastWorkspaceChatRecipient,
  WorkspaceChatCreateFooter,
} from "@/components/app/collaboration-screens/workspace-chat-create-footer"
import { UserAvatar } from "@/components/app/user-presence"
import { formatShortDate } from "@/components/app/collaboration-screens/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export const WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY =
  "workspace-chat-list-width:v2"
export const WORKSPACE_CHAT_LIST_COLLAPSED_STORAGE_KEY =
  "workspace-chat-list-collapsed:v1"
export const WORKSPACE_CHAT_LIST_DEFAULT_WIDTH = 256
const WORKSPACE_CHAT_LIST_MIN_WIDTH = 224
const WORKSPACE_CHAT_LIST_MIN_WIDTH_RATIO = 0.25
const WORKSPACE_CHAT_LIST_MAX_WIDTH = 420

function getWorkspaceChatListMinWidth(containerWidth: number | null) {
  return containerWidth && Number.isFinite(containerWidth)
    ? Math.max(
        WORKSPACE_CHAT_LIST_MIN_WIDTH,
        Math.round(containerWidth * WORKSPACE_CHAT_LIST_MIN_WIDTH_RATIO)
      )
    : WORKSPACE_CHAT_LIST_MIN_WIDTH
}

function getWorkspaceChatListMaxWidth(containerWidth: number | null) {
  return Math.max(
    WORKSPACE_CHAT_LIST_MAX_WIDTH,
    getWorkspaceChatListMinWidth(containerWidth)
  )
}

export function clampWorkspaceChatListWidth(
  value: number,
  containerWidth: number | null = null
) {
  return Math.min(
    getWorkspaceChatListMaxWidth(containerWidth),
    Math.max(getWorkspaceChatListMinWidth(containerWidth), value)
  )
}

type ConversationListItem = {
  id: string
  title: string
  unread?: boolean
  updatedAt: string
}

function ConversationListRowBody({
  conversation,
  leading,
  preview,
  selected,
  unread,
}: {
  conversation: ConversationListItem
  leading?: ReactNode
  preview: string
  selected: boolean
  unread: boolean
}) {
  return (
    <div
      className={cn(
        "grid w-full items-center gap-x-3",
        unread && "pl-1",
        leading
          ? "grid-cols-[auto_minmax(0,1fr)]"
          : "grid-cols-[minmax(0,1fr)]"
      )}
    >
      {leading ? <div className="row-span-2 shrink-0">{leading}</div> : null}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
        <div
          className={cn(
            "truncate text-[13px] leading-5",
            selected || unread ? "font-semibold" : "font-medium"
          )}
        >
          {conversation.title}
        </div>
        <div className="flex max-w-[7.75rem] shrink-0 items-center gap-1 overflow-hidden text-[10px] text-muted-foreground">
          <span className="shrink-0 tabular-nums">
            {formatShortDate(conversation.updatedAt)}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "mt-0.5 min-w-0 truncate text-[11px]",
          unread ? "text-foreground/80" : "text-muted-foreground"
        )}
      >
        {preview}
      </div>
    </div>
  )
}

function ConversationReadStateButton({
  conversationId,
  onMarkRead,
  onMarkUnread,
  unread,
}: {
  conversationId: string
  onMarkRead: (id: string) => void
  onMarkUnread: (id: string) => void
  unread: boolean
}) {
  const actionLabel = unread ? "Mark chat as read" : "Mark chat as unread"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={actionLabel}
          className="absolute top-2 right-2 inline-grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-surface-3 hover:text-foreground focus-visible:opacity-100 group-focus-within/chat-row:opacity-100 group-hover/chat-row:opacity-100"
          onClick={(event) => {
            event.stopPropagation()

            if (unread) {
              onMarkRead(conversationId)
              return
            }

            onMarkUnread(conversationId)
          }}
        >
          {unread ? (
            <CheckCircle className="size-3.5" />
          ) : (
            <Circle className="size-3.5" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{actionLabel}</TooltipContent>
    </Tooltip>
  )
}

function ConversationListRow({
  conversation,
  leading,
  onMarkRead,
  onMarkUnread,
  onSelect,
  preview,
  selected,
}: {
  conversation: ConversationListItem
  leading?: ReactNode
  onMarkRead?: (id: string) => void
  onMarkUnread?: (id: string) => void
  onSelect: (id: string) => void
  preview: string
  selected: boolean
}) {
  const unread = conversation.unread ?? false
  const canToggleReadState =
    onMarkRead !== undefined && onMarkUnread !== undefined

  return (
    <div className="group/chat-row relative">
      <button
        type="button"
        className={cn(
          "relative block w-full max-w-full overflow-hidden rounded-md px-3 py-2.5 text-left transition-colors",
          canToggleReadState && "pr-9",
          selected
            ? "bg-accent"
            : unread
              ? "bg-primary/5 hover:bg-accent/60"
              : "hover:bg-accent/50"
        )}
        onClick={() => onSelect(conversation.id)}
      >
        {unread ? (
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-1.5 size-1.5 -translate-y-1/2 rounded-full bg-primary"
          />
        ) : null}
        <ConversationListRowBody
          conversation={conversation}
          leading={leading}
          preview={preview}
          selected={selected}
          unread={unread}
        />
      </button>
      {canToggleReadState ? (
        <ConversationReadStateButton
          conversationId={conversation.id}
          onMarkRead={onMarkRead}
          onMarkUnread={onMarkUnread}
          unread={unread}
        />
      ) : null}
    </div>
  )
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onMarkRead,
  onMarkUnread,
  renderLeading,
  renderPreview,
  className,
}: {
  conversations: Array<{
    id: string
    title: string
    unread?: boolean
    updatedAt: string
  }>
  selectedId: string | null
  onSelect: (id: string) => void
  onMarkRead?: (id: string) => void
  onMarkUnread?: (id: string) => void
  renderLeading?: (id: string) => ReactNode
  renderPreview: (id: string) => string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden border-r",
        className
      )}
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col px-1 py-1">
          {conversations.map((conversation) => (
            <ConversationListRow
              key={conversation.id}
              conversation={conversation}
              leading={renderLeading?.(conversation.id)}
              onMarkRead={onMarkRead}
              onMarkUnread={onMarkUnread}
              onSelect={onSelect}
              preview={renderPreview(conversation.id)}
              selected={selectedId === conversation.id}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

type WorkspaceChatUser = AppData["users"][number]

function getWorkspaceChatUsers(input: {
  currentUserId: string
  teamMemberships: AppData["teamMemberships"]
  teams: AppData["teams"]
  users: AppData["users"]
  workspace: AppData["workspaces"][number] | null
}) {
  if (!input.workspace) {
    return []
  }

  const teamIds = new Set(
    input.teams
      .filter((team) => team.workspaceId === input.workspace?.id)
      .map((team) => team.id)
  )
  const userIds = new Set(
    input.teamMemberships
      .filter((membership) => teamIds.has(membership.teamId))
      .map((membership) => membership.userId)
  )

  if (input.workspace.createdBy) {
    userIds.add(input.workspace.createdBy)
  }

  return input.users.filter(
    (user) => user.id !== input.currentUserId && userIds.has(user.id)
  )
}

function filterWorkspaceChatUsers(
  users: WorkspaceChatUser[],
  participantIds: string[],
  search: string
) {
  const query = search.toLowerCase().trim()
  const matchedUsers = !query
    ? users
    : users.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.handle.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      )

  return matchedUsers.filter((user) => !participantIds.includes(user.id))
}

function getWorkspaceChatEmptyMessage(input: {
  allUsers: WorkspaceChatUser[]
  participantIds: string[]
  search: string
}) {
  if (input.search) {
    return "No people found"
  }

  return input.participantIds.length === input.allUsers.length
    ? "Everyone has been added"
    : "Type to search people"
}

function WorkspaceChatRecipientInput({
  availableUsers,
  inputRef,
  participantIds,
  search,
  selectedUsers,
  onAddUser,
  onRemoveUser,
  onSearchChange,
}: {
  availableUsers: WorkspaceChatUser[]
  inputRef: RefObject<HTMLInputElement | null>
  participantIds: string[]
  search: string
  selectedUsers: WorkspaceChatUser[]
  onAddUser: (userId: string) => void
  onRemoveUser: (userId: string) => void
  onSearchChange: (search: string) => void
}) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-3">
      <span className="shrink-0 text-sm text-muted-foreground">To:</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {selectedUsers.map((user) => (
          <span
            key={user.id}
            className="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs"
          >
            <UserAvatar
              name={user.name}
              avatarImageUrl={user.avatarImageUrl}
              avatarUrl={user.avatarUrl}
              showStatus={false}
            />
            <span className="font-medium">{user.name}</span>
            <button
              type="button"
              aria-label={`Remove ${user.name}`}
              onClick={() => onRemoveUser(user.id)}
              className="ml-0.5 rounded-sm text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              shouldRemoveLastWorkspaceChatRecipient(
                event.key,
                search,
                participantIds
              )
            ) {
              onRemoveUser(participantIds[participantIds.length - 1])
            }
            if (event.key === "Enter" && availableUsers.length > 0) {
              event.preventDefault()
              onAddUser(availableUsers[0].id)
            }
          }}
          placeholder={
            participantIds.length === 0 ? "Search people…" : "Add another…"
          }
          className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  )
}

function WorkspaceChatGroupNameField({
  groupName,
  groupNameLimitState,
  isGroup,
  onGroupNameChange,
}: {
  groupName: string
  groupNameLimitState: ReturnType<typeof getTextInputLimitState>
  isGroup: boolean
  onGroupNameChange: (groupName: string) => void
}) {
  if (!isGroup) {
    return null
  }

  return (
    <div className="border-b px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm text-muted-foreground">Name:</span>
        <input
          value={groupName}
          onChange={(event) => onGroupNameChange(event.target.value)}
          placeholder="Group name (optional)"
          maxLength={conversationTitleConstraints.max}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
      <FieldCharacterLimit
        state={groupNameLimitState}
        limit={conversationTitleConstraints.max}
        className="mt-1"
      />
    </div>
  )
}

function WorkspaceChatUserList({
  allUsers,
  availableUsers,
  participantIds,
  search,
  onAddUser,
}: {
  allUsers: WorkspaceChatUser[]
  availableUsers: WorkspaceChatUser[]
  participantIds: string[]
  search: string
  onAddUser: (userId: string) => void
}) {
  return (
    <ScrollArea className="max-h-64">
      <div className="flex flex-col py-1">
        {availableUsers.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            {getWorkspaceChatEmptyMessage({ allUsers, participantIds, search })}
          </div>
        ) : (
          availableUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onAddUser(user.id)}
              className="flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-accent/50"
            >
              <UserAvatar
                name={user.name}
                avatarImageUrl={user.avatarImageUrl}
                avatarUrl={user.avatarUrl}
                status={user.status}
                size="default"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {user.title || user.handle}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </ScrollArea>
  )
}

export function CreateWorkspaceChatDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (conversationId: string) => void
}) {
  const {
    currentUserId,
    currentWorkspaceId,
    teamMemberships,
    teams,
    users,
    workspaces,
  } = useAppStore(
    useShallow((state) => ({
      currentUserId: state.currentUserId,
      currentWorkspaceId: state.currentWorkspaceId,
      teamMemberships: state.teamMemberships,
      teams: state.teams,
      users: state.users,
      workspaces: state.workspaces,
    }))
  )
  const workspace = useMemo(
    () => workspaces.find((entry) => entry.id === currentWorkspaceId) ?? null,
    [currentWorkspaceId, workspaces]
  )
  const allUsers = useMemo(
    () =>
      getWorkspaceChatUsers({
        currentUserId,
        teamMemberships,
        teams,
        users,
        workspace,
      }),
    [currentUserId, teamMemberships, teams, users, workspace]
  )

  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [groupName, setGroupName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const shortcutModifierLabel = useShortcutModifierLabel()

  const isGroup = participantIds.length > 1
  const availableUsers = filterWorkspaceChatUsers(
    allUsers,
    participantIds,
    search
  )

  const selectedUsers = participantIds
    .map((id) => allUsers.find((user) => user.id === id))
    .filter(Boolean) as typeof allUsers
  const groupNameLimitState = getTextInputLimitState(
    groupName,
    conversationTitleConstraints
  )

  function addUser(userId: string) {
    setParticipantIds((ids) => [...ids, userId])
    setSearch("")
    inputRef.current?.focus()
  }

  function removeUser(userId: string) {
    setParticipantIds((ids) => ids.filter((id) => id !== userId))
    inputRef.current?.focus()
  }

  function handleCreate() {
    if (
      !workspace ||
      participantIds.length === 0 ||
      !groupNameLimitState.canSubmit
    ) {
      return
    }
    const conversationId = useAppStore.getState().createWorkspaceChat({
      workspaceId: workspace.id,
      participantIds,
      title: groupName,
      description: "",
    })
    if (conversationId) {
      onCreated(conversationId)
      onOpenChange(false)
      setParticipantIds([])
      setSearch("")
      setGroupName("")
    }
  }

  useCommandEnterSubmit(
    open && participantIds.length > 0 && groupNameLimitState.canSubmit,
    handleCreate
  )

  if (!workspace) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(openState) => {
        if (!openState) {
          setParticipantIds([])
          setSearch("")
          setGroupName("")
        }
        onOpenChange(openState)
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Create workspace chat</DialogTitle>
          <DialogDescription>
            Select people to start a direct message or create a group chat.
          </DialogDescription>
        </DialogHeader>

        <WorkspaceChatRecipientInput
          availableUsers={availableUsers}
          inputRef={inputRef}
          participantIds={participantIds}
          search={search}
          selectedUsers={selectedUsers}
          onAddUser={addUser}
          onRemoveUser={removeUser}
          onSearchChange={setSearch}
        />

        <WorkspaceChatGroupNameField
          groupName={groupName}
          groupNameLimitState={groupNameLimitState}
          isGroup={isGroup}
          onGroupNameChange={setGroupName}
        />

        <WorkspaceChatUserList
          allUsers={allUsers}
          availableUsers={availableUsers}
          participantIds={participantIds}
          search={search}
          onAddUser={addUser}
        />

        <WorkspaceChatCreateFooter
          groupNameLimitState={groupNameLimitState}
          isGroup={isGroup}
          participantCount={participantIds.length}
          shortcutModifierLabel={shortcutModifierLabel}
          onCreate={handleCreate}
        />
      </DialogContent>
    </Dialog>
  )
}
