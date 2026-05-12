"use client"

import { useMemo, useRef, useState, type RefObject } from "react"
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
import {
  channelPostCommentContentConstraints,
  channelPostContentConstraints,
  channelPostTitleConstraints,
  getTextInputLimitState,
} from "@/lib/domain/input-constraints"
import { useAppStore } from "@/lib/store/app-store"
import { cn } from "@/lib/utils"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import {
  ShortcutKeys,
  useShortcutModifierLabel,
} from "@/components/app/shortcut-keys"
import { UserAvatar } from "@/components/app/user-presence"
import {
  ForumPostAuthorLine,
  ForumPostAvatar,
  ForumPostCommentItem,
} from "@/components/app/collaboration-screens/channel-post-primitives"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type AppState = ReturnType<typeof useAppStore.getState>
type ForumPostRecord = AppState["channelPosts"][number]
type ForumPostComment = AppState["channelPostComments"][number]
type ForumUser = AppState["users"][number]
type UsersById = Map<string, ForumUser>

function getChannelMentionCandidates(
  state: AppState,
  channelId: string | null | undefined
) {
  const conversation =
    state.conversations.find((entry) => entry.id === channelId) ?? null

  return conversation && conversation.kind === "channel"
    ? getConversationParticipants(state, conversation).filter(
        (candidate) => candidate.id !== state.currentUserId
      )
    : []
}

function ForumPostActionBar({
  canDeletePost,
  postId,
  onDelete,
  onReply,
}: {
  canDeletePost: boolean
  postId: string
  onDelete: () => void
  onReply: () => void
}) {
  return (
    <div className="absolute top-1.5 right-4 hidden items-center gap-0.5 rounded-md border border-line bg-surface p-0.5 shadow-sm group-hover/post:flex">
      <EmojiPickerPopover
        align="end"
        side="bottom"
        onEmojiSelect={(emoji) => {
          useAppStore.getState().toggleChannelPostReaction(postId, emoji)
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
        onClick={onReply}
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
              onSelect={onDelete}
            >
              <Trash className="size-4" />
              Delete post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

function ForumPostReactions({
  currentUserId,
  post,
}: {
  currentUserId: string
  post: ForumPostRecord
}) {
  const reactions = post.reactions ?? []

  return (
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
  )
}

function ForumPostCommentList({
  comments,
  currentUserId,
  usersById,
  workspaceId,
}: {
  comments: ForumPostComment[]
  currentUserId: string
  usersById: UsersById
  workspaceId: string | null
}) {
  if (comments.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-0.5">
      {comments.map((comment) => (
        <ForumPostCommentItem
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          usersById={usersById}
          workspaceId={workspaceId}
        />
      ))}
    </div>
  )
}

function ForumPostReplyComposer({
  mentionCandidates,
  previewCommentsCount,
  reply,
  replyEditorRef,
  replyLimitState,
  onCancel,
  onInsertEmoji,
  onReply,
  onReplyChange,
}: {
  mentionCandidates: ForumUser[]
  previewCommentsCount: number
  reply: string
  replyEditorRef: RefObject<Editor | null>
  replyLimitState: ReturnType<typeof getTextInputLimitState>
  onCancel: () => void
  onInsertEmoji: (emoji: string) => void
  onReply: () => void
  onReplyChange: (value: string) => void
}) {
  return (
    <div className={cn(previewCommentsCount > 0 && "mt-2")}>
      <div className="rounded-md border border-line bg-surface px-3 py-2">
        <RichTextEditor
          content={reply}
          onChange={onReplyChange}
          compact
          autoFocus
          showToolbar={false}
          showStats={false}
          placeholder="Reply with @mentions or /commands…"
          editorInstanceRef={replyEditorRef}
          mentionCandidates={mentionCandidates}
          minPlainTextCharacters={channelPostCommentContentConstraints.min}
          maxPlainTextCharacters={channelPostCommentContentConstraints.max}
          enforcePlainTextLimit
          onSubmitShortcut={onReply}
          submitOnEnter
          className="[&_.ProseMirror]:min-h-[2.25rem] [&_.ProseMirror]:text-[13px]"
        />
      </div>
      <div className="mt-2">
        <FieldCharacterLimit
          state={replyLimitState}
          limit={channelPostCommentContentConstraints.max}
          className="mt-0 mb-1.5"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <EmojiPickerPopover
              align="start"
              side="top"
              onEmojiSelect={onInsertEmoji}
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
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={onReply}
              disabled={!replyLimitState.canSubmit}
            >
              <ArrowUp className="size-3.5" weight="bold" />
              Reply
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function useForumPostCardController(postId: string) {
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
    useShallow((state) =>
      getChannelMentionCandidates(state, post?.conversationId)
    )
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
  const replyLimitState = getTextInputLimitState(
    reply,
    channelPostCommentContentConstraints,
    {
      plainText: true,
    }
  )
  const canDeletePost = post.createdBy === currentUserId

  const handleReply = () => {
    if (!replyLimitState.canSubmit) return
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
  const earlierComments = comments.slice(0, hiddenCount)

  return {
    author,
    canDeletePost,
    comments,
    currentUserId,
    currentWorkspaceId,
    deletePostOpen,
    earlierComments,
    handleDeletePost,
    handleInsertReplyEmoji,
    handleReply,
    hiddenCount,
    mentionCandidates,
    post,
    previewComments,
    reply,
    replyEditorRef,
    replyLimitState,
    replyOpen,
    setDeletePostOpen,
    setReply,
    setReplyOpen,
    setShowReplies,
    showReplies,
    usersById,
  }
}

type ForumPostCardController = NonNullable<
  ReturnType<typeof useForumPostCardController>
>

function getRepliesToggleLabel(input: {
  hiddenCount: number
  showReplies: boolean
}) {
  if (input.showReplies) {
    return "Show less"
  }

  return `Show ${input.hiddenCount} earlier ${
    input.hiddenCount === 1 ? "reply" : "replies"
  }`
}

function ForumPostRepliesToggle({
  hiddenCount,
  showReplies,
  onToggle,
}: {
  hiddenCount: number
  showReplies: boolean
  onToggle: () => void
}) {
  if (hiddenCount <= 0) {
    return null
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="mb-2 text-[11.5px] font-medium text-fg-3 hover:text-foreground"
    >
      {getRepliesToggleLabel({ hiddenCount, showReplies })}
    </button>
  )
}

function EarlierForumPostComments({
  currentUserId,
  currentWorkspaceId,
  earlierComments,
  hiddenCount,
  showReplies,
  usersById,
}: Pick<
  ForumPostCardController,
  | "currentUserId"
  | "currentWorkspaceId"
  | "earlierComments"
  | "hiddenCount"
  | "showReplies"
  | "usersById"
>) {
  if (!showReplies || hiddenCount <= 0) {
    return null
  }

  return (
    <div className="mb-2">
      <ForumPostCommentList
        comments={earlierComments}
        currentUserId={currentUserId}
        usersById={usersById}
        workspaceId={currentWorkspaceId}
      />
    </div>
  )
}

function ForumPostReplyButton({
  hasPreviewComments,
  onOpenReply,
}: {
  hasPreviewComments: boolean
  onOpenReply: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpenReply}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border border-dashed border-line px-2.5 py-1.5 text-left text-[12px] text-fg-3 transition-colors hover:border-fg-4 hover:text-fg-2",
        hasPreviewComments ? "mt-1.5" : "mt-0"
      )}
    >
      <ChatCircle className="size-3.5" />
      Reply to this thread…
    </button>
  )
}

function ForumPostRepliesSection({
  currentUserId,
  currentWorkspaceId,
  earlierComments,
  hiddenCount,
  mentionCandidates,
  previewComments,
  reply,
  replyEditorRef,
  replyLimitState,
  replyOpen,
  showReplies,
  usersById,
  onInsertEmoji,
  onReply,
  onReplyChange,
  onSetReplyOpen,
  onSetShowReplies,
}: Pick<
  ForumPostCardController,
  | "currentUserId"
  | "currentWorkspaceId"
  | "earlierComments"
  | "hiddenCount"
  | "mentionCandidates"
  | "previewComments"
  | "reply"
  | "replyEditorRef"
  | "replyLimitState"
  | "replyOpen"
  | "showReplies"
  | "usersById"
> & {
  onInsertEmoji: (emoji: string) => void
  onReply: () => void
  onReplyChange: (value: string) => void
  onSetReplyOpen: (open: boolean) => void
  onSetShowReplies: (showReplies: boolean) => void
}) {
  const handleCancelReply = () => {
    onReplyChange("")
    onSetReplyOpen(false)
  }
  const handleOpenReply = () => {
    onSetShowReplies(true)
    onSetReplyOpen(true)
  }

  return (
    <div className="mt-3 border-l-2 border-line-soft pl-3">
      <ForumPostRepliesToggle
        hiddenCount={hiddenCount}
        showReplies={showReplies}
        onToggle={() => onSetShowReplies(!showReplies)}
      />
      <EarlierForumPostComments
        currentUserId={currentUserId}
        currentWorkspaceId={currentWorkspaceId}
        earlierComments={earlierComments}
        hiddenCount={hiddenCount}
        showReplies={showReplies}
        usersById={usersById}
      />

      <ForumPostCommentList
        comments={previewComments}
        currentUserId={currentUserId}
        usersById={usersById}
        workspaceId={currentWorkspaceId}
      />

      {replyOpen ? (
        <ForumPostReplyComposer
          mentionCandidates={mentionCandidates}
          previewCommentsCount={previewComments.length}
          reply={reply}
          replyEditorRef={replyEditorRef}
          replyLimitState={replyLimitState}
          onCancel={handleCancelReply}
          onInsertEmoji={onInsertEmoji}
          onReply={onReply}
          onReplyChange={onReplyChange}
        />
      ) : (
        <ForumPostReplyButton
          hasPreviewComments={previewComments.length > 0}
          onOpenReply={handleOpenReply}
        />
      )}
    </div>
  )
}

function ForumPostCardLayout({
  author,
  canDeletePost,
  currentUserId,
  currentWorkspaceId,
  deletePostOpen,
  earlierComments,
  handleDeletePost,
  handleInsertReplyEmoji,
  handleReply,
  hiddenCount,
  mentionCandidates,
  post,
  previewComments,
  reply,
  replyEditorRef,
  replyLimitState,
  replyOpen,
  setDeletePostOpen,
  setReply,
  setReplyOpen,
  setShowReplies,
  showReplies,
  usersById,
}: ForumPostCardController) {
  return (
    <div
      id={post.id}
      className="group/post relative z-0 grid gap-2.5 border-b border-line-soft px-[18px] py-2.5 transition-colors hover:bg-surface-2"
      style={{ gridTemplateColumns: "24px 1fr" }}
    >
      <ForumPostAvatar author={author} />
      <ForumPostBody
        author={author}
        canDeletePost={canDeletePost}
        currentUserId={currentUserId}
        currentWorkspaceId={currentWorkspaceId}
        earlierComments={earlierComments}
        hiddenCount={hiddenCount}
        mentionCandidates={mentionCandidates}
        post={post}
        previewComments={previewComments}
        reply={reply}
        replyEditorRef={replyEditorRef}
        replyLimitState={replyLimitState}
        replyOpen={replyOpen}
        showReplies={showReplies}
        usersById={usersById}
        onDelete={() => setDeletePostOpen(true)}
        onInsertReplyEmoji={handleInsertReplyEmoji}
        onReply={handleReply}
        onReplyChange={setReply}
        onReplyOpenChange={setReplyOpen}
        onShowRepliesChange={setShowReplies}
      />
      <ForumPostDeleteDialog
        deletePostOpen={deletePostOpen}
        setDeletePostOpen={setDeletePostOpen}
        onDeletePost={handleDeletePost}
      />
    </div>
  )
}

function ForumPostTitle({ title }: { title: string }) {
  return title ? (
    <h3 className="mt-2 text-[15px] leading-snug font-semibold tracking-[-0.005em] text-foreground">
      {title}
    </h3>
  ) : null
}

function ForumPostBody({
  author,
  canDeletePost,
  currentUserId,
  currentWorkspaceId,
  earlierComments,
  hiddenCount,
  mentionCandidates,
  post,
  previewComments,
  reply,
  replyEditorRef,
  replyLimitState,
  replyOpen,
  showReplies,
  usersById,
  onDelete,
  onInsertReplyEmoji,
  onReply,
  onReplyChange,
  onReplyOpenChange,
  onShowRepliesChange,
}: Pick<
  ForumPostCardController,
  | "author"
  | "canDeletePost"
  | "currentUserId"
  | "currentWorkspaceId"
  | "earlierComments"
  | "hiddenCount"
  | "mentionCandidates"
  | "post"
  | "previewComments"
  | "reply"
  | "replyEditorRef"
  | "replyLimitState"
  | "replyOpen"
  | "showReplies"
  | "usersById"
> & {
  onDelete: () => void
  onInsertReplyEmoji: (emoji: string) => void
  onReply: () => void
  onReplyChange: (reply: string) => void
  onReplyOpenChange: (open: boolean) => void
  onShowRepliesChange: (show: boolean) => void
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline gap-2">
        <ForumPostAuthorLine
          author={author}
          createdAt={post.createdAt}
          currentUserId={currentUserId}
          workspaceId={currentWorkspaceId}
        />
      </div>
      <ForumPostActionBar
        canDeletePost={canDeletePost}
        postId={post.id}
        onDelete={onDelete}
        onReply={() => {
          onShowRepliesChange(true)
          onReplyOpenChange(true)
        }}
      />

      <ForumPostTitle title={post.title} />

      <RichTextContent
        content={post.content}
        className={cn(
          "text-[13.5px] leading-[1.55] text-foreground [&_p]:leading-[1.55]",
          post.title ? "mt-1.5" : "mt-2"
        )}
      />

      <ForumPostReactions currentUserId={currentUserId} post={post} />

      <ForumPostRepliesSection
        currentUserId={currentUserId}
        currentWorkspaceId={currentWorkspaceId}
        earlierComments={earlierComments}
        hiddenCount={hiddenCount}
        mentionCandidates={mentionCandidates}
        previewComments={previewComments}
        reply={reply}
        replyEditorRef={replyEditorRef}
        replyLimitState={replyLimitState}
        replyOpen={replyOpen}
        showReplies={showReplies}
        usersById={usersById}
        onInsertEmoji={onInsertReplyEmoji}
        onReply={onReply}
        onReplyChange={onReplyChange}
        onSetReplyOpen={onReplyOpenChange}
        onSetShowReplies={onShowRepliesChange}
      />
    </div>
  )
}

function ForumPostDeleteDialog({
  deletePostOpen,
  setDeletePostOpen,
  onDeletePost,
}: {
  deletePostOpen: boolean
  setDeletePostOpen: (open: boolean) => void
  onDeletePost: () => void
}) {
  return (
    <ConfirmDialog
      open={deletePostOpen}
      onOpenChange={setDeletePostOpen}
      title="Delete post"
      description="This post and all its comments will be permanently removed. This can't be undone."
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={onDeletePost}
    />
  )
}

export function ForumPostCard({ postId }: { postId: string }) {
  const controller = useForumPostCardController(postId)

  if (!controller) {
    return null
  }

  return <ForumPostCardLayout {...controller} />
}

export function NewPostComposer({ channelId }: { channelId: string }) {
  const currentUser = useAppStore(
    (state) => state.users.find((entry) => entry.id === state.currentUserId) ?? null
  )
  const mentionCandidates = useAppStore(
    useShallow((state) => getChannelMentionCandidates(state, channelId))
  )
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const editorInstanceRef = useRef<Editor | null>(null)
  const contentLimitState = getTextInputLimitState(
    content,
    channelPostContentConstraints,
    {
      plainText: true,
    }
  )
  const titleLimitState = getTextInputLimitState(
    title,
    channelPostTitleConstraints
  )
  const shortcutModifierLabel = useShortcutModifierLabel()

  const handlePost = () => {
    if (!contentLimitState.canSubmit || !titleLimitState.canSubmit) return
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
        className="relative z-10 flex w-full items-center gap-3 rounded-md border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-fg-4 hover:bg-surface-2"
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
    <div className="relative isolate z-10 rounded-md border border-line bg-surface px-3.5 pt-2.5 pb-2 transition-colors focus-within:border-fg-3">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Start a new thread — add a headline…"
        maxLength={channelPostTitleConstraints.max}
        className="w-full border-0 bg-transparent pb-1 text-[14px] font-semibold text-foreground outline-none placeholder:text-fg-3"
      />
      <FieldCharacterLimit
        state={titleLimitState}
        limit={channelPostTitleConstraints.max}
        className="mt-0 mb-1"
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
        minPlainTextCharacters={channelPostContentConstraints.min}
        maxPlainTextCharacters={channelPostContentConstraints.max}
        enforcePlainTextLimit
        onSubmitShortcut={handlePost}
        className="min-w-0 [&_.ProseMirror]:min-h-[2.625rem] [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:text-[13.5px] [&_.ProseMirror]:leading-[1.55] [&_.ProseMirror]:outline-none"
      />
      <FieldCharacterLimit
        state={contentLimitState}
        limit={channelPostContentConstraints.max}
        className="mt-0 mb-1"
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
          keys={[shortcutModifierLabel, "Enter"]}
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
          disabled={!contentLimitState.canSubmit || !titleLimitState.canSubmit}
          className="ml-1 h-7 gap-1.5 rounded-md px-2.5 text-[12px]"
        >
          <PaperPlaneTilt className="size-3" weight="fill" />
          Post
        </Button>
      </div>
    </div>
  )
}
