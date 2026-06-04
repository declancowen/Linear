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

export function flattenCommentReplies(
  replies: AppData["comments"],
  repliesByParentId: Record<string, AppData["comments"]>
) {
  const flat: AppData["comments"] = []
  const seen = new Set<string>()

  function visit(list: AppData["comments"]) {
    for (const reply of list) {
      if (seen.has(reply.id)) {
        continue
      }

      seen.add(reply.id)
      flat.push(reply)

      const childReplies = repliesByParentId[reply.id] ?? []
      if (childReplies.length > 0) {
        visit(childReplies)
      }
    }
  }

  visit(replies)

  return flat.sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
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
