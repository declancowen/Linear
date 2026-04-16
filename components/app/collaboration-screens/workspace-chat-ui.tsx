"use client"

import { useMemo, useRef, useState, type ReactNode } from "react"
import { X } from "@phosphor-icons/react"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
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

export const WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY =
  "workspace-chat-list-width"
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
    () =>
      workspaces.find((entry) => entry.id === currentWorkspaceId) ?? null,
    [currentWorkspaceId, workspaces]
  )
  const allUsers = useMemo(() => {
    if (!workspace) {
      return []
    }

    const teamIds = new Set(
      teams
        .filter((team) => team.workspaceId === workspace.id)
        .map((team) => team.id)
    )
    const userIds = new Set(
      teamMemberships
        .filter((membership) => teamIds.has(membership.teamId))
        .map((membership) => membership.userId)
    )

    if (workspace.createdBy) {
      userIds.add(workspace.createdBy)
    }

    return users.filter(
      (user) => user.id !== currentUserId && userIds.has(user.id)
    )
  }, [currentUserId, teamMemberships, teams, users, workspace])

  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [groupName, setGroupName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const isGroup = participantIds.length > 1
  const query = search.toLowerCase().trim()
  const filteredUsers = !query
    ? allUsers
    : allUsers.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.handle.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      )

  const availableUsers = filteredUsers.filter(
    (user) => !participantIds.includes(user.id)
  )

  const selectedUsers = participantIds
    .map((id) => allUsers.find((user) => user.id === id))
    .filter(Boolean) as typeof allUsers

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
    if (!workspace || participantIds.length === 0) return
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
                  onClick={() => removeUser(user.id)}
                  className="ml-0.5 rounded-sm text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Backspace" &&
                  !search &&
                  participantIds.length > 0
                ) {
                  removeUser(participantIds[participantIds.length - 1])
                }
                if (event.key === "Enter" && availableUsers.length > 0) {
                  event.preventDefault()
                  addUser(availableUsers[0].id)
                }
              }}
              placeholder={
                participantIds.length === 0 ? "Search people…" : "Add another…"
              }
              className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {isGroup ? (
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <span className="shrink-0 text-sm text-muted-foreground">
              Name:
            </span>
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Group name (optional)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        ) : null}

        <ScrollArea className="max-h-64">
          <div className="flex flex-col py-1">
            {availableUsers.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                {search
                  ? "No people found"
                  : participantIds.length === allUsers.length
                    ? "Everyone has been added"
                    : "Type to search people"}
              </div>
            ) : (
              availableUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => addUser(user.id)}
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
                    <div className="truncate text-sm font-medium">
                      {user.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {user.title || user.handle}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {participantIds.length > 0 ? (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {participantIds.length === 1
                ? "Direct message"
                : `Group · ${participantIds.length} people`}
            </span>
            <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
              {isGroup ? "Create group" : "Start chat"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
