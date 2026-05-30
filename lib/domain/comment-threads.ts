import type { AppData } from "@/lib/domain/types"

type CommentThreadNode = {
  id: string
  parentCommentId: string | null
}

export function getRootComments(comments: AppData["comments"]) {
  return comments.filter((comment) => comment.parentCommentId === null)
}

export function groupCommentsByParentId(comments: AppData["comments"]) {
  return comments.reduce<Record<string, AppData["comments"]>>(
    (accumulator, comment) => {
      if (!comment.parentCommentId) {
        return accumulator
      }

      accumulator[comment.parentCommentId] = [
        ...(accumulator[comment.parentCommentId] ?? []),
        comment,
      ]

      return accumulator
    },
    {}
  )
}

export function collectCommentDescendantIds(
  comments: readonly CommentThreadNode[],
  commentId: string
) {
  const deletedIds = new Set([commentId])
  let changed = true

  while (changed) {
    changed = false

    for (const comment of comments) {
      if (
        comment.parentCommentId &&
        deletedIds.has(comment.parentCommentId) &&
        !deletedIds.has(comment.id)
      ) {
        deletedIds.add(comment.id)
        changed = true
      }
    }
  }

  return deletedIds
}
