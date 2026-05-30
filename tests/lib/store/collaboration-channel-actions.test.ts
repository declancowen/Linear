import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AppData } from "@/lib/domain/types"
import { createTestAppData } from "@/tests/lib/fixtures/app-data"
import { addChannelFollowerNotifications } from "@/lib/store/app-store-internal/slices/collaboration-channel-notifications"
import { createSliceHarness } from "./slice-harness"

const channelActionTestDoubles = vi.hoisted(() => ({
  convex: {
    addComment: vi.fn(),
    createPost: vi.fn(),
    deleteComment: vi.fn(),
    deletePost: vi.fn(),
    toggleReaction: vi.fn(),
    updateComment: vi.fn(),
    updatePost: vi.fn(),
  },
  notifications: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: {
    error: channelActionTestDoubles.notifications.error,
    success: channelActionTestDoubles.notifications.success,
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncAddChannelPostComment: channelActionTestDoubles.convex.addComment,
  syncCreateChannelPost: channelActionTestDoubles.convex.createPost,
  syncDeleteChannelPost: channelActionTestDoubles.convex.deletePost,
  syncDeleteChannelPostComment: channelActionTestDoubles.convex.deleteComment,
  syncToggleChannelPostReaction: channelActionTestDoubles.convex.toggleReaction,
  syncUpdateChannelPost: channelActionTestDoubles.convex.updatePost,
  syncUpdateChannelPostComment: channelActionTestDoubles.convex.updateComment,
}))

const TEST_TIMESTAMP = "2026-04-20T12:00:00.000Z"

function createChannelState(overrides: Partial<AppData> = {}) {
  return createTestAppData({
    conversations: [
      {
        id: "conversation_1",
        kind: "channel",
        scopeType: "team",
        scopeId: "team_1",
        variant: "team",
        title: "Platform",
        description: "",
        participantIds: ["user_1", "user_2"],
        createdBy: "user_1",
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP,
        lastActivityAt: TEST_TIMESTAMP,
      },
    ],
    channelPosts: [
      {
        id: "post_1",
        conversationId: "conversation_1",
        title: "Roadmap",
        content: "<p>Post</p>",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP,
      },
    ],
    channelPostComments: [
      {
        id: "comment_1",
        postId: "post_1",
        content: "<p>Reply</p>",
        mentionUserIds: [],
        createdBy: "user_1",
        createdAt: TEST_TIMESTAMP,
      },
    ],
    ...overrides,
  })
}

async function createChannelActionsHarness(state = createChannelState()) {
  const { createCollaborationChannelActions } =
    await import("@/lib/store/app-store-internal/slices/collaboration-channel-actions")
  return createSliceHarness(state, (args) =>
    createCollaborationChannelActions(args as never)
  )
}

describe("collaboration channel notification helpers", () => {
  beforeEach(() => {
    vi.resetModules()
    Object.values(channelActionTestDoubles.convex).forEach((mock) =>
      mock.mockReset()
    )
    Object.values(channelActionTestDoubles.notifications).forEach((mock) =>
      mock.mockReset()
    )
    channelActionTestDoubles.convex.addComment.mockResolvedValue({
      commentId: "comment_server",
    })
    channelActionTestDoubles.convex.createPost.mockResolvedValue({
      postId: "post_server",
    })
    channelActionTestDoubles.convex.deleteComment.mockResolvedValue({
      ok: true,
    })
    channelActionTestDoubles.convex.updateComment.mockResolvedValue({
      ok: true,
    })
    channelActionTestDoubles.convex.updatePost.mockResolvedValue({
      ok: true,
    })
  })

  it("notifies eligible followers once for channel comments", () => {
    const notifications = [] as Array<{
      actorId: string
      entityId: string
      entityType: string
      title: string
      type: string
      userId: string
    }>
    const notifiedUserIds = new Set(["user_already"])

    addChannelFollowerNotifications(notifications as never, {
      actorName: "Alex",
      audienceUserIds: ["user_2", "user_already"],
      currentUserId: "user_1",
      entityId: "post_1",
      entityTitle: "the roadmap thread",
      followerIds: ["", "user_outside", "user_1", "user_already", "user_2"],
      notifiedUserIds,
    })

    expect(notifications).toEqual([
      expect.objectContaining({
        actorId: "user_1",
        entityId: "post_1",
        entityType: "channelPost",
        message: "Alex commented on the roadmap thread",
        type: "comment",
        userId: "user_2",
      }),
    ])
    expect([...notifiedUserIds].sort()).toEqual(["user_2", "user_already"])
  })

  it("optimistically deletes owned channel-post comments and syncs the delete", async () => {
    const { backgroundTasks, slice, state } =
      await createChannelActionsHarness()

    slice.deleteChannelPostComment("post_1", "comment_1")

    expect(state.channelPostComments).toEqual([])
    expect(state.channelPosts[0]?.updatedAt).not.toBe(TEST_TIMESTAMP)
    expect(state.conversations[0]?.lastActivityAt).not.toBe(TEST_TIMESTAMP)
    expect(channelActionTestDoubles.convex.deleteComment).toHaveBeenCalledWith(
      "post_1",
      "comment_1"
    )
    expect(backgroundTasks).toHaveLength(1)
    expect(channelActionTestDoubles.notifications.success).toHaveBeenCalledWith(
      "Comment deleted"
    )
  })

  it("syncs newly created posts with the optimistic post id", async () => {
    const { slice, state } = await createChannelActionsHarness()

    slice.createChannelPost({
      conversationId: "conversation_1",
      title: "Launch notes",
      content: "<p>Fresh post</p>",
    })

    const createdPost = state.channelPosts.find(
      (post) => post.title === "Launch notes"
    )

    expect(createdPost?.id).toMatch(/^channel_post_/)
    expect(channelActionTestDoubles.convex.createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: createdPost?.id,
        title: "Launch notes",
        content: "<p>Fresh post</p>",
      })
    )
  })

  it("optimistically deletes owned channel posts and syncs the delete", async () => {
    const { backgroundTasks, slice, state } =
      await createChannelActionsHarness()

    slice.deleteChannelPost("post_1")

    expect(state.channelPosts).toEqual([])
    expect(state.channelPostComments).toEqual([])
    expect(channelActionTestDoubles.convex.deletePost).toHaveBeenCalledWith(
      "post_1"
    )
    expect(backgroundTasks).toHaveLength(1)
    expect(channelActionTestDoubles.notifications.success).toHaveBeenCalledWith(
      "Post deleted"
    )
  })

  it("does not delete or sync channel posts owned by another user", async () => {
    const state = createChannelState({
      channelPosts: [
        {
          id: "post_1",
          conversationId: "conversation_1",
          title: "Roadmap",
          content: "<p>Post</p>",
          mentionUserIds: [],
          reactions: [],
          createdBy: "user_2",
          createdAt: TEST_TIMESTAMP,
          updatedAt: TEST_TIMESTAMP,
        },
      ],
    })
    const { backgroundTasks, slice } = await createChannelActionsHarness(state)

    slice.deleteChannelPost("post_1")

    expect(state.channelPosts).toHaveLength(1)
    expect(channelActionTestDoubles.convex.deletePost).not.toHaveBeenCalled()
    expect(backgroundTasks).toEqual([])
    expect(channelActionTestDoubles.notifications.error).toHaveBeenCalledWith(
      "You can only delete your own posts"
    )
    expect(
      channelActionTestDoubles.notifications.success
    ).not.toHaveBeenCalled()
  })

  it("deletes a pending-created channel post after create sync resolves", async () => {
    let resolveCreatePost: ((value: { postId: string }) => void) | undefined
    channelActionTestDoubles.convex.createPost.mockReturnValue(
      new Promise((resolve) => {
        resolveCreatePost = resolve
      })
    )
    const { backgroundTasks, slice, state } =
      await createChannelActionsHarness()

    slice.createChannelPost({
      conversationId: "conversation_1",
      title: "Transient post",
      content: "<p>Transient body</p>",
    })

    const optimisticPost = state.channelPosts.find(
      (post) => post.title === "Transient post"
    )

    expect(optimisticPost).toBeTruthy()

    slice.deleteChannelPost(optimisticPost?.id ?? "")

    expect(
      state.channelPosts.some((post) => post.id === optimisticPost?.id)
    ).toBe(false)
    expect(channelActionTestDoubles.convex.deletePost).not.toHaveBeenCalled()

    resolveCreatePost?.({ postId: optimisticPost?.id ?? "post_missing" })
    await backgroundTasks[0]
    await backgroundTasks[1]

    expect(channelActionTestDoubles.convex.deletePost).toHaveBeenCalledTimes(1)
    expect(channelActionTestDoubles.convex.deletePost).toHaveBeenCalledWith(
      optimisticPost?.id
    )
  })

  it("optimistically edits owned channel posts and syncs the update", async () => {
    const { backgroundTasks, slice, state } =
      await createChannelActionsHarness()

    slice.updateChannelPost("post_1", {
      title: "Updated roadmap",
      content: "<p>Updated post body</p>",
    })

    expect(state.channelPosts[0]).toMatchObject({
      id: "post_1",
      title: "Updated roadmap",
      content: "<p>Updated post body</p>",
    })
    expect(channelActionTestDoubles.convex.updatePost).toHaveBeenCalledWith({
      postId: "post_1",
      title: "Updated roadmap",
      content: "<p>Updated post body</p>",
    })
    expect(backgroundTasks).toHaveLength(1)
  })

  it("optimistically edits owned channel-post comments and syncs the update", async () => {
    const { backgroundTasks, slice, state } =
      await createChannelActionsHarness()

    slice.updateChannelPostComment("post_1", "comment_1", {
      content: "<p>Updated reply</p>",
    })

    expect(state.channelPostComments[0]).toMatchObject({
      id: "comment_1",
      content: "<p>Updated reply</p>",
    })
    expect(channelActionTestDoubles.convex.updateComment).toHaveBeenCalledWith(
      "post_1",
      "comment_1",
      "<p>Updated reply</p>"
    )
    expect(backgroundTasks).toHaveLength(1)
  })

  it("does not delete or sync comments owned by another user", async () => {
    const state = createChannelState({
      channelPostComments: [
        {
          id: "comment_1",
          postId: "post_1",
          content: "<p>Reply</p>",
          mentionUserIds: [],
          createdBy: "user_2",
          createdAt: TEST_TIMESTAMP,
        },
      ],
    })
    const { backgroundTasks, slice } = await createChannelActionsHarness(state)

    slice.deleteChannelPostComment("post_1", "comment_1")

    expect(state.channelPostComments).toHaveLength(1)
    expect(channelActionTestDoubles.convex.deleteComment).not.toHaveBeenCalled()
    expect(backgroundTasks).toEqual([])
    expect(channelActionTestDoubles.notifications.error).toHaveBeenCalledWith(
      "You can only delete your own comments"
    )
    expect(
      channelActionTestDoubles.notifications.success
    ).not.toHaveBeenCalled()
  })

  it("reconciles created channel-post comment ids from the server", async () => {
    const { backgroundTasks, slice, state } =
      await createChannelActionsHarness()

    slice.addChannelPostComment({
      postId: "post_1",
      content: "<p>Fresh reply</p>",
    })

    const optimisticComment = state.channelPostComments.find(
      (comment) => comment.content === "<p>Fresh reply</p>"
    )

    expect(optimisticComment?.id).toMatch(/^channel_comment_/)
    expect(optimisticComment?.id).not.toBe("comment_server")

    await backgroundTasks[0]

    expect(state.channelPostComments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "comment_server",
          content: "<p>Fresh reply</p>",
        }),
      ])
    )
    expect(
      state.channelPostComments.some(
        (comment) => comment.id === optimisticComment?.id
      )
    ).toBe(false)
  })

  it("deletes the server-created comment when an optimistic reply is removed before create sync resolves", async () => {
    let resolveCreateComment:
      | ((value: { commentId: string }) => void)
      | undefined
    channelActionTestDoubles.convex.addComment.mockReturnValue(
      new Promise((resolve) => {
        resolveCreateComment = resolve
      })
    )
    const { backgroundTasks, slice, state } =
      await createChannelActionsHarness()

    slice.addChannelPostComment({
      postId: "post_1",
      content: "<p>Transient reply</p>",
    })

    const optimisticComment = state.channelPostComments.find(
      (comment) => comment.content === "<p>Transient reply</p>"
    )

    expect(optimisticComment).toBeTruthy()

    slice.deleteChannelPostComment("post_1", optimisticComment?.id ?? "")

    expect(
      state.channelPostComments.some(
        (comment) => comment.id === optimisticComment?.id
      )
    ).toBe(false)
    expect(channelActionTestDoubles.convex.deleteComment).not.toHaveBeenCalled()

    resolveCreateComment?.({ commentId: "comment_server_after_delete" })
    await backgroundTasks[0]
    await backgroundTasks[1]

    expect(channelActionTestDoubles.convex.deleteComment).toHaveBeenCalledTimes(
      1
    )
    expect(channelActionTestDoubles.convex.deleteComment).toHaveBeenCalledWith(
      "post_1",
      "comment_server_after_delete"
    )
  })
})
