"use client"

import {
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { X } from "@phosphor-icons/react"
import {
  conversationTitleConstraints,
  getTextInputLimitState,
} from "@/lib/domain/input-constraints"
import type { AppData } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import {
  ShortcutKeys,
  useCommandEnterSubmit,
  useShortcutModifierLabel,
} from "@/components/app/shortcut-keys"
import { UserAvatar } from "@/components/app/user-presence"
import { formatShortDate } from "@/components/app/collaboration-screens/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export const WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY = "workspace-chat-list-width"
export const WORKSPACE_CHAT_LIST_DEFAULT_WIDTH = 256
const WORKSPACE_CHAT_LIST_MIN_WIDTH = 224
const WORKSPACE_CHAT_LIST_MAX_WIDTH = 420

export function clampWorkspaceChatListWidth(value: number) {
  return Math.min(
    WORKSPACE_CHAT_LIST_MAX_WIDTH,
    Math.max(WORKSPACE_CHAT_LIST_MIN_WIDTH, value)
  )
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  renderLeading,
  renderPreview,
  className,
}: {
  conversations: Array<{
    id: string
    title: string
    updatedAt: string
  }>
  selectedId: string | null
  onSelect: (id: string) => void
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
            <button
              key={conversation.id}
              className={cn(
                "block max-w-full overflow-hidden rounded-md px-3 py-2.5 text-left transition-colors",
                selectedId === conversation.id
                  ? "bg-accent"
                  : "hover:bg-accent/50"
              )}
              onClick={() => onSelect(conversation.id)}
            >
              <div className="flex items-center gap-3">
                {renderLeading ? (
                  <div className="shrink-0">
                    {renderLeading(conversation.id)}
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate text-[13px] leading-5",
                      selectedId === conversation.id
                        ? "font-semibold"
                        : "font-medium"
                    )}
                  >
                    {conversation.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {renderPreview(conversation.id)}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatShortDate(conversation.updatedAt)}
                </span>
              </div>
            </button>
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
              event.key === "Backspace" &&
              !search &&
              participantIds.length > 0
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

function WorkspaceChatCreateFooter({
  groupNameLimitState,
  isGroup,
  participantCount,
  shortcutModifierLabel,
  onCreate,
}: {
  groupNameLimitState: ReturnType<typeof getTextInputLimitState>
  isGroup: boolean
  participantCount: number
  shortcutModifierLabel: string
  onCreate: () => void
}) {
  if (participantCount === 0) {
    return null
  }

  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <span className="text-xs text-muted-foreground">
        {participantCount === 1
          ? "Direct message"
          : `Group · ${participantCount} people`}
      </span>
      <Button
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={onCreate}
        disabled={!groupNameLimitState.canSubmit || participantCount === 0}
      >
        {isGroup ? "Create group" : "Start chat"}
        <ShortcutKeys
          keys={[shortcutModifierLabel, "Enter"]}
          variant="inline"
          className="ml-0.5 gap-0.5 text-background/65"
        />
      </Button>
    </div>
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
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId)
  const currentUserId = useAppStore((state) => state.currentUserId)
  const workspaces = useAppStore((state) => state.workspaces)
  const teams = useAppStore((state) => state.teams)
  const teamMemberships = useAppStore((state) => state.teamMemberships)
  const users = useAppStore((state) => state.users)
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
