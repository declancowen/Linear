"use client"

import { useMemo, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import {
  ArrowUp,
  ChatCircle,
  DotsThree,
  PaperPlaneTilt,
  Smiley,
  Trash,
} from "@phosphor-icons/react"
import { useShallow } from "zustand/react/shallow"

import {
  getChannelPostComments,
  getConversationParticipants,
} from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"
import { cn, getPlainTextContent } from "@/lib/utils"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { ShortcutKeys } from "@/components/app/shortcut-keys"
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
        ? getConversationParticipants(state, conversation).filter(
            (candidate) => candidate.id !== state.currentUserId
          )
        : []
    })
  )
  const [reply, setReply] = useState("")
  const [showReplies, setShowReplies] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [deletePostOpen, setDeletePostOpen] = useState(false)
  const replyEditorRef = useRef<Editor | null>(null)
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
  const handleInsertReplyEmoji = (emoji: string) => {
    replyEditorRef.current?.chain().focus().insertContent(emoji).run()
  }

  const previewComments = comments.slice(-3)
  const hiddenCount = comments.length - previewComments.length

  return (
    <div
      id={post.id}
      className="group/post relative grid gap-2.5 border-b border-line-soft px-[18px] py-2.5 transition-colors hover:bg-surface-2"
      style={{ gridTemplateColumns: "36px 1fr" }}
    >
      <div className="mt-[1px]">
        <UserAvatar
          name={author?.name}
          avatarImageUrl={author?.avatarImageUrl}
          avatarUrl={author?.avatarUrl}
          status={author?.status}
          size="default"
          className="size-9 text-[13px]"
        />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <UserHoverCard
            user={author}
            userId={author?.id}
            currentUserId={currentUserId}
            workspaceId={currentWorkspaceId}
          >
            <span className="truncate text-[14px] font-semibold text-foreground">
              {author?.name ?? "Unknown"}
            </span>
          </UserHoverCard>
          <span className="shrink-0 text-[11.5px] text-fg-3">
            {formatTimestamp(post.createdAt)}
          </span>
        </div>
        <div className="absolute top-1.5 right-4 hidden items-center gap-0.5 rounded-md border border-line bg-surface p-0.5 shadow-sm group-hover/post:flex">
          <EmojiPickerPopover
            align="end"
            side="bottom"
            onEmojiSelect={(emoji) => {
              useAppStore
                .getState()
                .toggleChannelPostReaction(post.id, emoji)
            }}
            trigger={
              <button
                type="button"
                aria-label="React"
                className="inline-grid size-7 place-items-center rounded text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground"
              >
                <Smiley className="size-[14px]" />
              </button>
            }
          />
          <button
            type="button"
            onClick={() => {
              setShowReplies(true)
              setReplyOpen(true)
            }}
            className="inline-grid size-7 place-items-center rounded text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label="Reply"
          >
            <ChatCircle className="size-[14px]" />
          </button>
          {canDeletePost ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-grid size-7 place-items-center rounded text-fg-2 transition-colors hover:bg-surface-3 hover:text-foreground"
                  aria-label="More"
                >
                  <DotsThree className="size-[14px]" weight="bold" />
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

        {post.title ? (
          <h3 className="mt-2 text-[15px] leading-snug font-semibold tracking-[-0.005em] text-foreground">
            {post.title}
          </h3>
        ) : null}

        <RichTextContent
          content={post.content}
          className={cn(
            "text-[13.5px] leading-[1.55] text-foreground [&_p]:leading-[1.55]",
            post.title ? "mt-1.5" : "mt-2"
          )}
        />

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
                  "flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11.5px] tabular-nums transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-line bg-surface text-fg-2 hover:bg-surface-2 hover:text-foreground"
                )}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.userIds.length}</span>
              </button>
            )
          })}

          <EmojiPickerPopover
            align="start"
            side="top"
            onEmojiSelect={(emoji) => {
              useAppStore.getState().toggleChannelPostReaction(post.id, emoji)
            }}
            trigger={
              <button
                type="button"
                className="flex h-6 items-center gap-1.5 rounded-full border border-dashed border-line bg-surface px-2 text-[11.5px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <Smiley className="size-3.5" />
                <span>React</span>
              </button>
            }
          />
        </div>

        <div className="mt-3 border-l-2 border-line-soft pl-3">
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowReplies(!showReplies)}
            className="mb-2 text-[11.5px] font-medium text-fg-3 hover:text-foreground"
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
                  className="grid items-start gap-x-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2"
                  style={{ gridTemplateColumns: "24px 1fr" }}
                >
                  <div className="mt-[2px]">
                    <UserAvatar
                      name={commentAuthor?.name}
                      avatarImageUrl={commentAuthor?.avatarImageUrl}
                      avatarUrl={commentAuthor?.avatarUrl}
                      status={commentAuthor?.status}
                      size="sm"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <UserHoverCard
                        user={commentAuthor}
                        userId={commentAuthor?.id}
                        currentUserId={currentUserId}
                        workspaceId={currentWorkspaceId}
                      >
                        <span className="text-[12.5px] font-semibold text-foreground">
                          {commentAuthor?.name ?? "Unknown"}
                        </span>
                      </UserHoverCard>
                      <span className="text-[11px] text-fg-3">
                        {formatTimestamp(comment.createdAt)}
                      </span>
                    </div>
                    <RichTextContent
                      content={comment.content}
                      className="text-[13px] leading-[1.5] text-foreground [&_p]:leading-[1.5]"
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
                  className="grid items-start gap-x-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2"
                  style={{ gridTemplateColumns: "24px 1fr" }}
                >
                  <div className="mt-[2px]">
                    <UserAvatar
                      name={commentAuthor?.name}
                      avatarImageUrl={commentAuthor?.avatarImageUrl}
                      avatarUrl={commentAuthor?.avatarUrl}
                      status={commentAuthor?.status}
                      size="sm"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <UserHoverCard
                        user={commentAuthor}
                        userId={commentAuthor?.id}
                        currentUserId={currentUserId}
                        workspaceId={currentWorkspaceId}
                      >
                        <span className="text-[12.5px] font-semibold text-foreground">
                          {commentAuthor?.name ?? "Unknown"}
                        </span>
                      </UserHoverCard>
                      <span className="text-[11px] text-fg-3">
                        {formatTimestamp(comment.createdAt)}
                      </span>
                    </div>
                    <RichTextContent
                      content={comment.content}
                      className="text-[13px] leading-[1.5] text-foreground [&_p]:leading-[1.5]"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        {replyOpen ? (
          <div className={cn(previewComments.length > 0 && "mt-2")}>
            <div className="rounded-md border border-line bg-surface px-3 py-2">
              <RichTextEditor
                content={reply}
                onChange={setReply}
                compact
                autoFocus
                showToolbar={false}
                placeholder="Reply with @mentions or /commands…"
                editorInstanceRef={replyEditorRef}
                mentionCandidates={mentionCandidates}
                onSubmitShortcut={handleReply}
                submitOnEnter
                className="[&_.ProseMirror]:min-h-[2.25rem] [&_.ProseMirror]:text-[13px]"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <EmojiPickerPopover
                  align="start"
                  side="top"
                  onEmojiSelect={handleInsertReplyEmoji}
                  trigger={
                    <button
                      type="button"
                      className="rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <Smiley className="size-4" />
                    </button>
                  }
                />
                <span className="text-[11.5px] text-fg-3">
                  Use `@` to mention people. Press Enter to send.
                </span>
              </div>
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
              "flex w-full items-center gap-2 rounded-md border border-dashed border-line px-2.5 py-1.5 text-left text-[12px] text-fg-3 transition-colors hover:border-fg-4 hover:text-fg-2",
              previewComments.length > 0 ? "mt-1.5" : "mt-0"
            )}
          >
            <ChatCircle className="size-3.5" />
            Reply to this thread…
          </button>
        )}
        </div>
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
  const currentUserId = useAppStore((state) => state.currentUserId)
  const conversations = useAppStore((state) => state.conversations)
  const workspaces = useAppStore((state) => state.workspaces)
  const teams = useAppStore((state) => state.teams)
  const teamMemberships = useAppStore((state) => state.teamMemberships)
  const users = useAppStore((state) => state.users)
  const conversation = useMemo(
    () => conversations.find((entry) => entry.id === channelId) ?? null,
    [channelId, conversations]
  )
  const currentUser = useMemo(
    () => users.find((entry) => entry.id === currentUserId) ?? null,
    [currentUserId, users]
  )
  const mentionCandidates = useMemo(() => {
    if (!conversation || conversation.kind !== "channel") {
      return []
    }

    const workspace = workspaces.find(
      (entry) => entry.id === conversation.scopeId
    )
    const teamIds = new Set(
      teams
        .filter((team) => team.workspaceId === conversation.scopeId)
        .map((team) => team.id)
    )
    const userIds = new Set(
      teamMemberships
        .filter((membership) => teamIds.has(membership.teamId))
        .map((membership) => membership.userId)
    )

    if (workspace?.createdBy) {
      userIds.add(workspace.createdBy)
    }

    return users.filter(
      (user) => userIds.has(user.id) && user.id !== currentUserId
    )
  }, [conversation, currentUserId, teamMemberships, teams, users, workspaces])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const editorInstanceRef = useRef<Editor | null>(null)
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
  const handleInsertPostEmoji = (emoji: string) => {
    editorInstanceRef.current?.chain().focus().insertContent(emoji).run()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-fg-4 hover:bg-surface-2"
      >
        <UserAvatar
          name={currentUser?.name}
          avatarImageUrl={currentUser?.avatarImageUrl}
          avatarUrl={currentUser?.avatarUrl}
          status={currentUser?.status}
          size="default"
        />
        <span className="text-[13px] text-fg-3">
          Start a new thread — add a headline…
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-md border border-line bg-surface px-3.5 pt-2.5 pb-2 transition-colors focus-within:border-fg-3">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Start a new thread — add a headline…"
        className="w-full border-0 bg-transparent pb-1 text-[14px] font-semibold text-foreground outline-none placeholder:text-fg-3"
      />
      <RichTextEditor
        content={content}
        onChange={setContent}
        compact
        autoFocus
        showToolbar={false}
        showStats={false}
        placeholder="Write something the whole channel can read and reply to…"
        editorInstanceRef={editorInstanceRef}
        mentionCandidates={mentionCandidates}
        onSubmitShortcut={handlePost}
        submitOnEnter
        className="min-w-0 [&_.ProseMirror]:min-h-[2.625rem] [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:text-[13.5px] [&_.ProseMirror]:leading-[1.55] [&_.ProseMirror]:outline-none"
      />
      <div className="mt-1 flex items-center gap-0.5 border-t border-dashed border-line pt-1.5 text-fg-3">
        <EmojiPickerPopover
          align="start"
          side="top"
          onEmojiSelect={handleInsertPostEmoji}
          trigger={
            <button
              type="button"
              aria-label="Emoji"
              className="inline-grid size-7 place-items-center rounded-md transition-colors hover:bg-surface-3 hover:text-foreground"
            >
              <Smiley className="size-[13px]" />
            </button>
          }
        />
        <span className="flex-1" />
        <ShortcutKeys
          keys={["Enter"]}
          className="mr-1"
          keyClassName="h-[18px] min-w-0 rounded-[4px] border-line bg-surface-2 px-1 text-[10.5px] text-fg-3 shadow-none"
        />
        <button
          type="button"
          onClick={() => {
            setTitle("")
            setContent("")
            setOpen(false)
          }}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-fg-3 transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <Button
          type="button"
          size="sm"
          onClick={handlePost}
          disabled={!contentText}
          className="ml-1 h-7 gap-1.5 rounded-md px-2.5 text-[12px]"
        >
          <PaperPlaneTilt className="size-3" weight="fill" />
          Post
        </Button>
      </div>
    </div>
  )
}
