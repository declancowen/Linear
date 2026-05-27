import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AppData } from "@/lib/domain/types"
import { createTestAppData } from "@/tests/lib/fixtures/app-data"
import { addChannelFollowerNotifications } from "@/lib/store/app-store-internal/slices/collaboration-channel-notifications"

const channelActionTestDoubles = vi.hoisted(() => ({
  convex: {
    addComment: vi.fn(),
    createPost: vi.fn(),
    deleteComment: vi.fn(),
    deletePost: vi.fn(),
    toggleReaction: vi.fn(),
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
  const { createCollaborationChannelActions } = await import(
    "@/lib/store/app-store-internal/slices/collaboration-channel-actions"
  )
  const backgroundTasks: Array<Promise<unknown> | null> = []
  const setState = (update: unknown) => {
    const patch = typeof update === "function" ? update(state as never) : update

    Object.assign(state, patch)
  }
  const slice = createCollaborationChannelActions({
    get: () => state as never,
    runtime: {
      syncInBackground(task: Promise<unknown> | null) {
        backgroundTasks.push(task)
      },
    } as never,
    set: setState as never,
  })

  return { backgroundTasks, slice, state }
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
    channelActionTestDoubles.convex.deleteComment.mockResolvedValue({ ok: true })
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
    const { backgroundTasks, slice, state } = await createChannelActionsHarness()

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
    expect(channelActionTestDoubles.notifications.success).not.toHaveBeenCalled()
  })
})
