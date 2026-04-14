"use client"

import {
  useRef,
  useEffect,
  useState,
  useEffectEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowUp,
  ArrowSquareOut,
  ChatCircle,
  DotsThree,
  Hash,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  Smiley,
  Trash,
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
  getPrimaryWorkspaceChannel,
  getTeamBySlug,
  getTeamChannels,
  getTeamChatConversation,
  getUser,
  getWorkspaceChannels,
  getWorkspaceChats,
  getWorkspaceUsers,
  teamHasFeature,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { cn, getPlainTextContent, resolveImageAssetSource } from "@/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

const CHANNEL_REACTION_OPTIONS = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "❤️", label: "Love" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "👀", label: "Watching" },
  { emoji: "🚀", label: "Ship it" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "🙌", label: "Nice work" },
  { emoji: "😄", label: "Smile" },
] as const

const WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY = "workspace-chat-list-width"
const WORKSPACE_CHAT_LIST_DEFAULT_WIDTH = 256
const WORKSPACE_CHAT_LIST_MIN_WIDTH = 224
const WORKSPACE_CHAT_LIST_MAX_WIDTH = 420

function clampWorkspaceChatListWidth(value: number) {
  return Math.min(
    WORKSPACE_CHAT_LIST_MAX_WIDTH,
    Math.max(WORKSPACE_CHAT_LIST_MIN_WIDTH, value)
  )
}

function getUserInitials(name: string | null | undefined) {
  const parts = (name ?? "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
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
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4">
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
  name,
  avatarUrl,
  avatarImageUrl,
  size = "sm",
}: {
  name?: string | null
  avatarUrl?: string | null
  avatarImageUrl?: string | null
  size?: "sm" | "default"
}) {
  const imageSrc = resolveImageAssetSource(avatarImageUrl, avatarUrl)

  return (
    <Avatar size={size}>
      {imageSrc ? <AvatarImage src={imageSrc} alt={name ?? "User"} /> : null}
      <AvatarFallback>{getUserInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

function buildCallJoinHref(callId: string) {
  const query = new URLSearchParams({
    callId,
  })

  return `/api/calls/join?${query.toString()}`
}

function parseCallInviteMessage(content: string) {
  const trimmed = content.trim()

  if (!trimmed.startsWith("Started a call")) {
    return null
  }

  const match = trimmed.match(
    /Join call:\s+(https?:\/\/\S+|\/api\/calls\/join\?\S+)/
  )

  if (!match) {
    return null
  }

  return {
    href: match[1],
    title: "Started a call",
  }
}

function CallInviteLauncher({ conversationId }: { conversationId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleLaunch() {
    setLoading(true)

    try {
      const joinHref =
        await useAppStore.getState().startConversationCall(conversationId)

      if (!joinHref) {
        return
      }

      toast.success("Call link added to the thread")
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Failed to start the call"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="icon-xs"
      variant="ghost"
      className="size-7"
      onClick={handleLaunch}
      disabled={loading}
      aria-label="Start call"
    >
      <VideoCamera className="size-3.5" />
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/*  Conversation sidebar (left)                                        */
/* ------------------------------------------------------------------ */

function ConversationList({
  conversations,
  selectedId,
  onSelect,
  renderLeading,
  renderPreview,
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
}) {
  return (
    <div className="flex h-full flex-col border-r">
      <ScrollArea className="flex-1">
        <div className="flex flex-col px-1 py-1">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={cn(
                "block max-w-full overflow-hidden rounded-md px-3 py-2 text-left transition-colors",
                selectedId === conversation.id
                  ? "bg-accent"
                  : "hover:bg-accent/50"
              )}
              onClick={() => onSelect(conversation.id)}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 overflow-hidden">
                  {renderLeading ? (
                    <div className="shrink-0 pt-0.5">
                      {renderLeading(conversation.id)}
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">
                      {conversation.title}
                    </div>
                    <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">
                      {renderPreview(conversation.id)}
                    </div>
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

function MembersSidebarContent({
  title,
  description,
  members,
}: {
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
}) {
  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          About
        </h3>
        <p className="mt-2 text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>

      <div>
        <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Members · {members.length}
        </h3>
        <div className="mt-3 flex flex-col gap-0.5">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50"
            >
              <UserAvatar
                name={member.name}
                avatarImageUrl={member.avatarImageUrl}
                avatarUrl={member.avatarUrl}
              />
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
  )
}

function MembersSidebar({
  open,
  title,
  description,
  members,
}: {
  open: boolean
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
}) {
  return (
    <CollapsibleRightSidebar
      open={open}
      width="16rem"
      containerClassName="hidden xl:block"
    >
      <ScrollArea className="flex-1">
        <MembersSidebarContent
          title={title}
          description={description}
          members={members}
        />
      </ScrollArea>
    </CollapsibleRightSidebar>
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
    <div className="flex flex-col gap-6 p-4">
      {/* About */}
      <div>
        <h3 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {label}
        </h3>
        <p className="mt-2.5 text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      {/* Members */}
      <div>
        <h3 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Members · {members.length}
        </h3>
        <div className="mt-3 flex flex-col gap-0.5">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
            >
              <UserAvatar
                name={member.name}
                avatarImageUrl={member.avatarImageUrl}
                avatarUrl={member.avatarUrl}
              />
              <div className="min-w-0">
                <p className="truncate text-sm">{member.name}</p>
                {member.title ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {member.title}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TeamSurfaceSidebar({
  open,
  label,
  title,
  description,
  members,
}: {
  open: boolean
  label: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
}) {
  return (
    <CollapsibleRightSidebar
      open={open}
      width="19rem"
      containerClassName="hidden xl:block"
    >
      <ScrollArea className="flex-1">
        <TeamSurfaceSidebarContent
          label={label}
          title={title}
          description={description}
          members={members}
        />
      </ScrollArea>
    </CollapsibleRightSidebar>
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
          className="max-h-40 min-h-[1.5rem] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
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
  videoAction,
}: {
  conversationId: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
  showHeader?: boolean
  videoAction?: ReactNode
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
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4">
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
            {videoAction ?? null}
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
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
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
              const nextMessage = messages[idx + 1]
              const isCurrentUser = message.createdBy === data.currentUserId
              const legacyCallInvite =
                message.callId || message.kind === "call"
                  ? null
                  : parseCallInviteMessage(message.content)
              const callJoinHref = message.callId
                ? buildCallJoinHref(message.callId)
                : (legacyCallInvite?.href ?? null)
              const isCallMessage =
                message.kind === "call" ||
                Boolean(message.callId) ||
                Boolean(legacyCallInvite)
              const prevIsCall = Boolean(
                prevMessage &&
                (prevMessage.kind === "call" ||
                  prevMessage.callId ||
                  parseCallInviteMessage(prevMessage.content))
              )
              const nextIsCall = Boolean(
                nextMessage &&
                (nextMessage.kind === "call" ||
                  nextMessage.callId ||
                  parseCallInviteMessage(nextMessage.content))
              )
              const groupedWithPrev =
                !isCallMessage &&
                !prevIsCall &&
                prevMessage?.createdBy === message.createdBy &&
                new Date(message.createdAt).getTime() -
                  new Date(prevMessage.createdAt).getTime() <
                  5 * 60_000
              const groupedWithNext =
                !isCallMessage &&
                !nextIsCall &&
                nextMessage?.createdBy === message.createdBy &&
                new Date(nextMessage.createdAt).getTime() -
                  new Date(message.createdAt).getTime() <
                  5 * 60_000

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex px-4 py-0.5",
                    isCurrentUser ? "justify-end" : "justify-start",
                    idx > 0 && !groupedWithPrev && "mt-3"
                  )}
                >
                  <div
                    className={cn(
                      "flex max-w-[min(78%,42rem)] items-end gap-2",
                      isCurrentUser && "flex-row-reverse"
                    )}
                  >
                    {!isCurrentUser ? (
                      groupedWithPrev ? (
                        <div className="size-8 shrink-0" />
                      ) : (
                        <UserAvatar
                          name={author?.name}
                          avatarImageUrl={author?.avatarImageUrl}
                          avatarUrl={author?.avatarUrl}
                          size="default"
                        />
                      )
                    ) : null}
                    <div
                      className={cn(
                        "flex min-w-0 flex-col",
                        isCurrentUser ? "items-end" : "items-start"
                      )}
                    >
                      {!groupedWithPrev ? (
                        <div
                          className={cn(
                            "mb-1 flex items-center gap-2 px-1",
                            isCurrentUser ? "justify-end" : "justify-start"
                          )}
                        >
                          {!isCurrentUser ? (
                            <span className="text-[11px] font-medium">
                              {author?.name ?? "Unknown"}
                            </span>
                          ) : null}
                          <span className="text-[10px] text-muted-foreground">
                            {formatTimestamp(message.createdAt)}
                          </span>
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap shadow-sm",
                          isCurrentUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                          isCurrentUser
                            ? groupedWithPrev && "rounded-tr-md"
                            : groupedWithPrev && "rounded-tl-md",
                          isCurrentUser
                            ? groupedWithNext && "rounded-br-md"
                            : groupedWithNext && "rounded-bl-md"
                        )}
                      >
                        {callJoinHref ? (
                          <div className="space-y-2 whitespace-normal">
                            <p className="text-sm leading-5">Started a call</p>
                            <Button
                              asChild
                              size="sm"
                              variant={isCurrentUser ? "secondary" : "outline"}
                              className="h-7 text-xs"
                            >
                              <a
                                href={callJoinHref}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ArrowSquareOut className="size-3.5" />
                                Join call
                              </a>
                            </Button>
                          </div>
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>
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
  const [showReplies, setShowReplies] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)

  if (!post) return null

  const author = getUser(data, post.createdBy)
  const conversation =
    data.conversations.find((entry) => entry.id === post.conversationId) ?? null
  const comments = getChannelPostComments(data, post.id)
  const reactions = post.reactions ?? []
  const mentionCandidates =
    conversation && conversation.kind === "channel"
      ? getConversationParticipants(data, conversation)
      : []
  const replyText = getPlainTextContent(reply)
  const canDeletePost = post.createdBy === data.currentUserId

  const handleReply = () => {
    if (!replyText) return
    useAppStore.getState().addChannelPostComment({
      postId: post.id,
      content: reply,
    })
    setReply("")
    setReplyOpen(false)
  }

  const previewComments = comments.slice(-3)
  const hiddenCount = comments.length - previewComments.length

  return (
    <div
      id={post.id}
      className="group/post relative rounded-lg border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="absolute -top-3 right-3 z-10 flex items-center gap-0.5 rounded-md border bg-background p-0.5 opacity-0 shadow-sm transition-opacity group-hover/post:opacity-100">
        <button
          type="button"
          onClick={() => {
            setShowReplies(true)
            setReplyOpen(true)
          }}
          className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChatCircle className="size-4" />
        </button>
        {canDeletePost ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <DotsThree className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  if (window.confirm("Delete this post and its comments?")) {
                    useAppStore.getState().deleteChannelPost(post.id)
                  }
                }}
              >
                <Trash className="size-4" />
                Delete post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="border-l-[3px] border-transparent px-4 py-4 transition-colors hover:border-primary/40">
        <div className="flex items-center gap-2.5">
          <UserAvatar
            name={author?.name}
            avatarImageUrl={author?.avatarImageUrl}
            avatarUrl={author?.avatarUrl}
            size="default"
          />
          <span className="text-sm font-semibold">
            {author?.name ?? "Unknown"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(post.createdAt)}
          </span>
        </div>

        {post.title ? (
          <h3 className="mt-3 text-base leading-snug font-bold">
            {post.title}
          </h3>
        ) : null}

        <RichTextContent
          content={post.content}
          className={cn(
            "text-sm leading-relaxed text-foreground/90 [&_p]:leading-relaxed",
            post.title ? "mt-2" : "mt-3"
          )}
        />

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {reactions.map((reaction) => {
            const active = reaction.userIds.includes(data.currentUserId)

            return (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() =>
                  useAppStore
                    .getState()
                    .toggleChannelPostReaction(post.id, reaction.emoji)
                }
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "bg-background hover:bg-accent"
                )}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.userIds.length}</span>
              </button>
            )
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-7 items-center gap-1.5 rounded-full border border-dashed bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Smiley className="size-3.5" />
                <span>React</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 min-w-44">
              {CHANNEL_REACTION_OPTIONS.map((option) => {
                const active =
                  reactions
                    .find((entry) => entry.emoji === option.emoji)
                    ?.userIds.includes(data.currentUserId) ?? false

                return (
                  <DropdownMenuItem
                    key={option.emoji}
                    onSelect={() => {
                      useAppStore
                        .getState()
                        .toggleChannelPostReaction(post.id, option.emoji)
                    }}
                  >
                    <span className="mr-2 text-base leading-none">
                      {option.emoji}
                    </span>
                    <span className="flex-1">{option.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {active ? "Remove" : "Add"}
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border-t px-4 py-3">
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowReplies(!showReplies)}
            className="mb-2.5 text-xs font-medium text-primary hover:underline"
          >
            {showReplies
              ? "Show less"
              : `Show ${hiddenCount} earlier ${hiddenCount === 1 ? "reply" : "replies"}`}
          </button>
        ) : null}

        {showReplies && hiddenCount > 0 ? (
          <div className="mb-2 flex flex-col gap-0.5">
            {comments.slice(0, hiddenCount).map((comment) => {
              const commentAuthor = getUser(data, comment.createdBy)

              return (
                <div
                  key={comment.id}
                  className="flex gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/30"
                >
                  <UserAvatar
                    name={commentAuthor?.name}
                    avatarImageUrl={commentAuthor?.avatarImageUrl}
                    avatarUrl={commentAuthor?.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {commentAuthor?.name ?? "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimestamp(comment.createdAt)}
                      </span>
                    </div>
                    <RichTextContent
                      content={comment.content}
                      className="mt-0.5 text-sm leading-relaxed"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        {previewComments.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {previewComments.map((comment) => {
              const commentAuthor = getUser(data, comment.createdBy)

              return (
                <div
                  key={comment.id}
                  className="flex gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/30"
                >
                  <UserAvatar
                    name={commentAuthor?.name}
                    avatarImageUrl={commentAuthor?.avatarImageUrl}
                    avatarUrl={commentAuthor?.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {commentAuthor?.name ?? "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimestamp(comment.createdAt)}
                      </span>
                    </div>
                    <RichTextContent
                      content={comment.content}
                      className="mt-0.5 text-sm leading-relaxed"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        {replyOpen ? (
          <div className={cn(previewComments.length > 0 && "mt-3")}>
            <div className="rounded-md border bg-background px-3 py-2">
              <RichTextEditor
                content={reply}
                onChange={setReply}
                compact
                autoFocus
                showToolbar={false}
                placeholder="Reply with @mentions or /commands…"
                mentionCandidates={mentionCandidates}
                onSubmitShortcut={handleReply}
                className="[&_.ProseMirror]:min-h-[2.5rem]"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Use `@` to mention people. Press Cmd/Ctrl + Enter to send.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setReply("")
                    setReplyOpen(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleReply}
                  disabled={!replyText}
                >
                  <ArrowUp className="size-3.5" weight="bold" />
                  Reply
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowReplies(true)
              setReplyOpen(true)
            }}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
              previewComments.length === 0 && "mt-0"
            )}
          >
            <ChatCircle className="size-3.5" />
            Add comment
          </button>
        )}
      </div>
    </div>
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
  const filteredUsers = !query
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
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* To field */}
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
                participantIds.length === 0 ? "Search people…" : "Add another…"
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
                  <UserAvatar
                    name={user.name}
                    avatarImageUrl={user.avatarImageUrl}
                    avatarUrl={user.avatarUrl}
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

function NewPostComposer({ channelId }: { channelId: string }) {
  const data = useAppStore()
  const currentUser = getUser(data, data.currentUserId)
  const conversation =
    data.conversations.find((entry) => entry.id === channelId) ?? null
  const mentionCandidates =
    conversation && conversation.kind === "channel"
      ? getConversationParticipants(data, conversation)
      : []
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const contentText = getPlainTextContent(content)

  const handlePost = () => {
    if (!contentText) return
    useAppStore.getState().createChannelPost({
      conversationId: channelId,
      title: title.trim(),
      content,
    })
    setTitle("")
    setContent("")
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-accent/30"
      >
        <UserAvatar
          name={currentUser?.name}
          avatarImageUrl={currentUser?.avatarImageUrl}
          avatarUrl={currentUser?.avatarUrl}
          size="default"
        />
        <span className="text-sm text-muted-foreground">Post in channel</span>
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex items-start gap-3 px-4 pt-4">
        <UserAvatar
          name={currentUser?.name}
          avatarImageUrl={currentUser?.avatarImageUrl}
          avatarUrl={currentUser?.avatarUrl}
          size="default"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground/50"
          />
          <div className="rounded-md border bg-background px-3 py-2">
            <RichTextEditor
              content={content}
              onChange={setContent}
              compact
              autoFocus
              showToolbar={false}
              placeholder="Write your post with @mentions or /commands…"
              mentionCandidates={mentionCandidates}
              onSubmitShortcut={handlePost}
              className="[&_.ProseMirror]:min-h-[5rem]"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Use `@` to mention people. Press Cmd/Ctrl + Enter to publish.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t px-4 py-2.5">
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
          disabled={!contentText}
        >
          Post
        </Button>
      </div>
    </div>
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [conversationListWidth, setConversationListWidth] = useState(
    WORKSPACE_CHAT_LIST_DEFAULT_WIDTH
  )
  const [conversationListResizing, setConversationListResizing] =
    useState(false)
  const [conversationListWidthReady, setConversationListWidthReady] =
    useState(false)
  const conversationListDragRef = useRef<{
    startX: number
    startWidth: number
  } | null>(null)

  useEffect(() => {
    const storedWidth = window.localStorage.getItem(
      WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY
    )

    if (!storedWidth) {
      setConversationListWidthReady(true)
      return
    }

    const parsedWidth = Number(storedWidth)

    if (!Number.isFinite(parsedWidth)) {
      setConversationListWidthReady(true)
      return
    }

    setConversationListWidth(clampWorkspaceChatListWidth(parsedWidth))
    setConversationListWidthReady(true)
  }, [])

  useEffect(() => {
    if (!conversationListWidthReady) {
      return
    }

    window.localStorage.setItem(
      WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY,
      String(conversationListWidth)
    )
  }, [conversationListWidth, conversationListWidthReady])

  const stopConversationListResize = useEffectEvent(() => {
    conversationListDragRef.current = null
    setConversationListResizing(false)
    document.body.style.removeProperty("cursor")
    document.body.style.removeProperty("user-select")
  })

  const handleConversationListResizeMove = useEffectEvent(
    (event: PointerEvent) => {
      const dragState = conversationListDragRef.current

      if (!dragState) {
        return
      }

      setConversationListWidth(
        clampWorkspaceChatListWidth(
          dragState.startWidth + event.clientX - dragState.startX
        )
      )
    }
  )

  useEffect(() => {
    if (!conversationListResizing) {
      return
    }

    window.addEventListener("pointermove", handleConversationListResizeMove)
    window.addEventListener("pointerup", stopConversationListResize)
    window.addEventListener("pointercancel", stopConversationListResize)

    return () => {
      window.removeEventListener(
        "pointermove",
        handleConversationListResizeMove
      )
      window.removeEventListener("pointerup", stopConversationListResize)
      window.removeEventListener("pointercancel", stopConversationListResize)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
    }
  }, [conversationListResizing])

  function handleConversationListResizeStart(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    conversationListDragRef.current = {
      startX: event.clientX,
      startWidth: conversationListWidth,
    }
    setConversationListResizing(true)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

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
      : (chats[0]?.id ?? null)
  const activeChat =
    chats.find((c) => c.id === activeChatId) ?? chats[0] ?? null
  const members = getConversationParticipants(data, activeChat)

  function renderConversationAvatar(conversationId: string) {
    const conversation = chats.find((entry) => entry.id === conversationId)

    if (!conversation) {
      return <UserAvatar name="Chat" size="default" />
    }

    const participants = conversation.participantIds
      .filter((userId) => userId !== data.currentUserId)
      .map((userId) => getUser(data, userId))
      .filter(
        (
          participant
        ): participant is NonNullable<ReturnType<typeof getUser>> =>
          Boolean(participant)
      )

    if (participants.length <= 1) {
      const participant = participants[0]

      return (
        <UserAvatar
          name={participant?.name ?? conversation.title}
          avatarImageUrl={participant?.avatarImageUrl}
          avatarUrl={participant?.avatarUrl}
          size="default"
        />
      )
    }

    const visibleParticipants = participants.slice(0, 2)
    const overflowCount = participants.length - visibleParticipants.length

    return (
      <AvatarGroup>
        {visibleParticipants.map((participant) => (
          <UserAvatar
            key={participant.id}
            name={participant.name}
            avatarImageUrl={participant.avatarImageUrl}
            avatarUrl={participant.avatarUrl}
            size="default"
          />
        ))}
        {overflowCount > 0 ? (
          <AvatarGroupCount className="text-[10px] font-medium">
            +{overflowCount}
          </AvatarGroupCount>
        ) : null}
      </AvatarGroup>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Chats"
        subtitle="Direct and group conversations"
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
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="size-3.5" />
              New chat
            </Button>
          </>
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
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className="relative shrink-0"
            style={{
              width: `${conversationListWidth}px`,
              flexBasis: `${conversationListWidth}px`,
            }}
          >
            <ConversationList
              conversations={chats}
              selectedId={activeChat?.id ?? null}
              onSelect={(id) =>
                router.replace(`/chats?chatId=${id}`, { scroll: false })
              }
              renderLeading={renderConversationAvatar}
              renderPreview={(id) => {
                const latest = getChatMessages(data, id).at(-1)

                if (!latest) {
                  return "Open the conversation"
                }

                if (latest.kind === "call" || latest.callId) {
                  return "Started a call"
                }

                const callInvite = parseCallInviteMessage(latest.content)
                return callInvite?.title ?? latest.content
              }}
            />
            <button
              type="button"
              aria-label="Resize chat list"
              className={cn(
                "group absolute top-0 -right-1.5 z-10 hidden h-full w-3 cursor-col-resize touch-none md:block",
                conversationListResizing && "bg-accent/20"
              )}
              onPointerDown={handleConversationListResizeStart}
              onDoubleClick={() =>
                setConversationListWidth(WORKSPACE_CHAT_LIST_DEFAULT_WIDTH)
              }
            >
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-y-3 left-1/2 w-px -translate-x-1/2 rounded-full bg-border transition-colors",
                  conversationListResizing
                    ? "bg-foreground/25"
                    : "group-hover:bg-foreground/20"
                )}
              />
            </button>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {activeChat ? (
              <ChatThread
                conversationId={activeChat.id}
                title={activeChat.title}
                description={activeChat.description || "Workspace chat"}
                members={members}
                videoAction={
                  <CallInviteLauncher conversationId={activeChat.id} />
                }
              />
            ) : null}
          </div>
          <MembersSidebar
            open={sidebarOpen}
            title={activeChat?.title ?? "Chat"}
            description={activeChat?.description || "Workspace conversation"}
            members={members}
          />
        </div>
      )}

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="right" className="w-full max-w-sm p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{activeChat?.title ?? "Chat"}</SheetTitle>
            <SheetDescription>Conversation details</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <MembersSidebarContent
              title={activeChat?.title ?? "Chat"}
              description={activeChat?.description || "Workspace conversation"}
              members={members}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Screen: Workspace channel                                          */
/* ------------------------------------------------------------------ */

export function WorkspaceChannelsScreen() {
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const channels = workspace ? getWorkspaceChannels(data, workspace.id) : []
  const activeChannel = workspace
    ? getPrimaryWorkspaceChannel(data, workspace.id)
    : null
  const members = activeChannel
    ? getConversationParticipants(data, activeChannel)
    : []
  const posts = channels
    .flatMap((channel) => getChannelPosts(data, channel.id))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const workspaceDescription =
    workspace?.settings.description ||
    "Forum-style updates, questions, and threaded decisions for the entire workspace."

  useEffect(() => {
    if (!workspace || activeChannel) {
      return
    }

    useAppStore.getState().createChannel({
      workspaceId: workspace.id,
      silent: true,
      title: "",
      description: "",
    })
  }, [activeChannel, workspace])

  if (!workspace) {
    return (
      <EmptyState
        title="Workspace not found"
        description="Select a workspace first."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Channel"
        subtitle="Workspace-wide updates"
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
          title="Setting up workspace channel"
          description="The shared workspace channel is being created automatically."
        />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl space-y-4 px-5 py-5">
              <NewPostComposer channelId={activeChannel.id} />

              {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <Hash className="size-5 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-sm font-medium">No posts yet</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Start a workspace discussion by creating the first post.
                  </p>
                </div>
              ) : (
                posts.map((post) => (
                  <ForumPostCard key={post.id} postId={post.id} />
                ))
              )}
            </div>
          </div>
          <TeamSurfaceSidebar
            open={sidebarOpen}
            label="Workspace channel"
            title={workspace.name}
            description={workspaceDescription}
            members={members}
          />
        </div>
      )}

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="right" className="w-full max-w-sm p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{workspace.name}</SheetTitle>
            <SheetDescription>Channel details</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <TeamSurfaceSidebarContent
              label="Workspace channel"
              title={workspace.name}
              description={workspaceDescription}
              members={members}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
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
    <div className="flex min-h-0 flex-1 flex-col">
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
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ChatThread
              conversationId={conversation.id}
              title="Team chat"
              description=""
              members={members}
              showHeader
              videoAction={
                editable ? (
                  <CallInviteLauncher conversationId={conversation.id} />
                ) : null
              }
            />
          </div>
          <TeamSurfaceSidebar
            open={sidebarOpen}
            label="Team chat"
            title={team.name}
            description={teamDescription}
            members={members}
          />
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
    if (
      !team ||
      !teamHasFeature(team, "channels") ||
      !editable ||
      activeChannel
    )
      return
    useAppStore.getState().createChannel({
      teamId: team.id,
      silent: true,
      title: "",
      description: "",
    })
  }, [activeChannel, editable, team])

  if (!team) {
    return (
      <EmptyState
        title="Team not found"
        description="The requested team does not exist."
      />
    )
  }

  if (!teamHasFeature(team, "channels")) {
    return (
      <EmptyState
        title="Channel is disabled"
        description={`${team.name} is currently configured without a forum-style channel.`}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl space-y-4 px-5 py-5">
              {/* Composer at top */}
              {editable ? (
                <NewPostComposer channelId={activeChannel.id} />
              ) : null}

              {/* Posts feed */}
              {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <Hash className="size-5 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-sm font-medium">No posts yet</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Start a discussion by creating the first post.
                  </p>
                </div>
              ) : (
                posts.map((post) => (
                  <ForumPostCard key={post.id} postId={post.id} />
                ))
              )}
            </div>
          </div>
          <TeamSurfaceSidebar
            open={sidebarOpen}
            label="Team channel"
            title={team.name}
            description={teamDescription}
            members={members}
          />
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
