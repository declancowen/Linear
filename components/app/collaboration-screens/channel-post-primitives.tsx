"use client"

import { RichTextContent } from "@/components/app/rich-text-content"
import { UserAvatar, UserHoverCard } from "@/components/app/user-presence"
import { formatTimestamp } from "@/components/app/collaboration-screens/utils"
import type { AppData, UserProfile } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

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
  comment,
  currentUserId,
  usersById,
  workspaceId,
}: {
  comment: ForumPostComment
  currentUserId: string
  usersById: UsersById
  workspaceId: string | null
}) {
  const commentAuthor = usersById.get(comment.createdBy)

  return (
    <div
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
        <ForumPostAuthorLine
          author={commentAuthor}
          createdAt={comment.createdAt}
          currentUserId={currentUserId}
          workspaceId={workspaceId}
          size="comment"
        />
        <RichTextContent
          content={comment.content}
          className="text-[13px] leading-[1.5] text-foreground [&_p]:leading-[1.5]"
        />
      </div>
    </div>
  )
}

export function ForumPostAvatar({
  author,
}: {
  author: ForumUser | undefined
}) {
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
