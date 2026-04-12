"use client"

import { useRef, useEffect, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowUp,
  ChatCircle,
  DotsThree,
  Hash,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  Smiley,
  UsersThree,
  VideoCamera,
  X,
} from "@phosphor-icons/react"
import { format, isToday, isYesterday } from "date-fns"
import { toast } from "sonner"

import {
  canEditTeam,
  getChatMessages,
  getChannelPostComments,
  getChannelPosts,
  getConversationParticipants,
  getCurrentWorkspace,
  getPrimaryTeamChannel,
  getTeamBySlug,
  getTeamChannels,
  getTeamChatConversation,
  getUser,
  getWorkspaceChats,
  getWorkspaceUsers,
  teamHasFeature,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SidebarTrigger } from "@/components/ui/sidebar"

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTimestamp(value: string) {
  const d = new Date(value)
  if (isToday(d)) return format(d, "h:mm a")
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`
  return format(d, "MMM d, h:mm a")
}

function formatShortDate(value: string) {
  const d = new Date(value)
  if (isToday(d)) return format(d, "h:mm a")
  if (isYesterday(d)) return "Yesterday"
  return format(d, "MMM d")
}

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */
/* ------------------------------------------------------------------ */

function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Hash className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      {action ?? null}
    </div>
  )
}

function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="size-5 shrink-0" />
        <h1 className="truncate text-sm font-medium">{title}</h1>
        {subtitle ? (
          <span className="hidden truncate text-xs text-muted-foreground xl:inline">
            — {subtitle}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  )
}

function UserAvatar({
  initials,
  size = "sm",
}: {
  initials: string
  size?: "sm" | "default"
}) {
  return (
    <Avatar size={size}>
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}

/* ------------------------------------------------------------------ */
/*  Conversation sidebar (left)                                        */
/* ------------------------------------------------------------------ */

function ConversationList({
  conversations,
  selectedId,
  onSelect,
  renderPreview,
}: {
  conversations: Array<{
    id: string
    title: string
    updatedAt: string
  }>
  selectedId: string | null
  onSelect: (id: string) => void
  renderPreview: (id: string) => string
}) {
  return (
    <div className="flex h-full flex-col border-r">
      <ScrollArea className="flex-1">
        <div className="flex flex-col py-1">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={cn(
                "mx-1 rounded-md px-3 py-2 text-left transition-colors",
                selectedId === conversation.id
                  ? "bg-accent"
                  : "hover:bg-accent/50"
              )}
              onClick={() => onSelect(conversation.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {conversation.title}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {renderPreview(conversation.id)}
                  </div>
                </div>
                <span className="shrink-0 pt-0.5 text-[10px] text-muted-foreground">
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

/* ------------------------------------------------------------------ */
/*  Members sidebar (right)                                            */
/* ------------------------------------------------------------------ */

function MembersSidebar({
  title,
  description,
  members,
}: {
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
}) {
  return (
    <div className="hidden h-full flex-col border-l xl:flex">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-5 p-4">
          {/* About */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              About
            </h3>
            <p className="mt-2 text-sm font-medium">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>

          {/* Members */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Members · {members.length}
            </h3>
            <div className="mt-3 flex flex-col gap-0.5">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <UserAvatar initials={member.avatarUrl} />
                  <div className="min-w-0">
                    <div className="truncate text-sm">{member.name}</div>
                    {member.title ? (
                      <div className="truncate text-[11px] text-muted-foreground">
                        {member.title}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

function TeamSurfaceSidebarContent({
  label,
  title,
  description,
  members,
}: {
  label: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Card size="sm" className="bg-gradient-to-br from-background to-muted/35">
        <CardHeader className="border-b">
          <Badge
            variant="outline"
            className="h-6 w-fit px-2.5 text-[10px] uppercase tracking-[0.18em]"
          >
            {label}
          </Badge>
          <CardTitle className="mt-2 text-sm">{title}</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-3">
          <p className="text-xs text-muted-foreground">
            Shared with the full team and kept in sync in real time.
          </p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Members · {members.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 pt-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent/40"
            >
              <UserAvatar initials={member.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.name}</p>
                {member.title ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {member.title}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function TeamSurfaceSidebar({
  label,
  title,
  description,
  members,
}: {
  label: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
}) {
  return (
    <aside className="hidden h-full border-l xl:flex xl:w-[19rem]">
      <ScrollArea className="flex-1">
        <TeamSurfaceSidebarContent
          label={label}
          title={title}
          description={description}
          members={members}
        />
      </ScrollArea>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/*  Chat composer                                                      */
/* ------------------------------------------------------------------ */

function ChatComposer({
  placeholder = "Write a message…",
  onSend,
}: {
  placeholder?: string
  onSend: (content: string) => void
}) {
  const [content, setContent] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [content])

  const handleSend = () => {
    if (!content.trim()) return
    onSend(content)
    setContent("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-end gap-2 rounded-lg border bg-card px-3 py-2.5 shadow-sm focus-within:ring-1 focus-within:ring-ring/40">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="min-h-[1.5rem] max-h-40 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <Smiley className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!content.trim()}
            className={cn(
              "flex size-6 items-center justify-center rounded-md transition-colors",
              content.trim()
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground/50"
            )}
          >
            <ArrowUp className="size-3.5" weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Chat thread                                                        */
/* ------------------------------------------------------------------ */

function ChatThread({
  conversationId,
  title,
  description,
  members,
  showHeader = true,
}: {
  conversationId: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
  showHeader?: boolean
}) {
  const data = useAppStore()
  const messages = getChatMessages(data, conversationId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  return (
    <div className="flex h-full flex-col">
      {showHeader ? (
        <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{title}</span>
            {description ? (
              <span className="hidden truncate text-xs text-muted-foreground 2xl:inline">
                {description}
              </span>
            ) : null}
            <span className="hidden text-xs text-muted-foreground xl:inline">
              {members.length} members
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon-xs"
              variant="ghost"
              className="size-7"
              onClick={() =>
                toast.message("100MS placeholder", {
                  description:
                    "Video wiring is parked here until you provide the keys.",
                })
              }
            >
              <VideoCamera className="size-3.5" />
            </Button>
            <Button size="icon-xs" variant="ghost" className="size-7">
              <MagnifyingGlass className="size-3.5" />
            </Button>
            <Button size="icon-xs" variant="ghost" className="size-7">
              <DotsThree className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Messages */}
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mt-auto" />
        <div className="flex flex-col gap-0.5 px-4 py-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <PaperPlaneTilt className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No messages yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start the conversation below.
              </p>
            </div>
          ) : (
            messages.map((message, idx) => {
              const author = getUser(data, message.createdBy)
              const prevMessage = messages[idx - 1]
              const sameAuthor = prevMessage?.createdBy === message.createdBy
              const withinMinute =
                prevMessage &&
                new Date(message.createdAt).getTime() -
                  new Date(prevMessage.createdAt).getTime() <
                  60_000

              // Compact follow-up from same author
              if (sameAuthor && withinMinute) {
                return (
                  <div
                    key={message.id}
                    className="group flex items-start gap-3 rounded-md px-2 py-0.5 hover:bg-accent/30"
                  >
                    <div className="w-6 shrink-0" />
                    <p className="min-w-0 whitespace-pre-wrap text-sm">
                      {message.content}
                    </p>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                      {format(new Date(message.createdAt), "h:mm a")}
                    </span>
                  </div>
                )
              }

              return (
                <div
                  key={message.id}
                  className={cn(
                    "group flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-accent/30",
                    idx > 0 && !sameAuthor && "mt-3"
                  )}
                >
                  <UserAvatar initials={author?.avatarUrl ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">
                        {author?.name ?? "Unknown"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatTimestamp(message.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">
                      {message.content}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Composer */}
      <ChatComposer
        placeholder={`Message ${title}…`}
        onSend={(content) => {
          useAppStore.getState().sendChatMessage({ conversationId, content })
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Channel post + comments                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Forum post card (channel)                                          */
/* ------------------------------------------------------------------ */

function ForumPostCard({ postId }: { postId: string }) {
  const data = useAppStore()
  const post = data.channelPosts.find((entry) => entry.id === postId) ?? null
  const [reply, setReply] = useState("")
  const [showComments, setShowComments] = useState(true)

  if (!post) return null

  const author = getUser(data, post.createdBy)
  const comments = getChannelPostComments(data, post.id)

  const handleReply = () => {
    if (!reply.trim()) return
    useAppStore.getState().addChannelPostComment({
      postId: post.id,
      content: reply.trim(),
    })
    setReply("")
  }

  return (
    <Card className="overflow-hidden py-0 shadow-sm ring-foreground/8">
      <CardHeader className="border-b py-4">
        <div className="flex items-start gap-3">
          <UserAvatar initials={author?.avatarUrl ?? "?"} size="default" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {author?.name ?? "Unknown"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(post.createdAt)}
              </span>
              <Badge variant="outline" className="h-5 px-2 text-[10px]">
                {comments.length === 0
                  ? "No replies"
                  : `${comments.length} ${comments.length === 1 ? "reply" : "replies"}`}
              </Badge>
            </div>
            {post.title ? (
              <CardTitle className="mt-2 text-base">{post.title}</CardTitle>
            ) : null}
          </div>
          <Button size="icon-xs" variant="ghost" className="size-7 shrink-0">
            <DotsThree className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
          {post.content}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-xs"
            onClick={() => setShowComments((current) => !current)}
          >
            <ChatCircle className="size-4" />
            {showComments ? "Hide discussion" : "Open discussion"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Use the thread below for follow-up and decisions.
          </span>
        </div>
      </CardContent>

      {showComments ? (
        <CardFooter className="flex-col items-stretch gap-3 border-t bg-muted/30">
          {comments.length > 0 ? (
            <div className="flex flex-col gap-3">
              {comments.map((comment) => {
                const commentAuthor = getUser(data, comment.createdBy)

                return (
                  <div
                    key={comment.id}
                    className="rounded-lg bg-background/90 px-3 py-3 ring-1 ring-foreground/6"
                  >
                    <div className="flex gap-2.5">
                      <UserAvatar initials={commentAuthor?.avatarUrl ?? "?"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium">
                            {commentAuthor?.name ?? "Unknown"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTimestamp(comment.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-background/70 px-3 py-3 text-xs text-muted-foreground">
              No replies yet. Start the thread below.
            </div>
          )}

          <div className="flex items-end gap-2 rounded-lg bg-background px-3 py-2.5 ring-1 ring-foreground/8">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleReply()
                }
              }}
              placeholder="Write a reply…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <button
              type="button"
              onClick={handleReply}
              disabled={!reply.trim()}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                reply.trim()
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground/40"
              )}
            >
              <ArrowUp className="size-3.5" weight="bold" />
            </button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  New chat dialog — search-based user picker                         */
/* ------------------------------------------------------------------ */

function CreateWorkspaceChatDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (conversationId: string) => void
}) {
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)
  const allUsers = workspace
    ? getWorkspaceUsers(data, workspace.id).filter(
        (user) => user.id !== data.currentUserId
      )
    : []

  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [groupName, setGroupName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const isGroup = participantIds.length > 1
  const query = search.toLowerCase().trim()
  const filteredUsers =
    !query
      ? allUsers
      : allUsers.filter(
          (user) =>
            user.name.toLowerCase().includes(query) ||
            user.handle.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
        )

  // Users not yet selected
  const availableUsers = filteredUsers.filter(
    (user) => !participantIds.includes(user.id)
  )

  // Selected user objects
  const selectedUsers = participantIds
    .map((id) => allUsers.find((u) => u.id === id))
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
      // Reset
      setParticipantIds([])
      setSearch("")
      setGroupName("")
    }
  }

  if (!workspace) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setParticipantIds([])
          setSearch("")
          setGroupName("")
        }
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* To field */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="shrink-0 text-sm text-muted-foreground">To:</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {selectedUsers.map((user) => (
              <span
                key={user.id}
                className="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs"
              >
                <UserAvatar initials={user.avatarUrl} />
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
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Backspace to remove last user when input is empty
                if (
                  e.key === "Backspace" &&
                  !search &&
                  participantIds.length > 0
                ) {
                  removeUser(participantIds[participantIds.length - 1])
                }
                // Enter to select first result
                if (e.key === "Enter" && availableUsers.length > 0) {
                  e.preventDefault()
                  addUser(availableUsers[0].id)
                }
              }}
              placeholder={
                participantIds.length === 0
                  ? "Search people…"
                  : "Add another…"
              }
              className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Group name — only shown when 2+ people selected */}
        {isGroup ? (
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <span className="shrink-0 text-sm text-muted-foreground">
              Name:
            </span>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (optional)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        ) : null}

        {/* User results list */}
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
                  <UserAvatar initials={user.avatarUrl} size="default" />
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

        {/* Footer */}
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

/* ------------------------------------------------------------------ */
/*  New-post composer (forum-style, title + body)                       */
/* ------------------------------------------------------------------ */

function NewPostComposer({
  channelId,
  teamName,
}: {
  channelId: string
  teamName: string
}) {
  const data = useAppStore()
  const currentUser = getUser(data, data.currentUserId)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [content])

  const handlePost = () => {
    if (!content.trim()) return
    useAppStore.getState().createChannelPost({
      conversationId: channelId,
      title: title.trim(),
      content: content.trim(),
    })
    setTitle("")
    setContent("")
    setOpen(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full text-left">
        <Card className="bg-background/95 py-0 transition-shadow hover:shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <UserAvatar initials={currentUser?.avatarUrl ?? "?"} size="default" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Start a new post</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Share an update with {teamName}. Replies will stay grouped in
                the thread underneath.
              </p>
            </div>
            <Badge variant="outline" className="h-6 px-2.5">
              <Plus className="size-3.5" />
              Post
            </Badge>
          </CardContent>
        </Card>
      </button>
    )
  }

  return (
    <Card className="overflow-hidden py-0 shadow-sm ring-foreground/8">
      <CardHeader className="border-b py-4">
        <div className="flex items-start gap-3">
          <UserAvatar initials={currentUser?.avatarUrl ?? "?"} size="default" />
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title (optional)"
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50"
              autoFocus
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Write something useful for the team to react to asynchronously.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              e.preventDefault()
              handlePost()
            }
          }}
          placeholder="Write your post…"
          rows={4}
          className="w-full min-h-[5rem] max-h-[220px] resize-none bg-transparent text-sm leading-7 outline-none placeholder:text-muted-foreground/50"
        />
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Press `Cmd + Enter` to publish quickly.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setTitle("")
              setContent("")
              setOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handlePost}
            disabled={!content.trim()}
          >
            Post
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Screen: Workspace chats                                            */
/* ------------------------------------------------------------------ */

export function WorkspaceChatsScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)
  const chats = workspace ? getWorkspaceChats(data, workspace.id) : []
  const [dialogOpen, setDialogOpen] = useState(false)

  if (!workspace) {
    return (
      <EmptyState
        title="Workspace not found"
        description="Select a workspace first."
      />
    )
  }

  const selectedChatId = searchParams.get("chatId")
  const activeChatId =
    selectedChatId && chats.some((c) => c.id === selectedChatId)
      ? selectedChatId
      : chats[0]?.id ?? null
  const activeChat =
    chats.find((c) => c.id === activeChatId) ?? chats[0] ?? null
  const members = getConversationParticipants(data, activeChat)

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <PageHeader
        title="Chats"
        subtitle="Direct and group conversations"
        actions={
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-3.5" />
            New chat
          </Button>
        }
      />
      <CreateWorkspaceChatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) =>
          router.replace(`/chats?chatId=${id}`, { scroll: false })
        }
      />
      {chats.length === 0 ? (
        <EmptyState
          title="No chats yet"
          description="Create a direct or group chat with people in the workspace."
          action={
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="size-3.5" />
              Create chat
            </Button>
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_16rem]">
          <ConversationList
            conversations={chats}
            selectedId={activeChat?.id ?? null}
            onSelect={(id) =>
              router.replace(`/chats?chatId=${id}`, { scroll: false })
            }
            renderPreview={(id) => {
              const latest = getChatMessages(data, id).at(-1)
              return latest?.content ?? "Open the conversation"
            }}
          />
          <div className="flex min-h-0 flex-col">
            {activeChat ? (
              <ChatThread
                conversationId={activeChat.id}
                title={activeChat.title}
                description={activeChat.description || "Workspace chat"}
                members={members}
              />
            ) : null}
          </div>
          <MembersSidebar
            title={activeChat?.title ?? "Chat"}
            description={
              activeChat?.description || "Workspace conversation"
            }
            members={members}
          />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Screen: Team chat                                                  */
/* ------------------------------------------------------------------ */

export function TeamChatScreen({ teamSlug }: { teamSlug: string }) {
  const data = useAppStore()
  const team = getTeamBySlug(data, teamSlug)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const editable = team ? canEditTeam(data, team.id) : false
  const conversation = team ? getTeamChatConversation(data, team.id) : null
  const members = team ? getConversationParticipants(data, conversation) : []
  const teamDescription =
    team?.settings.summary ||
    `One live conversation for everyone working in ${team?.name ?? "this team"}.`

  useEffect(() => {
    if (!team || !teamHasFeature(team, "chat") || !editable || conversation) {
      return
    }

    useAppStore.getState().ensureTeamChat({
      teamId: team.id,
      title: "",
      description: "",
    })
  }, [conversation, editable, team])

  if (!team) {
    return (
      <EmptyState
        title="Team not found"
        description="The requested team does not exist."
      />
    )
  }

  if (!teamHasFeature(team, "chat")) {
    return (
      <EmptyState
        title="Chat is disabled"
        description={`${team.name} is currently configured without team chat.`}
      />
    )
  }

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <PageHeader
        title={team.name}
        subtitle="Chat"
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs xl:hidden"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <UsersThree className="size-3.5" />
              Details
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hidden h-7 gap-1.5 text-xs xl:inline-flex"
              onClick={() => setSidebarOpen((current) => !current)}
            >
              <UsersThree className="size-3.5" />
              {sidebarOpen ? "Hide details" : "Show details"}
            </Button>
          </>
        }
      />
      {!conversation ? (
        <EmptyState
          title={editable ? "Setting up team chat" : "Team chat unavailable"}
          description={
            editable
              ? "The shared team chat is created automatically for this team space."
              : "An admin needs to finish setting up the shared team chat."
          }
        />
      ) : (
        <div
          className={cn(
            "grid min-h-0 flex-1 grid-cols-1",
            sidebarOpen && "xl:grid-cols-[minmax(0,1fr)_19rem]"
          )}
        >
          <div className="min-h-0 flex flex-col">
            <ChatThread
              conversationId={conversation.id}
              title={team.name}
              description={teamDescription}
              members={members}
              showHeader
            />
          </div>

          {sidebarOpen ? (
            <TeamSurfaceSidebar
              label="Team chat"
              title={team.name}
              description={teamDescription}
              members={members}
            />
          ) : null}
        </div>
      )}

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="right" className="w-full max-w-sm p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{team.name}</SheetTitle>
            <SheetDescription>Team chat details</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <TeamSurfaceSidebarContent
              label="Team chat"
              title={team.name}
              description={teamDescription}
              members={members}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Screen: Team channels (forum layout)                               */
/* ------------------------------------------------------------------ */

export function TeamChannelsScreen({ teamSlug }: { teamSlug: string }) {
  const data = useAppStore()
  const team = getTeamBySlug(data, teamSlug)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const channels = team ? getTeamChannels(data, team.id) : []
  const editable = team ? canEditTeam(data, team.id) : false
  const activeChannel = team ? getPrimaryTeamChannel(data, team.id) : null
  const members = activeChannel
    ? getConversationParticipants(data, activeChannel)
    : []
  const posts = channels
    .flatMap((channel) => getChannelPosts(data, channel.id))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const teamDescription =
    team?.settings.summary ||
    `Forum-style updates, questions, and threaded decisions for ${team?.name ?? "this team"}.`

  useEffect(() => {
    if (!team || !teamHasFeature(team, "channels") || !editable || activeChannel) return
    useAppStore.getState().createChannel({ teamId: team.id, title: "", description: "" })
  }, [activeChannel, editable, team])

  if (!team) {
    return <EmptyState title="Team not found" description="The requested team does not exist." />
  }

  if (!teamHasFeature(team, "channels")) {
    return (
      <EmptyState
        title="Channels are disabled"
        description={`${team.name} is currently configured without forum-style channels.`}
      />
    )
  }

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <PageHeader
        title={team.name}
        subtitle="Channel"
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs xl:hidden"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <UsersThree className="size-3.5" />
              Details
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hidden h-7 gap-1.5 text-xs xl:inline-flex"
              onClick={() => setSidebarOpen((current) => !current)}
            >
              <UsersThree className="size-3.5" />
              {sidebarOpen ? "Hide details" : "Show details"}
            </Button>
          </>
        }
      />
      {!activeChannel ? (
        <EmptyState
          title={editable ? "Setting up channel" : "Channel unavailable"}
          description={
            editable
              ? "The team channel is being created automatically."
              : "An admin needs to set up the team channel."
          }
        />
      ) : (
        <div
          className={cn(
            "grid min-h-0 flex-1 grid-cols-1",
            sidebarOpen && "xl:grid-cols-[minmax(0,1fr)_19rem]"
          )}
        >
          <div className="min-h-0 overflow-y-auto">
            <div className="mr-auto flex w-full max-w-[84rem] flex-col gap-4 p-4 lg:p-5 xl:pr-6">
              {editable ? (
                <NewPostComposer
                  channelId={activeChannel.id}
                  teamName={team.name}
                />
              ) : null}

              {posts.length === 0 ? (
                <Card className="bg-background/95 shadow-sm">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <Hash className="size-5 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm font-medium">No posts yet</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Start the channel with a post. Replies and decisions will
                      stack underneath it.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-4 pb-5">
                  {posts.map((post) => (
                    <ForumPostCard key={post.id} postId={post.id} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {sidebarOpen ? (
            <TeamSurfaceSidebar
              label="Team channel"
              title={team.name}
              description={teamDescription}
              members={members}
            />
          ) : null}
        </div>
      )}

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="right" className="w-full max-w-sm p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{team.name}</SheetTitle>
            <SheetDescription>Channel details</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <TeamSurfaceSidebarContent
              label="Team channel"
              title={team.name}
              description={teamDescription}
              members={members}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}
