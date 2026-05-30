import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createTestAppData,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"
import { createSliceHarness } from "./slice-harness"

const workCommentTestDoubles = vi.hoisted(() => ({
  convex: {
    addComment: vi.fn(),
    deleteComment: vi.fn(),
    toggleReaction: vi.fn(),
    updateComment: vi.fn(),
  },
  notifications: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: {
    error: workCommentTestDoubles.notifications.error,
    success: workCommentTestDoubles.notifications.success,
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncAddComment: workCommentTestDoubles.convex.addComment,
  syncDeleteComment: workCommentTestDoubles.convex.deleteComment,
  syncToggleCommentReaction: workCommentTestDoubles.convex.toggleReaction,
  syncUpdateComment: workCommentTestDoubles.convex.updateComment,
}))

const TEST_TIMESTAMP = "2026-04-20T12:00:00.000Z"

function createCommentState() {
  return createTestAppData({
    workItems: [
      createTestWorkItem("item_1", {
        updatedAt: TEST_TIMESTAMP,
      }),
    ],
    users: [
      {
        id: "user_1",
        name: "Alex",
        handle: "alex",
        email: "alex@example.com",
        avatarUrl: "",
        avatarImageUrl: null,
        workosUserId: null,
        title: "Engineer",
        status: "active",
        statusMessage: "",
        preferences: {
          emailMentions: true,
          emailAssignments: true,
          emailDigest: true,
          theme: "system",
        },
      },
      {
        id: "user_2",
        name: "Blake",
        handle: "blake",
        email: "blake@example.com",
        avatarUrl: "",
        avatarImageUrl: null,
        workosUserId: null,
        title: "Designer",
        status: "active",
        statusMessage: "",
        preferences: {
          emailMentions: true,
          emailAssignments: true,
          emailDigest: true,
          theme: "system",
        },
      },
    ],
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "admin",
      },
      {
        teamId: "team_1",
        userId: "user_2",
        role: "member",
      },
    ],
    comments: [
      {
        id: "comment_root",
        targetType: "workItem",
        targetId: "item_1",
        parentCommentId: null,
        content: "<p>Root comment</p>",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: TEST_TIMESTAMP,
      },
      {
        id: "comment_reply",
        targetType: "workItem",
        targetId: "item_1",
        parentCommentId: "comment_root",
        content: "<p>Reply comment</p>",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_2",
        createdAt: TEST_TIMESTAMP,
      },
    ],
  })
}

async function createWorkCommentActionsHarness(state = createCommentState()) {
  const { createWorkCommentActions } =
    await import("@/lib/store/app-store-internal/slices/work-comment-actions")
  return createSliceHarness(state, (args) =>
    createWorkCommentActions(args as never)
  )
}

describe("work comment actions", () => {
  beforeEach(() => {
    vi.resetModules()
    Object.values(workCommentTestDoubles.convex).forEach((mock) =>
      mock.mockReset()
    )
    Object.values(workCommentTestDoubles.notifications).forEach((mock) =>
      mock.mockReset()
    )
    workCommentTestDoubles.convex.deleteComment.mockResolvedValue({ ok: true })
    workCommentTestDoubles.convex.updateComment.mockResolvedValue({ ok: true })
  })

  it("deletes a work-item comment with its reply subtree", async () => {
    const { backgroundTasks, slice, state } =
      await createWorkCommentActionsHarness()

    slice.deleteComment("comment_root")

    expect(state.comments).toEqual([])
    expect(state.workItems[0]?.updatedAt).not.toBe(TEST_TIMESTAMP)
    expect(workCommentTestDoubles.convex.deleteComment).toHaveBeenCalledWith(
      "comment_root"
    )
    expect(backgroundTasks).toHaveLength(1)
  })

  it("does not delete or sync comments created by another user", async () => {
    const { backgroundTasks, slice, state } =
      await createWorkCommentActionsHarness()

    slice.deleteComment("comment_reply")

    expect(state.comments.map((comment) => comment.id)).toEqual([
      "comment_root",
      "comment_reply",
    ])
    expect(workCommentTestDoubles.convex.deleteComment).not.toHaveBeenCalled()
    expect(backgroundTasks).toEqual([])
    expect(workCommentTestDoubles.notifications.error).toHaveBeenCalledWith(
      "You can only edit or delete your own comments"
    )
  })

  it("optimistically edits owned comments and syncs the update", async () => {
    const { backgroundTasks, slice, state } =
      await createWorkCommentActionsHarness()

    slice.updateComment("comment_root", {
      content: "<p>Updated comment</p>",
    })

    expect(state.comments[0]).toMatchObject({
      id: "comment_root",
      content: "<p>Updated comment</p>",
    })
    expect(workCommentTestDoubles.convex.updateComment).toHaveBeenCalledWith(
      "comment_root",
      "<p>Updated comment</p>"
    )
    expect(backgroundTasks).toHaveLength(1)
  })

  it("uses the optimistic id and defers edits while comment creation is pending", async () => {
    let resolveCreate:
      | ((value: { ok: true; commentId: string | null }) => void)
      | undefined
    workCommentTestDoubles.convex.addComment.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve
      })
    )
    const { backgroundTasks, slice, state } =
      await createWorkCommentActionsHarness()

    slice.addComment({
      targetType: "workItem",
      targetId: "item_1",
      content: "<p>Fresh comment</p>",
    })

    const optimisticComment = state.comments.find(
      (comment) => comment.content === "<p>Fresh comment</p>"
    )
    expect(optimisticComment?.id).toMatch(/^comment_/)
    expect(workCommentTestDoubles.convex.addComment).toHaveBeenCalledWith(
      "user_1",
      "workItem",
      "item_1",
      "<p>Fresh comment</p>",
      undefined,
      optimisticComment?.id
    )

    slice.updateComment(optimisticComment?.id ?? "", {
      content: "<p>Fresh comment edited</p>",
    })

    expect(workCommentTestDoubles.convex.updateComment).not.toHaveBeenCalled()

    resolveCreate?.({
      ok: true,
      commentId: optimisticComment?.id ?? null,
    })
    await Promise.all(backgroundTasks.filter(Boolean))

    expect(workCommentTestDoubles.convex.updateComment).toHaveBeenCalledWith(
      optimisticComment?.id,
      "<p>Fresh comment edited</p>"
    )
  })
})
