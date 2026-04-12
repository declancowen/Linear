"use client"

import { useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  PaperPlaneTilt,
  Plus,
  VideoCamera,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { toast } from "sonner"

import {
  canEditTeam,
  getChatMessages,
  getChannelPostComments,
  getChannelPosts,
  getConversationParticipants,
  getCurrentWorkspace,
  getTeamBySlug,
  getTeamChannels,
  getTeamChatConversation,
  getTeamMembers,
  getUser,
  getWorkspaceChats,
  getWorkspaceUsers,
  teamHasFeature,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"

function formatTimestamp(value: string) {
  return format(new Date(value), "MMM d, h:mm a")
}

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
    <div className="flex h-full min-h-[24rem] items-center justify-center p-6">
      <Card className="w-full max-w-lg border border-dashed bg-background/70">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {action ? <CardContent>{action}</CardContent> : null}
      </Card>
    </div>
  )
}

function CollaborationHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-6 py-2">
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <SidebarTrigger className="size-6 shrink-0" />
        <h1 className="truncate text-sm font-medium">{title}</h1>
        <div className="hidden min-w-0 items-center gap-2 overflow-hidden text-sm text-muted-foreground xl:flex">
          <span className="shrink-0 text-muted-foreground/60">/</span>
          <span className="truncate">{subtitle}</span>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

function UserAvatar({ initials }: { initials: string }) {
  return (
    <Avatar size="sm">
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}

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
    <div className="border-l">
      <div className="flex h-full flex-col gap-4 p-4">
        <Card size="sm" className="bg-background/70 ring-foreground/8">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm" className="flex-1 bg-background/70 ring-foreground/8">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>{members.length} in this space</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <UserAvatar initials={member.avatarUrl} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{member.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {member.title}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function VideoPlaceholderButton() {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        toast.message("100MS placeholder", {
          description: "Video wiring is parked here until you provide the keys.",
        })
      }}
    >
      <VideoCamera className="size-4" />
      Video
    </Button>
  )
}

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
    <div className="border-r">
      <ScrollArea className="h-full">
        <div className="flex flex-col">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={cn(
                "border-b px-4 py-3 text-left transition-colors",
                selectedId === conversation.id ? "bg-accent" : "hover:bg-accent/50"
              )}
              onClick={() => onSelect(conversation.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{conversation.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {renderPreview(conversation.id)}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] text-muted-foreground">
                  {format(new Date(conversation.updatedAt), "MMM d")}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function ChatThread({
  conversationId,
  title,
  description,
  members,
}: {
  conversationId: string
  title: string
  description: string
  members: ReturnType<typeof getConversationParticipants>
}) {
  const data = useAppStore()
  const messages = getChatMessages(data, conversationId)
  const [content, setContent] = useState("")

  return (
    <>
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="min-w-0">
          <div className="truncate text-base font-medium">{title}</div>
          <div className="truncate text-sm text-muted-foreground">{description}</div>
        </div>
        <div className="flex items-center gap-2">
          <AvatarGroup>
            {members.slice(0, 3).map((member) => (
              <UserAvatar key={member.id} initials={member.avatarUrl} />
            ))}
            {members.length > 3 ? (
              <AvatarGroupCount>+{members.length - 3}</AvatarGroupCount>
            ) : null}
          </AvatarGroup>
          <VideoPlaceholderButton />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 px-6 py-5">
            {messages.map((message) => {
              const author = getUser(data, message.createdBy)
              return (
                <div key={message.id} className="flex gap-3">
                  <UserAvatar initials={author?.avatarUrl ?? "?"} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {author?.name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(message.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                      {message.content}
                    </p>
                  </div>
                </div>
              )
            })}
            {messages.length === 0 ? (
              <EmptyState
                title="No messages yet"
                description="Start the thread. Messages will sync in real time through Convex."
              />
            ) : null}
          </div>
        </ScrollArea>
        <div className="border-t px-6 py-4">
          <div className="flex gap-3">
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write a message"
              className="min-h-24"
            />
            <Button
              className="shrink-0 self-end"
              onClick={() => {
                if (!content.trim()) {
                  return
                }

                useAppStore.getState().sendChatMessage({
                  conversationId,
                  content,
                })
                setContent("")
              }}
            >
              <PaperPlaneTilt className="size-4" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

function ChannelPostCard({ postId }: { postId: string }) {
  const data = useAppStore()
  const post = data.channelPosts.find((entry) => entry.id === postId) ?? null
  const [content, setContent] = useState("")

  if (!post) {
    return null
  }

  const author = getUser(data, post.createdBy)
  const comments = getChannelPostComments(data, post.id)

  return (
    <Card className="bg-background/80 ring-foreground/8">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{post.title}</CardTitle>
            <CardDescription>
              {author?.name ?? "Unknown"} posted {formatTimestamp(post.createdAt)}
            </CardDescription>
          </div>
          <Badge variant="outline">{comments.length} replies</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
          {post.content}
        </p>
        <div className="flex flex-col gap-3 border-t pt-4">
          {comments.map((comment) => {
            const commentAuthor = getUser(data, comment.createdBy)
            return (
              <div key={comment.id} className="flex gap-3">
                <UserAvatar initials={commentAuthor?.avatarUrl ?? "?"} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {commentAuthor?.name ?? "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                    {comment.content}
                  </p>
                </div>
              </div>
            )
          })}
          <div className="flex gap-3">
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Reply to this post"
              className="min-h-20"
            />
            <Button
              className="shrink-0 self-end"
              onClick={() => {
                if (!content.trim()) {
                  return
                }

                useAppStore.getState().addChannelPostComment({
                  postId: post.id,
                  content,
                })
                setContent("")
              }}
            >
              <PaperPlaneTilt className="size-4" />
              Reply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

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
  const users = workspace
    ? getWorkspaceUsers(data, workspace.id).filter(
        (user) => user.id !== data.currentUserId
      )
    : []
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  if (!workspace) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={`${workspace.id}-${open}`} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>
            Pick one workspace member for a direct chat or several for a group chat.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Optional title for a group chat"
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional chat description"
          />
          <div className="flex flex-wrap gap-2 rounded-xl border p-3">
            {users.map((user) => {
              const selected = participantIds.includes(user.id)

              return (
                <Button
                  key={user.id}
                  type="button"
                  size="sm"
                  variant={selected ? "secondary" : "outline"}
                  onClick={() =>
                    setParticipantIds((current) =>
                      current.includes(user.id)
                        ? current.filter((value) => value !== user.id)
                        : [...current, user.id]
                    )
                  }
                >
                  {user.name}
                </Button>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const conversationId = useAppStore.getState().createWorkspaceChat({
                workspaceId: workspace.id,
                participantIds,
                title,
                description,
              })

              if (conversationId) {
                onCreated(conversationId)
                onOpenChange(false)
              }
            }}
          >
            Create chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateTeamChatDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  teamName: string
  onCreated: (conversationId: string) => void
}) {
  const [title, setTitle] = useState(`${teamName} chat`)
  const [description, setDescription] = useState(
    "Real-time team conversation for quick coordination."
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={`${teamId}-${open}`}>
        <DialogHeader>
          <DialogTitle>Create team chat</DialogTitle>
          <DialogDescription>
            This creates the shared real-time chat surface for {teamName}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this chat is for"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const conversationId = useAppStore.getState().ensureTeamChat({
                teamId,
                title,
                description,
              })

              if (conversationId) {
                onCreated(conversationId)
                onOpenChange(false)
              }
            }}
          >
            Create chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateChannelDialog({
  open,
  onOpenChange,
  teamId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  onCreated: (conversationId: string) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={`${teamId}-${open}`}>
        <DialogHeader>
          <DialogTitle>Create channel</DialogTitle>
          <DialogDescription>
            Channels are slower, post-first spaces where replies live under each post.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Channel name"
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What the channel is about"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const conversationId = useAppStore.getState().createChannel({
                teamId,
                title,
                description,
              })

              if (conversationId) {
                onCreated(conversationId)
                onOpenChange(false)
              }
            }}
          >
            Create channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function WorkspaceChatsScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)
  const chats = workspace ? getWorkspaceChats(data, workspace.id) : []
  const [dialogOpen, setDialogOpen] = useState(false)

  if (!workspace) {
    return <EmptyState title="Workspace not found" description="Select a workspace first." />
  }

  const selectedChatId = searchParams.get("chatId")
  const activeChatId =
    selectedChatId && chats.some((chat) => chat.id === selectedChatId)
      ? selectedChatId
      : chats[0]?.id ?? null
  const activeChat =
    chats.find((conversation) => conversation.id === activeChatId) ?? chats[0] ?? null
  const members = getConversationParticipants(data, activeChat)

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <CollaborationHeader
        title="Chats"
        subtitle="Direct and group conversations across the workspace."
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New chat
          </Button>
        }
      />
      <CreateWorkspaceChatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(conversationId) =>
          router.replace(`/chats?chatId=${conversationId}`, { scroll: false })
        }
      />
      {chats.length === 0 ? (
        <EmptyState
          title="No chats yet"
          description="Create a direct or group chat with people in the workspace."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Create chat
            </Button>
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 xl:grid-cols-[18rem_minmax(0,1fr)_18rem]">
          <ConversationList
            conversations={chats}
            selectedId={activeChat?.id ?? null}
            onSelect={(conversationId) =>
              router.replace(`/chats?chatId=${conversationId}`, { scroll: false })
            }
            renderPreview={(conversationId) => {
              const latest = getChatMessages(data, conversationId).at(-1)
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
            description={activeChat?.description || "Workspace conversation"}
            members={members}
          />
        </div>
      )}
    </div>
  )
}

export function TeamChatScreen({ teamSlug }: { teamSlug: string }) {
  const data = useAppStore()
  const team = getTeamBySlug(data, teamSlug)
  const [dialogOpen, setDialogOpen] = useState(false)

  if (!team) {
    return <EmptyState title="Team not found" description="The requested team does not exist." />
  }

  if (!teamHasFeature(team, "chat")) {
    return (
      <EmptyState
        title="Chat is disabled"
        description={`${team.name} is currently configured without team chat.`}
      />
    )
  }

  const editable = canEditTeam(data, team.id)
  const conversation = getTeamChatConversation(data, team.id)

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <CollaborationHeader
        title={`${team.name} chat`}
        subtitle="Real-time conversation for the current team."
        actions={
          !conversation && editable ? (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Create chat
            </Button>
          ) : null
        }
      />
      <CreateTeamChatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamId={team.id}
        teamName={team.name}
        onCreated={() => undefined}
      />
      {!conversation ? (
        <EmptyState
          title="No team chat yet"
          description="Create the shared team chat to start real-time discussion."
          action={
            editable ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Create team chat
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-h-0 flex-col">
            <ChatThread
              conversationId={conversation.id}
              title={conversation.title}
              description={conversation.description || team.settings.summary}
              members={getConversationParticipants(data, conversation)}
            />
          </div>
          <MembersSidebar
            title={conversation.title}
            description={conversation.description || team.settings.summary}
            members={getConversationParticipants(data, conversation)}
          />
        </div>
      )}
    </div>
  )
}

export function TeamChannelsScreen({ teamSlug }: { teamSlug: string }) {
  const data = useAppStore()
  const team = getTeamBySlug(data, teamSlug)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [postTitle, setPostTitle] = useState("")
  const [postContent, setPostContent] = useState("")

  const channels = team ? getTeamChannels(data, team.id) : []

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

  const editable = canEditTeam(data, team.id)
  const activeChannelId =
    selectedChannelId && channels.some((channel) => channel.id === selectedChannelId)
      ? selectedChannelId
      : channels[0]?.id ?? null

  const activeChannel =
    channels.find((conversation) => conversation.id === activeChannelId) ??
    channels[0] ??
    null
  const members = activeChannel
    ? getConversationParticipants(data, activeChannel)
    : getTeamMembers(data, team.id)
  const posts = activeChannel ? getChannelPosts(data, activeChannel.id) : []

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <CollaborationHeader
        title={`${team.name} channels`}
        subtitle="Post-first spaces for announcements, proposals, and threaded discussion."
        actions={
          editable ? (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              New channel
            </Button>
          ) : null
        }
      />
      <CreateChannelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamId={team.id}
        onCreated={setSelectedChannelId}
      />
      {channels.length === 0 ? (
        <EmptyState
          title="No channels yet"
          description="Create the first channel for structured team discussion."
          action={
            editable ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Create channel
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 xl:grid-cols-[18rem_minmax(0,1fr)_18rem]">
          <ConversationList
            conversations={channels}
            selectedId={activeChannel?.id ?? null}
            onSelect={setSelectedChannelId}
            renderPreview={(conversationId) => {
              const latestPost = getChannelPosts(data, conversationId)[0]
              return latestPost?.title ?? "Open the channel"
            }}
          />
          <div className="flex min-h-0 flex-col">
            {activeChannel ? (
              <>
                <div className="border-b px-6 py-3">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-medium">{activeChannel.title}</div>
                    <Badge variant="secondary">Channel</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {activeChannel.description}
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="flex flex-col gap-4 px-6 py-5">
                    {editable ? (
                      <Card className="bg-background/80 ring-foreground/8">
                        <CardHeader>
                          <CardTitle>New post</CardTitle>
                          <CardDescription>
                            Share an update and let replies stack underneath it.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          <Input
                            value={postTitle}
                            onChange={(event) => setPostTitle(event.target.value)}
                            placeholder="Post title"
                          />
                          <Textarea
                            value={postContent}
                            onChange={(event) => setPostContent(event.target.value)}
                            placeholder="What do you want to share?"
                            className="min-h-28"
                          />
                          <div className="flex justify-end">
                            <Button
                              onClick={() => {
                                if (!activeChannel) {
                                  return
                                }

                                if (!postTitle.trim() || !postContent.trim()) {
                                  return
                                }

                                useAppStore.getState().createChannelPost({
                                  conversationId: activeChannel.id,
                                  title: postTitle,
                                  content: postContent,
                                })
                                setPostTitle("")
                                setPostContent("")
                              }}
                            >
                              Publish post
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}
                    {posts.map((post) => (
                      <ChannelPostCard key={post.id} postId={post.id} />
                    ))}
                    {posts.length === 0 ? (
                      <EmptyState
                        title="No posts yet"
                        description="Start the channel with a post. Replies will stack under it."
                      />
                    ) : null}
                  </div>
                </ScrollArea>
              </>
            ) : null}
          </div>
          <MembersSidebar
            title={activeChannel?.title ?? `${team.name} channels`}
            description={
              activeChannel?.description || "Channel members and context for this team space."
            }
            members={members}
          />
        </div>
      )}
    </div>
  )
}
