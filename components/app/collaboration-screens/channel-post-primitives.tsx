"use client"

import { useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import { NotePencil, Smiley, Trash } from "@phosphor-icons/react"

import { EmojiPickerPopover } from "@/components/app/emoji-picker-popover"
import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import { RichTextContent } from "@/components/app/rich-text-content"
import { RichTextEditor } from "@/components/app/rich-text-editor"
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
  workspaceId,
  size = "post",
}: {
  author: ForumUser | undefined
  createdAt: string
  currentUserId: string
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
  mentionCandidates: ForumUser[]
  usersById: UsersById
  workspaceId: string | null
}) {
  const commentAuthor = usersById.get(comment.createdBy)
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
      className="group/comment grid items-start gap-x-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2"
      style={{ gridTemplateColumns: "24px minmax(0,1fr) auto" }}
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
        <ForumPostAuthorLine
          author={commentAuthor}
          createdAt={comment.createdAt}
          currentUserId={currentUserId}
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
            className="text-[13px] leading-[1.5] text-foreground [&_p]:leading-[1.5]"
          />
        )}
      </div>
      {canEdit || canDelete ? (
        <div className="mt-0.5 flex items-center gap-0.5 opacity-0 transition group-hover/comment:opacity-100 focus-within:opacity-100">
          {canEdit ? (
            <button
              type="button"
              aria-label="Edit comment"
              className="grid size-6 place-items-center rounded-md text-fg-3 transition hover:bg-surface-3 hover:text-foreground"
              onClick={() => {
                setEditContent(comment.content)
                setEditOpen(true)
              }}
            >
              <NotePencil className="size-3.5" />
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              aria-label="Delete comment"
              className="grid size-6 place-items-center rounded-md text-fg-3 transition hover:bg-surface-3 hover:text-foreground"
              onClick={() => onDelete?.(comment.id)}
            >
              <Trash className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
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
