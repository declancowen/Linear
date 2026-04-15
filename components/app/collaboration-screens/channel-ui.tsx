"use client"

import { useMemo, useState } from "react"
import {
  ArrowUp,
  ChatCircle,
  DotsThree,
  Smiley,
  Trash,
} from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import {
  getChannelPostComments,
  getConversationParticipants,
  getUser,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { cn, getPlainTextContent } from "@/lib/utils"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { UserAvatar, UserHoverCard } from "@/components/app/user-presence"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatTimestamp } from "@/components/app/collaboration-screens/utils"

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

export function ForumPostCard({ postId }: { postId: string }) {
  const { currentUserId, currentWorkspaceId, post } = useAppStore(
    useShallow((state) => ({
      currentUserId: state.currentUserId,
      currentWorkspaceId: state.currentWorkspaceId,
      post: state.channelPosts.find((entry) => entry.id === postId) ?? null,
    }))
  )
  const users = useAppStore((state) => state.users)
  const comments = useAppStore(
    useShallow((state) => getChannelPostComments(state, postId))
  )
  const mentionCandidates = useAppStore(
    useShallow((state) => {
      const conversation =
        state.conversations.find((entry) => entry.id === post?.conversationId) ??
        null

      return conversation && conversation.kind === "channel"
        ? getConversationParticipants(state, conversation)
        : []
    })
  )
  const [reply, setReply] = useState("")
  const [showReplies, setShowReplies] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [deletePostOpen, setDeletePostOpen] = useState(false)
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )

  if (!post) return null
  const author = usersById.get(post.createdBy)
  const reactions = post.reactions ?? []
  const replyText = getPlainTextContent(reply)
  const canDeletePost = post.createdBy === currentUserId

  const handleReply = () => {
    if (!replyText) return
    useAppStore.getState().addChannelPostComment({
      postId: post.id,
      content: reply,
    })
    setReply("")
    setReplyOpen(false)
  }

  const handleDeletePost = () => {
    useAppStore.getState().deleteChannelPost(post.id)
    setDeletePostOpen(false)
  }

  const previewComments = comments.slice(-3)
  const hiddenCount = comments.length - previewComments.length

  return (
    <div
      id={post.id}
      className="group/post relative rounded-lg border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <UserAvatar
              name={author?.name}
              avatarImageUrl={author?.avatarImageUrl}
              avatarUrl={author?.avatarUrl}
              status={author?.status}
              size="default"
            />
            <UserHoverCard
              user={author}
              userId={author?.id}
              currentUserId={currentUserId}
              workspaceId={currentWorkspaceId}
            >
              <span className="truncate text-sm font-semibold">
                {author?.name ?? "Unknown"}
              </span>
            </UserHoverCard>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTimestamp(post.createdAt)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-md border bg-background p-0.5 opacity-0 shadow-sm transition-opacity group-hover/post:opacity-100">
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
                    onSelect={() => setDeletePostOpen(true)}
                  >
                    <Trash className="size-4" />
                    Delete post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
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
            const active = reaction.userIds.includes(currentUserId)

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
                    ?.userIds.includes(currentUserId) ?? false

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
              const commentAuthor = usersById.get(comment.createdBy)

              return (
                <div
                  key={comment.id}
                  className="flex gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/30"
                >
                  <UserAvatar
                    name={commentAuthor?.name}
                    avatarImageUrl={commentAuthor?.avatarImageUrl}
                    avatarUrl={commentAuthor?.avatarUrl}
                    status={commentAuthor?.status}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <UserHoverCard
                        user={commentAuthor}
                        userId={commentAuthor?.id}
                        currentUserId={currentUserId}
                        workspaceId={currentWorkspaceId}
                      >
                        <span className="text-xs font-medium">
                          {commentAuthor?.name ?? "Unknown"}
                        </span>
                      </UserHoverCard>
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
              const commentAuthor = usersById.get(comment.createdBy)

              return (
                <div
                  key={comment.id}
                  className="flex gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/30"
                >
                  <UserAvatar
                    name={commentAuthor?.name}
                    avatarImageUrl={commentAuthor?.avatarImageUrl}
                    avatarUrl={commentAuthor?.avatarUrl}
                    status={commentAuthor?.status}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <UserHoverCard
                        user={commentAuthor}
                        userId={commentAuthor?.id}
                        currentUserId={currentUserId}
                        workspaceId={currentWorkspaceId}
                      >
                        <span className="text-xs font-medium">
                          {commentAuthor?.name ?? "Unknown"}
                        </span>
                      </UserHoverCard>
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
      <ConfirmDialog
        open={deletePostOpen}
        onOpenChange={setDeletePostOpen}
        title="Delete post"
        description="This post and all its comments will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeletePost}
      />
    </div>
  )
}

export function NewPostComposer({ channelId }: { channelId: string }) {
  const { currentUser, mentionCandidates } = useAppStore(
    useShallow((state) => {
      const conversation =
        state.conversations.find((entry) => entry.id === channelId) ?? null

      return {
        currentUser: getUser(state, state.currentUserId),
        mentionCandidates:
          conversation && conversation.kind === "channel"
            ? getConversationParticipants(state, conversation)
            : [],
      }
    })
  )
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
          status={currentUser?.status}
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
          status={currentUser?.status}
          size="default"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
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
