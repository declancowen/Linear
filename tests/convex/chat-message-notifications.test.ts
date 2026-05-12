import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const createIdMock = vi.fn()
const getNowMock = vi.fn()
const getConversationAudienceUserIdsMock = vi.fn()
const requireConversationAccessMock = vi.fn()
const getCallDocMock = vi.fn()
const getChannelPostDocMock = vi.fn()
const getConversationDocMock = vi.fn()
const getTeamMembershipDocMock = vi.fn()
const getWorkspaceEditRoleMock = vi.fn()
const listUsersByIdsMock = vi.fn()
const getChannelConversationPathMock = vi.fn()
const getChatConversationPathMock = vi.fn()
const queueEmailJobsMock = vi.fn()

vi.mock("@/convex/app/access", () => ({
  requireEditableTeamAccess: vi.fn(),
  requireEditableWorkspaceAccess: vi.fn(),
  requireReadableTeamAccess: vi.fn(),
  requireReadableWorkspaceAccess: vi.fn(),
}))

vi.mock("@/convex/app/conversations", () => ({
  ensureTeamChannelConversation: vi.fn(),
  ensureTeamChatConversation: vi.fn(),
  ensureWorkspaceChannelConversation: vi.fn(),
  findPrimaryTeamChannelConversation: vi.fn(),
  findPrimaryWorkspaceChannelConversation: vi.fn(),
  findTeamChatConversation: vi.fn(),
  findWorkspaceDirectConversation: vi.fn(),
  getConversationAudienceUserIds: getConversationAudienceUserIdsMock,
  getWorkspaceUserIds: vi.fn(),
  requireConversationAccess: requireConversationAccessMock,
  updateCallRoom: vi.fn(),
  updateConversationRoom: vi.fn(),
}))

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: createIdMock,
  getNow: getNowMock,
}))

vi.mock("@/convex/app/data", () => ({
  getCallDoc: getCallDocMock,
  getChannelPostDoc: getChannelPostDocMock,
  getChatMessageDoc: vi.fn(),
  getConversationDoc: getConversationDocMock,
  getTeamMembershipDoc: getTeamMembershipDocMock,
  getTeamDoc: vi.fn(),
  getWorkspaceEditRole: getWorkspaceEditRoleMock,
  getWorkspaceDoc: vi.fn(),
  listNotificationsByEntity: vi.fn(),
  listUsersByIds: listUsersByIdsMock,
}))

vi.mock("@/convex/app/notifications", () => ({
  getChannelConversationPath: getChannelConversationPathMock,
  getChatConversationPath: getChatConversationPathMock,
}))

vi.mock("@/convex/app/normalization", () => ({
  normalizeTeam: vi.fn((team) => team),
}))

vi.mock("@/convex/app/email_job_handlers", () => ({
  queueEmailJobs: queueEmailJobsMock,
}))

function createConversation(overrides: Record<string, unknown> = {}) {
  return {
    _id: "conversation_1_doc",
    id: "conversation_1",
    kind: "chat",
    scopeType: "team",
    scopeId: "team_1",
    variant: "team",
    title: "Platform",
    description: "",
    participantIds: ["user_1", "user_2", "user_3"],
    roomId: null,
    roomName: null,
    createdBy: "user_1",
    createdAt: "2026-04-18T10:00:00.000Z",
    updatedAt: "2026-04-18T10:00:00.000Z",
    lastActivityAt: "2026-04-18T10:00:00.000Z",
    ...overrides,
  }
}

function createUser(id: string, name: string) {
  return {
    id,
    name,
    handle: name.toLowerCase(),
    email: `${id}@example.com`,
    avatarUrl: "",
    avatarImageUrl: null,
    workosUserId: null,
    title: "",
    status: "active",
    statusMessage: "",
    preferences: {
      emailMentions: true,
      emailAssignments: true,
      emailDigest: true,
      theme: "system",
    },
  }
}

describe("chat message notifications", () => {
  beforeEach(() => {
    vi.resetModules()
    assertServerTokenMock.mockReset()
    createIdMock.mockReset()
    getNowMock.mockReset()
    getConversationAudienceUserIdsMock.mockReset()
    requireConversationAccessMock.mockReset()
    getCallDocMock.mockReset()
    getChannelPostDocMock.mockReset()
    getConversationDocMock.mockReset()
    getTeamMembershipDocMock.mockReset()
    getWorkspaceEditRoleMock.mockReset()
    listUsersByIdsMock.mockReset()
    getChannelConversationPathMock.mockReset()
    getChatConversationPathMock.mockReset()
    queueEmailJobsMock.mockReset()

    createIdMock
      .mockReturnValueOnce("chat_message_1")
      .mockReturnValueOnce("notification_1")
      .mockReturnValueOnce("notification_2")
    getNowMock.mockReturnValue("2026-04-18T11:00:00.000Z")
    getConversationDocMock.mockResolvedValue(createConversation())
    requireConversationAccessMock.mockImplementation(
      async (_ctx, conversation) => conversation
    )
    getConversationAudienceUserIdsMock.mockResolvedValue([
      "user_1",
      "user_2",
      "user_3",
    ])
    listUsersByIdsMock.mockResolvedValue([
      createUser("user_1", "Alex"),
      createUser("user_2", "Sam"),
      createUser("user_3", "Jamie"),
    ])
    getChatConversationPathMock.mockResolvedValue("/chat/conversation_1")
    getChannelConversationPathMock.mockResolvedValue("/channels/conversation_1/post_1")
    queueEmailJobsMock.mockResolvedValue(undefined)
  })

  it("creates generic message notifications for participants except the sender", async () => {
    const inserts: Array<[string, unknown]> = []
    const patchMock = vi.fn()
    const { sendChatMessageHandler } = await import(
      "@/convex/app/collaboration_handlers"
    )

    await sendChatMessageHandler(
      {
        db: {
          insert: vi.fn(async (table: string, value: unknown) => {
            inserts.push([table, value])
          }),
          patch: patchMock,
        },
      } as never,
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        conversationId: "conversation_1",
        content: "<p>Hello team</p>",
      }
    )

    expect(
      inserts
        .filter(([table]) => table === "notifications")
        .map(([, notification]) => notification)
    ).toEqual([
      expect.objectContaining({
        userId: "user_2",
        actorId: "user_1",
        entityType: "chat",
        entityId: "conversation_1",
        type: "message",
      }),
      expect.objectContaining({
        userId: "user_3",
        actorId: "user_1",
        entityType: "chat",
        entityId: "conversation_1",
        type: "message",
      }),
    ])
    expect(
      inserts
        .filter(([table]) => table === "notifications")
        .map(([, notification]) => (notification as { userId: string }).userId)
    ).not.toContain("user_1")
    expect(patchMock).toHaveBeenCalledWith("conversation_1_doc", {
      updatedAt: "2026-04-18T11:00:00.000Z",
      lastActivityAt: "2026-04-18T11:00:00.000Z",
    })
  })

  it("prefers mention notifications over duplicate generic message notifications", async () => {
    const inserts: Array<[string, unknown]> = []
    const { sendChatMessageHandler } = await import(
      "@/convex/app/collaboration_handlers"
    )

    await sendChatMessageHandler(
      {
        db: {
          insert: vi.fn(async (table: string, value: unknown) => {
            inserts.push([table, value])
          }),
          patch: vi.fn(),
        },
      } as never,
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        conversationId: "conversation_1",
        content:
          '<p><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span> hello</p>',
      }
    )

    const notifications = inserts
      .filter(([table]) => table === "notifications")
      .map(([, notification]) => notification)

    expect(notifications).toEqual([
      expect.objectContaining({
        userId: "user_2",
        type: "mention",
      }),
      expect.objectContaining({
        userId: "user_3",
        type: "message",
      }),
    ])
  })

  it("marks call joins and resolves join context meeting roles", async () => {
    const { getCallJoinContextHandler, markCallJoinedHandler } = await import(
      "@/convex/app/collaboration_handlers"
    )
    const patchMock = vi.fn()
    const call = {
      _id: "call_doc_1",
      id: "call_1",
      conversationId: "conversation_1",
      roomId: null,
      roomName: null,
      roomKey: "room_1",
      roomDescription: "Team call",
      participantUserIds: ["user_2"],
      joinCount: 1,
      endedAt: null,
    }

    getCallDocMock.mockResolvedValue(call)
    getConversationDocMock.mockResolvedValue(createConversation())
    requireConversationAccessMock.mockImplementation(
      async (_ctx, conversation) => conversation
    )
    getTeamMembershipDocMock.mockResolvedValue({ role: "member" })

    await expect(
      markCallJoinedHandler(
        {
          db: {
            patch: patchMock,
          },
        } as never,
        {
          serverToken: "server_token",
          currentUserId: "user_1",
          callId: "call_1",
        }
      )
    ).resolves.toEqual({
      ok: true,
      callId: "call_1",
    })
    expect(patchMock).toHaveBeenCalledWith("call_doc_1", {
      participantUserIds: ["user_2", "user_1"],
      lastJoinedAt: "2026-04-18T11:00:00.000Z",
      lastJoinedBy: "user_1",
      joinCount: 2,
      updatedAt: "2026-04-18T11:00:00.000Z",
    })

    await expect(
      getCallJoinContextHandler({} as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        callId: "call_1",
      })
    ).resolves.toMatchObject({
      callId: "call_1",
      conversationId: "conversation_1",
      role: "host",
      roomKey: "room_1",
    })
  })

  it("creates channel comment mention and follower notifications without duplicates", async () => {
    createIdMock
      .mockReset()
      .mockReturnValueOnce("comment_1")
      .mockReturnValueOnce("notification_mention")
      .mockReturnValueOnce("notification_follower")
    const inserts: Array<[string, unknown]> = []
    const patchMock = vi.fn()
    const { addChannelPostCommentHandler } = await import(
      "@/convex/app/collaboration_handlers"
    )

    getConversationDocMock.mockResolvedValue(
      createConversation({
        kind: "channel",
        title: "General",
      })
    )
    getChannelPostDocMock.mockResolvedValue({
      _id: "post_doc_1",
      id: "post_1",
      conversationId: "conversation_1",
      title: "Launch post",
      content: "<p>Post</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: "user_3",
      createdAt: "2026-04-18T10:00:00.000Z",
      updatedAt: "2026-04-18T10:00:00.000Z",
    })
    requireConversationAccessMock.mockImplementation(
      async (_ctx, conversation) => conversation
    )

    const result = await addChannelPostCommentHandler(
      {
        db: {
          insert: vi.fn(async (table: string, value: unknown) => {
            inserts.push([table, value])
          }),
          patch: patchMock,
          query: vi.fn(() => ({
            withIndex: () => ({
              collect: vi.fn().mockResolvedValue([
                {
                  createdBy: "user_2",
                },
                {
                  createdBy: "user_3",
                },
              ]),
            }),
          })),
        },
      } as never,
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        postId: "post_1",
        content:
          '<p><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span> hello</p>',
      }
    )

    const notifications = inserts
      .filter(([table]) => table === "notifications")
      .map(([, notification]) => notification)

    expect(result).toMatchObject({
      commentId: "comment_1",
    })
    expect(notifications).toEqual([
      expect.objectContaining({
        id: "notification_mention",
        userId: "user_2",
        type: "mention",
      }),
      expect.objectContaining({
        id: "notification_follower",
        userId: "user_3",
        type: "comment",
      }),
    ])
    expect(patchMock).toHaveBeenCalledWith("post_doc_1", {
      updatedAt: "2026-04-18T11:00:00.000Z",
    })
  })
})
