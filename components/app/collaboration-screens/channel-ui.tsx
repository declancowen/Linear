"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { Editor } from "@tiptap/react"
import {
  ArrowUp,
  ChatCircle,
  PaperPlaneTilt,
  Smiley,
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
import {
  getCurrentHashTargetId,
  getHashTargetElement,
  scheduleScrollElementIntoCenteredView,
} from "@/lib/browser/url-hash-target"
import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { MessageHoverActionBar } from "@/components/app/message-hover-action-bar"
import { ReactionUsersHoverCard } from "@/components/app/reaction-users-hover-card"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { RichTextUploadButton } from "@/components/app/rich-text-editor/upload-button"
import type { RichTextAttachmentUploader } from "@/components/app/rich-text-editor/attachment-upload-one"
import {
  flushPendingAttachmentUploads,
  hasPendingAttachments,
} from "@/components/app/rich-text-editor/pending-attachments"
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

type AppState = ReturnType<typeof useAppStore.getState>
type ForumPostRecord = AppState["channelPosts"][number]
type ForumPostComment = AppState["channelPostComments"][number]
type ForumUser = AppState["users"][number]
type UsersById = Map<string, ForumUser>

function useCurrentHashTargetId() {
  const [hashTargetId, setHashTargetId] = useState("")

  useEffect(() => {
    const updateHashTargetId = () => setHashTargetId(getCurrentHashTargetId())

    updateHashTargetId()
    window.addEventListener("hashchange", updateHashTargetId)

    return () => {
      window.removeEventListener("hashchange", updateHashTargetId)
    }
  }, [])

  return hashTargetId
}

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
  canEditPost,
  canDeletePost,
  onEdit,
  postId,
  onDelete,
  onReply,
}: {
  canEditPost: boolean
  canDeletePost: boolean
  onEdit: () => void
  postId: string
  onDelete: () => void
  onReply: () => void
}) {
  return (
    <MessageHoverActionBar
      canDelete={canDeletePost}
      canEdit={canEditPost}
      canQuote
      className="top-0 right-0 -translate-y-1/2 group-hover/post:flex focus-within:flex"
      deleteLabel="Delete post"
      editLabel="Edit post"
      onDelete={onDelete}
      onEdit={onEdit}
      onQuote={onReply}
      quoteAction="reply"
      quoteLabel="Reply"
      onReact={(emoji) => {
        useAppStore.getState().toggleChannelPostReaction(postId, emoji)
      }}
    />
  )
}

function ForumPostReactions({
  currentUserId,
  post,
  usersById,
}: {
  currentUserId: string
  post: ForumPostRecord
  usersById: UsersById
}) {
  const reactions = post.reactions ?? []

  if (reactions.length === 0) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {reactions.map((reaction) => {
        const active = reaction.userIds.includes(currentUserId)

        return (
          <ReactionUsersHoverCard
            key={reaction.emoji}
            userIds={reaction.userIds}
            usersById={usersById}
          >
            <button
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
          </ReactionUsersHoverCard>
        )
      })}
    </div>
  )
}

function ForumPostCommentList({
  comments,
  currentUserId,
  mentionCandidates,
  onDeleteComment,
  onEditComment,
  onUploadAttachment,
  onReplyComment,
  usersById,
  workspaceId,
}: {
  comments: ForumPostComment[]
  currentUserId: string
  mentionCandidates: ForumUser[]
  onDeleteComment: (comment: ForumPostComment) => void
  onEditComment: (commentId: string, content: string) => void
  onUploadAttachment: RichTextAttachmentUploader
  onReplyComment: (comment: ForumPostComment) => void
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
          canEdit={comment.createdBy === currentUserId}
          canDelete={comment.createdBy === currentUserId}
          comment={comment}
          currentUserId={currentUserId}
          mentionCandidates={mentionCandidates}
          onDelete={() => onDeleteComment(comment)}
          onEdit={onEditComment}
          onUploadAttachment={onUploadAttachment}
          onReply={() => onReplyComment(comment)}
          onReact={(commentId, emoji) => {
            useAppStore
              .getState()
              .toggleChannelPostCommentReaction(
                comment.postId,
                commentId,
                emoji
              )
          }}
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
  onUploadAttachment,
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
  onUploadAttachment: RichTextAttachmentUploader
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
          onUploadAttachment={onUploadAttachment}
          deferAttachmentUpload
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
            <RichTextUploadButton
              className="rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-2 hover:text-foreground"
              deferUpload
              editorRef={replyEditorRef}
              iconClassName="size-4"
              insertMode="auto"
              onUploadAttachment={onUploadAttachment}
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
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [showReplies, setShowReplies] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deletePostOpen, setDeletePostOpen] = useState(false)
  const [deleteComment, setDeleteComment] = useState<ForumPostComment | null>(
    null
  )
  const replyEditorRef = useRef<Editor | null>(null)
  const editEditorRef = useRef<Editor | null>(null)
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )
  const hashTargetId = useCurrentHashTargetId()

  useEffect(() => {
    if (!hashTargetId) {
      return
    }

    if (comments.some((comment) => comment.id === hashTargetId)) {
      const frame = window.requestAnimationFrame(() => {
        setShowReplies(true)
      })

      return () => window.cancelAnimationFrame(frame)
    }
  }, [comments, hashTargetId])

  useEffect(() => {
    if (!hashTargetId) {
      return
    }

    const targetIsPost = post?.id === hashTargetId
    const targetIsComment = comments.some(
      (comment) => comment.id === hashTargetId
    )

    if (!targetIsPost && !targetIsComment) {
      return
    }

    const target = getHashTargetElement(hashTargetId)

    if (!target) {
      return
    }

    return scheduleScrollElementIntoCenteredView(target)
  }, [comments, hashTargetId, post?.id, showReplies])

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
  const canEditPost = post.createdBy === currentUserId
  const handleUploadAttachment: RichTextAttachmentUploader = (file) =>
    useAppStore
      .getState()
      .uploadAttachment("conversation", post.conversationId, file)
  const editContentLimitState = getTextInputLimitState(
    editContent,
    channelPostContentConstraints,
    {
      plainText: true,
    }
  )
  const editTitleLimitState = getTextInputLimitState(
    editTitle,
    channelPostTitleConstraints
  )

  const handleReply = async () => {
    if (!replyLimitState.canSubmit) return
    let outgoingContent = reply
    if (hasPendingAttachments(reply)) {
      const flushedContent = await flushPendingAttachmentUploads(
        reply,
        handleUploadAttachment
      )
      if (flushedContent === null) return
      outgoingContent = flushedContent
    }
    useAppStore.getState().addChannelPostComment({
      postId: post.id,
      content: outgoingContent,
    })
    setReply("")
    setReplyOpen(false)
  }

  const handleDeletePost = () => {
    useAppStore.getState().deleteChannelPost(post.id)
    setDeletePostOpen(false)
  }
  const handleOpenEditPost = () => {
    setEditTitle(post.title)
    setEditContent(post.content)
    setEditOpen(true)
  }
  const handleEditPost = async () => {
    if (!editTitleLimitState.canSubmit || !editContentLimitState.canSubmit) {
      return
    }

    let outgoingContent = editContent
    if (hasPendingAttachments(editContent)) {
      const flushedContent = await flushPendingAttachmentUploads(
        editContent,
        handleUploadAttachment
      )
      if (flushedContent === null) return
      outgoingContent = flushedContent
    }

    useAppStore.getState().updateChannelPost(post.id, {
      title: editTitle,
      content: outgoingContent,
    })
    setEditOpen(false)
  }
  const handleConfirmDeleteComment = () => {
    if (!deleteComment) {
      return
    }

    useAppStore.getState().deleteChannelPostComment(post.id, deleteComment.id)
    setDeleteComment(null)
  }
  const handleEditComment = async (commentId: string, content: string) => {
    let outgoingContent = content
    if (hasPendingAttachments(content)) {
      const flushedContent = await flushPendingAttachmentUploads(
        content,
        handleUploadAttachment
      )
      if (flushedContent === null) return
      outgoingContent = flushedContent
    }
    useAppStore.getState().updateChannelPostComment(post.id, commentId, {
      content: outgoingContent,
    })
  }
  const openReply = () => {
    setShowReplies(true)
    setReplyOpen(true)
  }
  const handleReplyPost = () => openReply()
  const handleReplyComment = () => openReply()
  const handleInsertReplyEmoji = (emoji: string) => {
    replyEditorRef.current?.chain().focus().insertContent(emoji).run()
  }

  const previewComments = comments.slice(-3)
  const hiddenCount = comments.length - previewComments.length
  const earlierComments = comments.slice(0, hiddenCount)

  return {
    author,
    canEditPost,
    canDeletePost,
    comments,
    currentUserId,
    currentWorkspaceId,
    deletePostOpen,
    deleteComment,
    editContent,
    editContentLimitState,
    editEditorRef,
    editOpen,
    editTitle,
    editTitleLimitState,
    earlierComments,
    handleConfirmDeleteComment,
    handleDeletePost,
    handleEditComment,
    handleEditPost,
    handleOpenEditPost,
    handleReplyComment,
    handleReplyPost,
    handleInsertReplyEmoji,
    handleUploadAttachment,
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
    setDeleteComment,
    setEditContent,
    setEditOpen,
    setEditTitle,
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
  mentionCandidates,
  onDeleteComment,
  onEditComment,
  onUploadAttachment,
  onReplyComment,
  showReplies,
  usersById,
}: Pick<
  ForumPostCardController,
  | "currentUserId"
  | "currentWorkspaceId"
  | "earlierComments"
  | "hiddenCount"
  | "mentionCandidates"
  | "showReplies"
  | "usersById"
> & {
  onDeleteComment: (comment: ForumPostComment) => void
  onEditComment: (commentId: string, content: string) => void
  onUploadAttachment: RichTextAttachmentUploader
  onReplyComment: (comment: ForumPostComment) => void
}) {
  if (!showReplies || hiddenCount <= 0) {
    return null
  }

  return (
    <div className="mb-2">
      <ForumPostCommentList
        comments={earlierComments}
        currentUserId={currentUserId}
        mentionCandidates={mentionCandidates}
        onDeleteComment={onDeleteComment}
        onEditComment={onEditComment}
        onUploadAttachment={onUploadAttachment}
        onReplyComment={onReplyComment}
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
  onDeleteComment,
  onEditComment,
  onUploadAttachment,
  onReplyComment,
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
  onDeleteComment: (comment: ForumPostComment) => void
  onEditComment: (commentId: string, content: string) => void
  onUploadAttachment: RichTextAttachmentUploader
  onReplyComment: (comment: ForumPostComment) => void
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
        mentionCandidates={mentionCandidates}
        onDeleteComment={onDeleteComment}
        onEditComment={onEditComment}
        onUploadAttachment={onUploadAttachment}
        onReplyComment={onReplyComment}
        showReplies={showReplies}
        usersById={usersById}
      />

      <ForumPostCommentList
        comments={previewComments}
        currentUserId={currentUserId}
        mentionCandidates={mentionCandidates}
        onDeleteComment={onDeleteComment}
        onEditComment={onEditComment}
        onUploadAttachment={onUploadAttachment}
        onReplyComment={onReplyComment}
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
          onUploadAttachment={onUploadAttachment}
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

function ForumPostCardLayout(controller: ForumPostCardController) {
  return (
    <div
      id={controller.post.id}
      className="relative z-0 grid scroll-mt-6 gap-2.5 border-b border-line-soft px-[18px] py-2.5 transition-colors target:ring-2 target:ring-ring/45 hover:bg-surface-2"
      style={{ gridTemplateColumns: "24px 1fr" }}
    >
      <ForumPostAvatar author={controller.author} />
      <ForumPostBody
        author={controller.author}
        canEditPost={controller.canEditPost}
        canDeletePost={controller.canDeletePost}
        currentUserId={controller.currentUserId}
        currentWorkspaceId={controller.currentWorkspaceId}
        editContent={controller.editContent}
        editContentLimitState={controller.editContentLimitState}
        editEditorRef={controller.editEditorRef}
        editOpen={controller.editOpen}
        editTitle={controller.editTitle}
        editTitleLimitState={controller.editTitleLimitState}
        earlierComments={controller.earlierComments}
        hiddenCount={controller.hiddenCount}
        mentionCandidates={controller.mentionCandidates}
        post={controller.post}
        previewComments={controller.previewComments}
        reply={controller.reply}
        replyEditorRef={controller.replyEditorRef}
        replyLimitState={controller.replyLimitState}
        replyOpen={controller.replyOpen}
        showReplies={controller.showReplies}
        usersById={controller.usersById}
        onDelete={() => controller.setDeletePostOpen(true)}
        onDeleteComment={controller.setDeleteComment}
        onEditComment={controller.handleEditComment}
        onUploadAttachment={controller.handleUploadAttachment}
        onReplyComment={controller.handleReplyComment}
        onEditPost={controller.handleEditPost}
        onOpenEditPost={controller.handleOpenEditPost}
        onReplyPost={controller.handleReplyPost}
        onInsertReplyEmoji={controller.handleInsertReplyEmoji}
        onEditContentChange={controller.setEditContent}
        onEditOpenChange={controller.setEditOpen}
        onEditTitleChange={controller.setEditTitle}
        onReply={controller.handleReply}
        onReplyChange={controller.setReply}
        onReplyOpenChange={controller.setReplyOpen}
        onShowRepliesChange={controller.setShowReplies}
      />
      <ForumPostDeleteDialog
        deletePostOpen={controller.deletePostOpen}
        setDeletePostOpen={controller.setDeletePostOpen}
        onDeletePost={controller.handleDeletePost}
      />
      <ForumPostCommentDeleteDialog
        deleteComment={controller.deleteComment}
        setDeleteComment={controller.setDeleteComment}
        onDeleteComment={controller.handleConfirmDeleteComment}
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

function ForumPostEditComposer({
  content,
  contentLimitState,
  editorRef,
  mentionCandidates,
  onUploadAttachment,
  title,
  titleLimitState,
  onCancel,
  onContentChange,
  onSave,
  onTitleChange,
}: {
  content: string
  contentLimitState: ReturnType<typeof getTextInputLimitState>
  editorRef: RefObject<Editor | null>
  mentionCandidates: ForumUser[]
  onUploadAttachment: RichTextAttachmentUploader
  title: string
  titleLimitState: ReturnType<typeof getTextInputLimitState>
  onCancel: () => void
  onContentChange: (content: string) => void
  onSave: () => void
  onTitleChange: (title: string) => void
}) {
  return (
    <div className="mt-2 rounded-md border border-line bg-surface px-3 py-2">
      <input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Thread headline"
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
        onChange={onContentChange}
        compact
        autoFocus
        showToolbar={false}
        showStats={false}
        placeholder="Edit post..."
        editorInstanceRef={editorRef}
        mentionCandidates={mentionCandidates}
        minPlainTextCharacters={channelPostContentConstraints.min}
        maxPlainTextCharacters={channelPostContentConstraints.max}
        enforcePlainTextLimit
        onSubmitShortcut={onSave}
        onUploadAttachment={onUploadAttachment}
        deferAttachmentUpload
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
          onEmojiSelect={(emoji) =>
            editorRef.current?.chain().focus().insertContent(emoji).run()
          }
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
        <RichTextUploadButton
          deferUpload
          editorRef={editorRef}
          iconClassName="size-[13px]"
          insertMode="auto"
          onUploadAttachment={onUploadAttachment}
        />
        <span className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-fg-3 transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!contentLimitState.canSubmit || !titleLimitState.canSubmit}
          className="ml-1 h-7 gap-1.5 rounded-md px-2.5 text-[12px]"
        >
          Save
        </Button>
      </div>
    </div>
  )
}

function ForumPostBody({
  author,
  canEditPost,
  canDeletePost,
  currentUserId,
  currentWorkspaceId,
  editContent,
  editContentLimitState,
  editEditorRef,
  editOpen,
  editTitle,
  editTitleLimitState,
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
  onDeleteComment,
  onEditComment,
  onUploadAttachment,
  onReplyComment,
  onEditPost,
  onOpenEditPost,
  onReplyPost,
  onInsertReplyEmoji,
  onEditContentChange,
  onEditOpenChange,
  onEditTitleChange,
  onReply,
  onReplyChange,
  onReplyOpenChange,
  onShowRepliesChange,
}: Pick<
  ForumPostCardController,
  | "author"
  | "canEditPost"
  | "canDeletePost"
  | "currentUserId"
  | "currentWorkspaceId"
  | "editContent"
  | "editContentLimitState"
  | "editEditorRef"
  | "editOpen"
  | "editTitle"
  | "editTitleLimitState"
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
  onDeleteComment: (comment: ForumPostComment) => void
  onEditComment: (commentId: string, content: string) => void
  onUploadAttachment: RichTextAttachmentUploader
  onReplyComment: (comment: ForumPostComment) => void
  onEditPost: () => void
  onOpenEditPost: () => void
  onReplyPost: () => void
  onInsertReplyEmoji: (emoji: string) => void
  onEditContentChange: (content: string) => void
  onEditOpenChange: (open: boolean) => void
  onEditTitleChange: (title: string) => void
  onReply: () => void
  onReplyChange: (reply: string) => void
  onReplyOpenChange: (open: boolean) => void
  onShowRepliesChange: (show: boolean) => void
}) {
  return (
    <div className="min-w-0">
      <div className="group/post relative pr-12">
        <div className="flex min-w-0 items-baseline gap-2">
          <ForumPostAuthorLine
            author={author}
            createdAt={post.createdAt}
            currentUserId={currentUserId}
            editedAt={post.editedAt}
            workspaceId={currentWorkspaceId}
          />
        </div>
        <ForumPostActionBar
          canEditPost={canEditPost}
          canDeletePost={canDeletePost}
          postId={post.id}
          onDelete={onDelete}
          onEdit={onOpenEditPost}
          onReply={onReplyPost}
        />

        {editOpen ? (
          <ForumPostEditComposer
            content={editContent}
            contentLimitState={editContentLimitState}
            editorRef={editEditorRef}
            mentionCandidates={mentionCandidates}
            onUploadAttachment={onUploadAttachment}
            title={editTitle}
            titleLimitState={editTitleLimitState}
            onCancel={() => {
              onEditTitleChange(post.title)
              onEditContentChange(post.content)
              onEditOpenChange(false)
            }}
            onContentChange={onEditContentChange}
            onSave={onEditPost}
            onTitleChange={onEditTitleChange}
          />
        ) : (
          <>
            <ForumPostTitle title={post.title} />

            <RichTextContent
              content={post.content}
              className={cn(
                "text-[13.5px] leading-[1.55] text-foreground [&_p]:leading-[1.55]",
                post.title ? "mt-1.5" : "mt-2"
              )}
            />
          </>
        )}

        <ForumPostReactions
          currentUserId={currentUserId}
          post={post}
          usersById={usersById}
        />
      </div>

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
        onDeleteComment={onDeleteComment}
        onEditComment={onEditComment}
        onUploadAttachment={onUploadAttachment}
        onReplyComment={onReplyComment}
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

function ForumPostCommentDeleteDialog({
  deleteComment,
  setDeleteComment,
  onDeleteComment,
}: {
  deleteComment: ForumPostComment | null
  setDeleteComment: (comment: ForumPostComment | null) => void
  onDeleteComment: () => void
}) {
  return (
    <ConfirmDialog
      open={Boolean(deleteComment)}
      onOpenChange={(open) => {
        if (!open) {
          setDeleteComment(null)
        }
      }}
      title="Delete comment"
      description="This comment will be permanently removed. This can't be undone."
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={onDeleteComment}
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
    (state) =>
      state.users.find((entry) => entry.id === state.currentUserId) ?? null
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

  const handlePost = async () => {
    if (!contentLimitState.canSubmit || !titleLimitState.canSubmit) return
    let outgoingContent = content
    if (hasPendingAttachments(content)) {
      const flushedContent = await flushPendingAttachmentUploads(
        content,
        handleUploadAttachment
      )
      if (flushedContent === null) return
      outgoingContent = flushedContent
    }
    useAppStore.getState().createChannelPost({
      conversationId: channelId,
      title: title.trim(),
      content: outgoingContent,
    })
    setTitle("")
    setContent("")
    setOpen(false)
  }
  const handleInsertPostEmoji = (emoji: string) => {
    editorInstanceRef.current?.chain().focus().insertContent(emoji).run()
  }
  const handleUploadAttachment: RichTextAttachmentUploader = (file) =>
    useAppStore.getState().uploadAttachment("conversation", channelId, file)

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
        onUploadAttachment={handleUploadAttachment}
        deferAttachmentUpload
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
        <RichTextUploadButton
          deferUpload
          editorRef={editorInstanceRef}
          iconClassName="size-[13px]"
          insertMode="auto"
          onUploadAttachment={handleUploadAttachment}
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
