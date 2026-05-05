import { describe, expect, it } from "vitest"

import { assertParentCommentTarget } from "@/convex/app/comment_handlers"

describe("comment helpers", () => {
  const args = {
    targetType: "workItem",
    targetId: "item_1",
    parentCommentId: "comment_1",
  }

  it("allows root comments and replies on the same target", () => {
    expect(() =>
      assertParentCommentTarget(null, {
        ...args,
        parentCommentId: null,
      } as never)
    ).not.toThrow()
    expect(() =>
      assertParentCommentTarget(
        {
          targetType: "workItem",
          targetId: "item_1",
        } as never,
        args as never
      )
    ).not.toThrow()
  })

  it("rejects missing parent comments and cross-target replies", () => {
    expect(() => assertParentCommentTarget(null, args as never)).toThrow(
      "Parent comment not found"
    )
    expect(() =>
      assertParentCommentTarget(
        {
          targetType: "document",
          targetId: "doc_1",
        } as never,
        args as never
      )
    ).toThrow("Reply must stay on the same thread target")
  })
})
