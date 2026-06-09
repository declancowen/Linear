"use client"

import { useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import { Smiley } from "@phosphor-icons/react"

import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { MessageHoverActionBar } from "@/components/app/message-hover-action-bar"
import { ReactionUsersHoverCard } from "@/components/app/reaction-users-hover-card"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
import { RichTextUploadButton } from "@/components/app/rich-text-editor/upload-button"
import type { RichTextAttachmentUploader } from "@/components/app/rich-text-editor/attachment-upload-one"
import { UserAvatar, UserHoverCard } from "@/components/app/user-presence"
import { formatTimestamp } from "@/components/app/collaboration-screens/utils"
import {
  channelPostCommentContentConstraints,
  getTextInputLimitState,
} from "@/lib/domain/input-constraints"
import type { AppData, UserProfile } from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type ForumUser = UserProfile

type ForumPostComment = AppData["channelPostComments"][number]

type UsersById = Map<string, ForumUser>

export function ForumPostAuthorLine({
  author,
  createdAt,
  currentUserId,
  editedAt,
  workspaceId,
  size = "post",
}: {
  author: ForumUser | undefined
  createdAt: string
  currentUserId: string
  editedAt?: string | null
  workspaceId: string | null
  size?: "post" | "comment"
}) {
  return (
    <div className="flex items-baseline gap-2">
      <UserHoverCard
        user={author}
        userId={author?.id}
        currentUserId={currentUserId}
        workspaceId={workspaceId}
      >
        <span
          className={cn(
            "font-semibold text-foreground",
            size === "post" ? "truncate text-[14px]" : "text-[12.5px]"
          )}
        >
          {author?.name ?? "Unknown"}
        </span>
      </UserHoverCard>
      <span
        className={cn(
          "text-fg-3",
          size === "post" ? "shrink-0 text-[11.5px]" : "text-[11px]"
        )}
      >
        {formatTimestamp(createdAt)}
      </span>
      {editedAt ? (
        <span
          className={cn(
            "text-fg-4",
            size === "post" ? "shrink-0 text-[11.5px]" : "text-[11px]"
          )}
        >
          edited
        </span>
      ) : null}
    </div>
  )
}

export function ForumPostCommentItem({
  canEdit = false,
  canDelete = false,
  comment,
  currentUserId,
  onDelete,
  onEdit,
  onUploadAttachment,
  onReply,
  onReact,
  mentionCandidates,
  usersById,
  workspaceId,
}: {
  canEdit?: boolean
  canDelete?: boolean
  comment: ForumPostComment
  currentUserId: string
  onDelete?: (commentId: string) => void
  onEdit?: (commentId: string, content: string) => void
  onUploadAttachment: RichTextAttachmentUploader
  onReply?: () => void
  onReact?: (commentId: string, emoji: string) => void
  mentionCandidates: ForumUser[]
  usersById: UsersById
  workspaceId: string | null
}) {
  const commentAuthor = usersById.get(comment.createdBy)
  const reactions = comment.reactions ?? []
  const [editOpen, setEditOpen] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const editEditorRef = useRef<Editor | null>(null)
  const editLimitState = getTextInputLimitState(
    editContent,
    channelPostCommentContentConstraints,
    {
      plainText: true,
    }
  )

  function handleSave() {
    if (!editLimitState.canSubmit) {
      return
    }

    onEdit?.(comment.id, editContent)
    setEditOpen(false)
  }

  return (
    <div
      id={comment.id}
      data-channel-comment-item={comment.id}
      className={cn(
        "group/comment relative grid scroll-mt-6 items-start gap-x-2 overflow-visible rounded-md px-1.5 py-1 pr-10 transition-colors target:ring-2 target:ring-ring/45 hover:bg-surface-2",
        reactions.length > 0 && "pb-2"
      )}
      style={{ gridTemplateColumns: "24px minmax(0,1fr)" }}
    >
      <MessageHoverActionBar
        canDelete={canDelete}
        canEdit={canEdit}
        canQuote={Boolean(onReply)}
        canReact={Boolean(onReact)}
        className="top-0 right-1 -translate-y-1/2 group-hover/comment:flex focus-within:flex"
        deleteLabel="Delete comment"
        editLabel="Edit comment"
        onDelete={() => onDelete?.(comment.id)}
        onEdit={() => {
          setEditContent(comment.content)
          setEditOpen(true)
        }}
        onQuote={onReply}
        quoteAction="reply"
        quoteLabel="Reply"
        onReact={(emoji) => onReact?.(comment.id, emoji)}
      />
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
        <ForumPostAuthorLine
          author={commentAuthor}
          createdAt={comment.createdAt}
          currentUserId={currentUserId}
          editedAt={comment.editedAt}
          workspaceId={workspaceId}
          size="comment"
        />
        {editOpen ? (
          <div className="mt-1.5">
            <div className="rounded-md border border-line bg-surface px-3 py-2">
              <RichTextEditor
                content={editContent}
                onChange={setEditContent}
                compact
                autoFocus
                showToolbar={false}
                showStats={false}
                placeholder="Edit reply..."
                editorInstanceRef={editEditorRef}
                mentionCandidates={mentionCandidates}
                minPlainTextCharacters={
                  channelPostCommentContentConstraints.min
                }
                maxPlainTextCharacters={
                  channelPostCommentContentConstraints.max
                }
                enforcePlainTextLimit
                onSubmitShortcut={handleSave}
                onUploadAttachment={onUploadAttachment}
                deferAttachmentUpload
                submitOnEnter
                className="[&_.ProseMirror]:min-h-[2.25rem] [&_.ProseMirror]:text-[13px]"
              />
            </div>
            <FieldCharacterLimit
              state={editLimitState}
              limit={channelPostCommentContentConstraints.max}
              className="mt-1 mb-1"
            />
            <div className="flex items-center justify-between gap-2">
              <EmojiPickerPopover
                align="start"
                side="top"
                onEmojiSelect={(emoji) =>
                  editEditorRef.current
                    ?.chain()
                    .focus()
                    .insertContent(emoji)
                    .run()
                }
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
                editorRef={editEditorRef}
                iconClassName="size-4"
                insertMode="auto"
                onUploadAttachment={onUploadAttachment}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditContent(comment.content)
                    setEditOpen(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!editLimitState.canSubmit}
                  onClick={handleSave}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <RichTextContent
            content={comment.content}
            enableAttachmentDownload
            className="text-[13px] leading-[1.5] text-foreground [&_p]:leading-[1.5]"
          />
        )}
        {reactions.length > 0 ? (
          <div
            data-channel-comment-reactions={comment.id}
            className="mt-1.5 mb-1.5 flex flex-wrap items-center gap-1 pt-0.5"
          >
            {reactions.map((reaction) => {
              const active = reaction.userIds.includes(currentUserId)

              return (
                <ReactionUsersHoverCard
                  key={`${comment.id}-${reaction.emoji}`}
                  userIds={reaction.userIds}
                  usersById={usersById}
                >
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] tabular-nums transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-line bg-surface text-fg-2 hover:bg-surface-2 hover:text-foreground"
                    )}
                    onClick={() => onReact?.(comment.id, reaction.emoji)}
                  >
                    <span>{reaction.emoji}</span>
                    <span>{reaction.userIds.length}</span>
                  </button>
                </ReactionUsersHoverCard>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ForumPostAvatar({ author }: { author: ForumUser | undefined }) {
  return (
    <div className="mt-[1px]">
      <UserAvatar
        name={author?.name}
        avatarImageUrl={author?.avatarImageUrl}
        avatarUrl={author?.avatarUrl}
        status={author?.status}
        size="sm"
      />
    </div>
  )
}
