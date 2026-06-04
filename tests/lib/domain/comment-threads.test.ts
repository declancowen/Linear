import { describe, expect, it } from "vitest"

import {
  flattenCommentReplies,
  groupCommentsByParentId,
} from "@/lib/domain/comment-threads"
import type { AppData } from "@/lib/domain/types"

function createComment(
  id: string,
  parentCommentId: string | null,
  createdAt: string
): AppData["comments"][number] {
  return {
    id,
    targetType: "workItem",
    targetId: "item_1",
    parentCommentId,
    content: `<p>${id}</p>`,
    mentionUserIds: [],
    reactions: [],
    createdBy: "user_1",
    createdAt,
  }
}

describe("comment thread helpers", () => {
  it("flattens reply descendants in chronological order", () => {
    const rootReply = createComment(
      "comment_reply",
      "comment_root",
      "2026-04-20T10:02:00.000Z"
    )
    const nestedReply = createComment(
      "comment_nested",
      "comment_reply",
      "2026-04-20T10:01:00.000Z"
    )
    const repliesByParentId = groupCommentsByParentId([
      rootReply,
      nestedReply,
    ])

    expect(flattenCommentReplies([rootReply], repliesByParentId)).toEqual([
      nestedReply,
      rootReply,
    ])
  })
})
