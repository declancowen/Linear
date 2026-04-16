import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const sendChatMessageServerMock = vi.fn()
const createChannelPostServerMock = vi.fn()
const addChannelPostCommentServerMock = vi.fn()
const markNotificationsEmailedServerMock = vi.fn()
const sendMentionEmailsMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  sendChatMessageServer: sendChatMessageServerMock,
  createChannelPostServer: createChannelPostServerMock,
  addChannelPostCommentServer: addChannelPostCommentServerMock,
  markNotificationsEmailedServer: markNotificationsEmailedServerMock,
}))

vi.mock("@/lib/server/email", () => ({
  sendMentionEmails: sendMentionEmailsMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

describe("rich-text route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    sendChatMessageServerMock.mockReset()
    createChannelPostServerMock.mockReset()
    addChannelPostCommentServerMock.mockReset()
    markNotificationsEmailedServerMock.mockReset()
    sendMentionEmailsMock.mockReset()
    logProviderErrorMock.mockReset()

    requireSessionMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
    requireAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_1",
      },
    })
    sendMentionEmailsMock.mockResolvedValue([])
  })

  it("maps chat-message content validation errors to a 400 response", async () => {
    const { POST } = await import("@/app/api/chats/[chatId]/messages/route")

    sendChatMessageServerMock.mockRejectedValue(
      new ApplicationError("Message content must include at least 1 character", 400, {
        code: "CHAT_MESSAGE_CONTENT_REQUIRED",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/chats/conversation_1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "<p>safe</p>",
        }),
      }) as never,
      {
        params: Promise.resolve({
          chatId: "conversation_1",
        }),
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Message content must include at least 1 character",
      message: "Message content must include at least 1 character",
      code: "CHAT_MESSAGE_CONTENT_REQUIRED",
    })
  })

  it("maps channel-post content validation errors to a 400 response", async () => {
    const { POST } = await import("@/app/api/channels/[channelId]/posts/route")

    createChannelPostServerMock.mockRejectedValue(
      new ApplicationError("Post content must include at least 2 characters", 400, {
        code: "CHANNEL_POST_CONTENT_REQUIRED",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/channels/channel_1/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Launch",
          content: "<p>safe content</p>",
        }),
      }) as never,
      {
        params: Promise.resolve({
          channelId: "channel_1",
        }),
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Post content must include at least 2 characters",
      message: "Post content must include at least 2 characters",
      code: "CHANNEL_POST_CONTENT_REQUIRED",
    })
  })

  it("maps channel-post-comment validation errors to a 400 response", async () => {
    const { POST } = await import("@/app/api/channel-posts/[postId]/comments/route")

    addChannelPostCommentServerMock.mockRejectedValue(
      new ApplicationError("Comment content must include at least 1 character", 400, {
        code: "CHANNEL_POST_COMMENT_CONTENT_REQUIRED",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/channel-posts/post_1/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "<p>safe content</p>",
        }),
      }) as never,
      {
        params: Promise.resolve({
          postId: "post_1",
        }),
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Comment content must include at least 1 character",
      message: "Comment content must include at least 1 character",
      code: "CHANNEL_POST_COMMENT_CONTENT_REQUIRED",
    })
  })
})
