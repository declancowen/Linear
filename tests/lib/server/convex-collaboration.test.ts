import { beforeEach, describe, expect, it, vi } from "vitest"

const mutationMock = vi.fn()
const queryMock = vi.fn()

vi.mock("@/lib/server/convex/core", () => ({
  getConvexServerClient: () => ({
    mutation: mutationMock,
    query: queryMock,
  }),
  withServerToken: <T extends Record<string, unknown>>(input: T) => input,
}))

describe("convex collaboration server wrappers", () => {
  beforeEach(() => {
    mutationMock.mockReset()
    queryMock.mockReset()
  })

  it("maps known start-call domain failures to typed application errors", async () => {
    const { startChatCallServer } = await import(
      "@/lib/server/convex/collaboration"
    )

    mutationMock.mockRejectedValue(new Error("Your current role is read-only"))

    await expect(
      startChatCallServer({
        currentUserId: "user_1",
        conversationId: "conversation_1",
        roomKey: "chat-conversation_1",
        roomDescription: "Persistent video room for chat conversation_1",
      })
    ).rejects.toMatchObject({
      message: "Your current role is read-only",
      status: 403,
      code: "CHAT_READ_ONLY",
    })
  })

  it("sanitizes rich-text payloads before collaboration writes reach Convex", async () => {
    const {
      addChannelPostCommentServer,
      createChannelPostServer,
      sendChatMessageServer,
    } = await import("@/lib/server/convex/collaboration")

    mutationMock.mockResolvedValue({})

    await sendChatMessageServer({
      currentUserId: "user_1",
      conversationId: "conversation_1",
      content:
        '<p>Hello <a href="javascript:alert(1)">bad</a><script>alert(1)</script></p>',
    })
    await createChannelPostServer({
      currentUserId: "user_1",
      conversationId: "conversation_1",
      title: "Launch",
      content:
        '<p>Ship <img src="https://cdn.example.com/file.png" onerror="evil()" class="editor-image" /></p>',
    })
    await addChannelPostCommentServer({
      currentUserId: "user_1",
      postId: "post_1",
      content:
        '<p><span class="editor-mention evil" data-type="mention" data-id="user_2" data-label="alex">@alex</span></p>',
    })

    expect(mutationMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        content: "<p>Hello <a>bad</a></p>",
      })
    )
    expect(mutationMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        content:
          '<p>Ship <img src="https://cdn.example.com/file.png" class="editor-image" /></p>',
      })
    )
    expect(mutationMock).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({
        content:
          '<p><span class="editor-mention" data-type="mention" data-id="user_2" data-label="alex">@alex</span></p>',
      })
    )
  })

  it("rejects sanitized collaboration content that no longer has meaningful text", async () => {
    const {
      addChannelPostCommentServer,
      createChannelPostServer,
      sendChatMessageServer,
    } = await import("@/lib/server/convex/collaboration")

    await expect(
      sendChatMessageServer({
        currentUserId: "user_1",
        conversationId: "conversation_1",
        content: '<img src="javascript:alert(1)" /><script>alert(1)</script>',
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "CHAT_MESSAGE_CONTENT_REQUIRED",
    })

    await expect(
      createChannelPostServer({
        currentUserId: "user_1",
        conversationId: "conversation_1",
        title: "Launch",
        content: "<p>A</p>",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "CHANNEL_POST_CONTENT_REQUIRED",
    })

    await expect(
      addChannelPostCommentServer({
        currentUserId: "user_1",
        postId: "post_1",
        content: "<script>alert(1)</script>",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "CHANNEL_POST_COMMENT_CONTENT_REQUIRED",
    })
  })

  it("maps expected collaboration access and lookup failures to typed application errors", async () => {
    const {
      addChannelPostCommentServer,
      createChannelPostServer,
      sendChatMessageServer,
    } = await import("@/lib/server/convex/collaboration")

    mutationMock
      .mockRejectedValueOnce(
        new Error(
          "This chat is read-only because the other participants have left the workspace or deleted their account"
        )
      )
      .mockRejectedValueOnce(new Error("Posts can only be created in channels"))
      .mockRejectedValueOnce(new Error("Post not found"))

    await expect(
      sendChatMessageServer({
        currentUserId: "user_1",
        conversationId: "conversation_1",
        content: "<p>Hello</p>",
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "CHAT_AUDIENCE_READ_ONLY",
    })

    await expect(
      createChannelPostServer({
        currentUserId: "user_1",
        conversationId: "conversation_1",
        title: "Launch",
        content: "<p>Hello world</p>",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "CHANNEL_POST_INVALID_CONVERSATION_KIND",
    })

    await expect(
      addChannelPostCommentServer({
        currentUserId: "user_1",
        postId: "post_1",
        content: "<p>Hello</p>",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "CHANNEL_POST_NOT_FOUND",
    })
  })

  it("maps team and workspace collaboration setup failures to typed application errors", async () => {
    const {
      createChannelServer,
      createWorkspaceChatServer,
      ensureTeamChatServer,
    } = await import("@/lib/server/convex/collaboration")

    mutationMock
      .mockRejectedValueOnce(new Error("Chats need at least two workspace members"))
      .mockRejectedValueOnce(new Error("Chat is disabled for this team"))
      .mockRejectedValueOnce(
        new Error("Channel must target exactly one team or workspace")
      )

    await expect(
      createWorkspaceChatServer({
        currentUserId: "user_1",
        workspaceId: "workspace_1",
        participantIds: ["user_1"],
        title: "",
        description: "",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "CHAT_PARTICIPANTS_INVALID",
    })

    await expect(
      ensureTeamChatServer({
        currentUserId: "user_1",
        teamId: "team_1",
        title: "",
        description: "",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "TEAM_CHAT_DISABLED",
    })

    await expect(
      createChannelServer({
        currentUserId: "user_1",
        title: "",
        description: "",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "CHANNEL_TARGET_INVALID",
    })
  })

  it("maps channel-post mutation and call lifecycle failures to typed application errors", async () => {
    const {
      deleteChannelPostServer,
      markCallJoinedServer,
      setCallRoomServer,
      setConversationRoomServer,
      toggleChatMessageReactionServer,
      toggleChannelPostReactionServer,
    } = await import("@/lib/server/convex/collaboration")

    mutationMock
      .mockRejectedValueOnce(new Error("You can only delete your own posts"))
      .mockRejectedValueOnce(new Error("Message not found"))
      .mockRejectedValueOnce(new Error("Your current role is read-only"))
      .mockRejectedValueOnce(new Error("Call has already ended"))
      .mockRejectedValueOnce(new Error("Call not found"))
      .mockRejectedValueOnce(new Error("Rooms can only be attached to chats"))

    await expect(
      deleteChannelPostServer({
        currentUserId: "user_1",
        postId: "post_1",
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "CHANNEL_POST_DELETE_FORBIDDEN",
    })

    await expect(
      toggleChatMessageReactionServer({
        currentUserId: "user_1",
        messageId: "message_1",
        emoji: ":+1:",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "CHAT_MESSAGE_NOT_FOUND",
    })

    await expect(
      toggleChannelPostReactionServer({
        currentUserId: "user_1",
        postId: "post_1",
        emoji: ":+1:",
      })
    ).rejects.toMatchObject({
      status: 403,
      code: "CHANNEL_READ_ONLY",
    })

    await expect(
      markCallJoinedServer({
        currentUserId: "user_1",
        callId: "call_1",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "CHAT_CALL_ENDED",
    })

    await expect(
      setCallRoomServer({
        currentUserId: "user_1",
        callId: "call_1",
        roomId: "room_1",
        roomName: "Launch",
      })
    ).rejects.toMatchObject({
      status: 404,
      code: "CHAT_CALL_NOT_FOUND",
    })

    await expect(
      setConversationRoomServer({
        currentUserId: "user_1",
        conversationId: "conversation_1",
        roomId: "room_1",
        roomName: "Launch",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "CHAT_ROOM_INVALID_CONVERSATION_KIND",
    })
  })

  it("maps call-join lookup and finalize failures to typed application errors", async () => {
    const { finalizeCallJoinServer, getCallJoinContextServer } = await import(
      "@/lib/server/convex/collaboration"
    )

    queryMock.mockRejectedValueOnce(
      new Error("Calls can only be joined from chats")
    )
    mutationMock.mockRejectedValueOnce(new Error("Call has already ended"))

    await expect(
      getCallJoinContextServer({
        currentUserId: "user_1",
        callId: "call_1",
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "CHAT_CALL_JOIN_INVALID_CONVERSATION_KIND",
    })

    await expect(
      finalizeCallJoinServer({
        currentUserId: "user_1",
        callId: "call_1",
        conversationId: "conversation_1",
        roomId: "room_1",
        roomName: "Launch",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "CHAT_CALL_ENDED",
    })
  })
})
