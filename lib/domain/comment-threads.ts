import type { AppData } from "@/lib/domain/types"

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
