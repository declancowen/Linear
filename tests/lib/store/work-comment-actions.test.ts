import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createTestAppData,
  createTestDocument,
  createTestProject,
  createTestViewDefinition,
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

function referenceAnchor(type: string, id: string) {
  return `<a data-type="entity-reference" data-reference-type="${type}" data-reference-id="${id}" href="#">${id}</a>`
}

function createCommentState() {
  return createTestAppData({
    workItems: [
      createTestWorkItem("item_1", {
        updatedAt: TEST_TIMESTAMP,
      }),
      createTestWorkItem("item_2", {
        key: "PLA-2",
        title: "Referenced item",
      }),
    ],
    documents: [
      createTestDocument({
        id: "document_1",
        kind: "team-document",
        teamId: "team_1",
        title: "Referenced document",
      }),
    ],
    projects: [
      createTestProject({
        id: "project_1",
        scopeType: "team",
        scopeId: "team_1",
        name: "Referenced project",
      }),
    ],
    views: [
      createTestViewDefinition({
        id: "view_1",
        scopeType: "team",
        scopeId: "team_1",
        name: "Referenced view",
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

  it("stores optimistic comment references across allowed entity types", async () => {
    workCommentTestDoubles.convex.addComment.mockResolvedValue({
      ok: true,
      commentId: "comment_client",
    })
    const { slice, state } = await createWorkCommentActionsHarness()

    slice.addComment({
      targetType: "workItem",
      targetId: "item_1",
      content: [
        referenceAnchor("workItem", "item_2"),
        referenceAnchor("document", "document_1"),
        referenceAnchor("project", "project_1"),
        referenceAnchor("view", "view_1"),
      ].join(""),
    })

    const comment = state.comments.find(
      (entry) => entry.createdAt !== TEST_TIMESTAMP
    )

    expect(comment).toMatchObject({
      referencedWorkItemIds: ["item_2"],
      referencedDocumentIds: ["document_1"],
      referencedProjectIds: ["project_1"],
      referencedViewIds: ["view_1"],
    })
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

  it("does not create or sync comments for private work items", async () => {
    const { backgroundTasks, slice, state } =
      await createWorkCommentActionsHarness(
        createTestAppData({
          currentUserId: "user_1",
          currentWorkspaceId: "workspace_1",
          workItems: [
            createTestWorkItem("private_item", {
              creatorId: "user_1",
              teamId: null,
              workspaceId: "workspace_1",
              visibility: "private",
            }),
          ],
          comments: [],
        })
      )

    slice.addComment({
      targetType: "workItem",
      targetId: "private_item",
      content: "<p>Private comment</p>",
    })

    expect(state.comments).toEqual([])
    expect(workCommentTestDoubles.convex.addComment).not.toHaveBeenCalled()
    expect(backgroundTasks).toEqual([])
    expect(workCommentTestDoubles.notifications.error).toHaveBeenCalledWith(
      "Comments are not available on private tasks"
    )
  })
})
