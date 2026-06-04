import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const createIdMock = vi.fn()
const getNowMock = vi.fn()
const getConversationAudienceUserIdsMock = vi.fn()
const requireConversationAccessMock = vi.fn()
const getCallDocMock = vi.fn()
const getChannelPostDocMock = vi.fn()
const getChatReadStateDocMock = vi.fn()
const getChatMessageDocMock = vi.fn()
const getConversationDocMock = vi.fn()
const getTeamMembershipDocMock = vi.fn()
const getWorkspaceEditRoleMock = vi.fn()
const listChatMessagesByConversationMock = vi.fn()
const listNotificationsByEntityMock = vi.fn()
const listUsersByIdsMock = vi.fn()
const getChannelConversationPathMock = vi.fn()
const getChatConversationPathMock = vi.fn()
const queueEmailJobsMock = vi.fn()
const queueMentionAndCommentEmailJobsMock = vi.fn()

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

vi.mock("@/convex/app/data", async () => {
  const { createEmptyConvexRelationshipDataMocks } = await import(
    "@/tests/lib/fixtures/convex"
  )

  return {
    ...createEmptyConvexRelationshipDataMocks(),
    getCallDoc: getCallDocMock,
    getChannelPostDoc: getChannelPostDocMock,
    getChatReadStateDoc: getChatReadStateDocMock,
    getChatMessageDoc: getChatMessageDocMock,
    getConversationDoc: getConversationDocMock,
    getTeamMembershipDoc: getTeamMembershipDocMock,
    getTeamDoc: vi.fn(),
    getWorkspaceDoc: vi.fn(),
    getWorkspaceEditRole: getWorkspaceEditRoleMock,
    listChatMessagesByConversation: listChatMessagesByConversationMock,
    listNotificationsByEntity: listNotificationsByEntityMock,
    listUsersByIds: listUsersByIdsMock,
  }
})

vi.mock("@/convex/app/notifications", () => ({
  getChannelConversationPath: getChannelConversationPathMock,
  getChatConversationPath: getChatConversationPathMock,
}))

vi.mock("@/convex/app/normalization", () => ({
  normalizeTeam: vi.fn((team) => team),
}))

vi.mock("@/convex/app/email_job_handlers", () => ({
  queueEmailJobs: queueEmailJobsMock,
  queueMentionAndCommentEmailJobs: queueMentionAndCommentEmailJobsMock,
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

function createWorkspaceDirectConversation(overrides: Record<string, unknown> = {}) {
  return createConversation({
    scopeType: "workspace",
    scopeId: "workspace_1",
    variant: "direct",
    participantIds: ["user_1", "user_2"],
    ...overrides,
  })
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

type InsertCapture = Array<[string, unknown]>
type QueryMock = ReturnType<typeof vi.fn>

function createInsertCaptureCtx(
  inserts: InsertCapture,
  patch = vi.fn(),
  query?: QueryMock
) {
  return {
    db: {
      insert: vi.fn(async (table: string, value: unknown) => {
        inserts.push([table, value])
      }),
      patch,
      ...(query ? { query } : {}),
    },
  } as never
}

function getInsertedRecords(inserts: InsertCapture, tableName: string) {
  return inserts
    .filter(([table]) => table === tableName)
    .map(([, record]) => record)
}

function getInsertedChatReadStates(inserts: InsertCapture) {
  return getInsertedRecords(inserts, "chatReadStates")
}

function getInsertedNotifications(inserts: InsertCapture) {
  return getInsertedRecords(inserts, "notifications")
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
    getChatReadStateDocMock.mockReset()
    getChatMessageDocMock.mockReset()
    getConversationDocMock.mockReset()
    getTeamMembershipDocMock.mockReset()
    getWorkspaceEditRoleMock.mockReset()
    listChatMessagesByConversationMock.mockReset()
    listNotificationsByEntityMock.mockReset()
    listUsersByIdsMock.mockReset()
    getChannelConversationPathMock.mockReset()
    getChatConversationPathMock.mockReset()
    queueEmailJobsMock.mockReset()
    queueMentionAndCommentEmailJobsMock.mockReset()

    createIdMock
      .mockReturnValueOnce("chat_message_1")
      .mockReturnValueOnce("notification_1")
      .mockReturnValueOnce("notification_2")
    getNowMock.mockReturnValue("2026-04-18T11:00:00.000Z")
    getConversationDocMock.mockResolvedValue(createConversation())
    getChatReadStateDocMock.mockResolvedValue(null)
    listChatMessagesByConversationMock.mockResolvedValue([])
    listNotificationsByEntityMock.mockResolvedValue([])
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

  it("requires write access before toggling chat message reactions", async () => {
    const patchMock = vi.fn()
    const { toggleChatMessageReactionHandler } = await import(
      "@/convex/app/collaboration_handlers"
    )

    getChatMessageDocMock.mockResolvedValue({
      _id: "message_1_doc",
      id: "message_1",
      conversationId: "conversation_1",
      kind: "text",
      content: "<p>Hello</p>",
      mentionUserIds: [],
      reactions: [],
      createdBy: "user_2",
      createdAt: "2026-04-18T10:00:00.000Z",
      deletedAt: null,
    })

    await toggleChatMessageReactionHandler(
      {
        db: {
          patch: patchMock,
        },
      } as never,
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        messageId: "message_1",
        emoji: "🔥",
      }
    )

    expect(requireConversationAccessMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "conversation_1" }),
      "user_1",
      "write"
    )
    expect(patchMock).toHaveBeenCalledWith("message_1_doc", {
      reactions: [
        {
          emoji: "🔥",
          userIds: ["user_1"],
        },
      ],
    })
  })

  it("marks chat recipients unread without creating inbox message notifications", async () => {
    const inserts: InsertCapture = []
    const patchMock = vi.fn()
    const { sendChatMessageHandler } = await import(
      "@/convex/app/collaboration_handlers"
    )

    await sendChatMessageHandler(
      createInsertCaptureCtx(inserts, patchMock),
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        conversationId: "conversation_1",
        content: "<p>Hello team</p>",
      }
    )

    expect(getInsertedNotifications(inserts)).toEqual([])
    expect(getInsertedChatReadStates(inserts)).toEqual([
      expect.objectContaining({
        userId: "user_1",
        conversationId: "conversation_1",
        readAt: "2026-04-18T11:00:00.000Z",
        unreadAt: null,
        messageReadAtById: {},
      }),
      expect.objectContaining({
        userId: "user_2",
        conversationId: "conversation_1",
        readAt: null,
        unreadAt: "2026-04-18T11:00:00.000Z",
      }),
      expect.objectContaining({
        userId: "user_3",
        conversationId: "conversation_1",
        readAt: null,
        unreadAt: "2026-04-18T11:00:00.000Z",
      }),
    ])
    expect(patchMock).toHaveBeenCalledWith("conversation_1_doc", {
      updatedAt: "2026-04-18T11:00:00.000Z",
      lastActivityAt: "2026-04-18T11:00:00.000Z",
    })
  })

  it("preserves existing per-message first-read timestamps when reading a chat", async () => {
    const patchMock = vi.fn()
    const { markChatConversationRead } = await import(
      "@/convex/app/chat_read_states"
    )

    getConversationDocMock.mockResolvedValueOnce(createWorkspaceDirectConversation())
    getChatReadStateDocMock.mockResolvedValueOnce({
      _id: "chat_read_state_doc",
      id: "chat_read_state_user_1_conversation_1",
      userId: "user_1",
      conversationId: "conversation_1",
      readAt: "2026-04-18T10:30:00.000Z",
      unreadAt: "2026-04-18T10:45:00.000Z",
      messageReadAtById: {
        message_old: "2026-04-18T10:30:00.000Z",
      },
      createdAt: "2026-04-18T10:30:00.000Z",
      updatedAt: "2026-04-18T10:45:00.000Z",
    })
    listChatMessagesByConversationMock.mockResolvedValueOnce([
      {
        id: "message_old",
        conversationId: "conversation_1",
        createdBy: "user_2",
        createdAt: "2026-04-18T10:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "message_new",
        conversationId: "conversation_1",
        createdBy: "user_2",
        createdAt: "2026-04-18T10:01:00.000Z",
        deletedAt: null,
      },
      {
        id: "message_self",
        conversationId: "conversation_1",
        createdBy: "user_1",
        createdAt: "2026-04-18T10:02:00.000Z",
        deletedAt: null,
      },
    ])

    await markChatConversationRead(
      {
        db: {
          patch: patchMock,
        },
      } as never,
      {
        userId: "user_1",
        conversationId: "conversation_1",
        now: "2026-04-18T11:00:00.000Z",
        messageIds: ["message_old", "message_new", "message_self"],
      }
    )

    expect(patchMock).toHaveBeenCalledWith("chat_read_state_doc", {
      readAt: "2026-04-18T11:00:00.000Z",
      unreadAt: null,
      messageReadAtById: {
        message_old: "2026-04-18T10:30:00.000Z",
        message_new: "2026-04-18T11:00:00.000Z",
      },
      updatedAt: "2026-04-18T11:00:00.000Z",
    })
  })

  it("does not patch chat read state when the read boundary is unchanged", async () => {
    const patchMock = vi.fn()
    const { markChatConversationRead } = await import(
      "@/convex/app/chat_read_states"
    )

    getConversationDocMock.mockResolvedValueOnce(createWorkspaceDirectConversation())
    getChatReadStateDocMock.mockResolvedValueOnce({
      _id: "chat_read_state_doc",
      id: "chat_read_state_user_1_conversation_1",
      userId: "user_1",
      conversationId: "conversation_1",
      readAt: "2026-04-18T10:30:00.000Z",
      unreadAt: null,
      messageReadAtById: {
        message_old: "2026-04-18T10:30:00.000Z",
      },
      createdAt: "2026-04-18T10:30:00.000Z",
      updatedAt: "2026-04-18T10:30:00.000Z",
    })
    listChatMessagesByConversationMock.mockResolvedValueOnce([
      {
        id: "message_old",
        conversationId: "conversation_1",
        createdBy: "user_2",
        createdAt: "2026-04-18T10:00:00.000Z",
        deletedAt: null,
      },
    ])

    await markChatConversationRead(
      {
        db: {
          patch: patchMock,
        },
      } as never,
      {
        userId: "user_1",
        conversationId: "conversation_1",
        now: "2026-04-18T11:00:00.000Z",
        messageIds: ["message_old"],
      }
    )

    expect(patchMock).not.toHaveBeenCalled()
  })

  it("still clears legacy chat notifications when chat read state is unchanged", async () => {
    const patchMock = vi.fn()
    const { markChatConversationRead } = await import(
      "@/convex/app/chat_read_states"
    )

    getChatReadStateDocMock.mockResolvedValueOnce({
      _id: "chat_read_state_doc",
      id: "chat_read_state_user_1_conversation_1",
      userId: "user_1",
      conversationId: "conversation_1",
      readAt: "2026-04-18T10:30:00.000Z",
      unreadAt: null,
      messageReadAtById: {},
      createdAt: "2026-04-18T10:30:00.000Z",
      updatedAt: "2026-04-18T10:30:00.000Z",
    })
    listNotificationsByEntityMock.mockResolvedValueOnce([
      {
        _id: "notification_doc",
        id: "notification_1",
        userId: "user_1",
        entityType: "chat",
        entityId: "conversation_1",
        type: "message",
        readAt: null,
      },
    ])

    await markChatConversationRead(
      {
        db: {
          patch: patchMock,
        },
      } as never,
      {
        userId: "user_1",
        conversationId: "conversation_1",
        now: "2026-04-18T11:00:00.000Z",
      }
    )

    expect(patchMock).toHaveBeenCalledTimes(1)
    expect(patchMock).toHaveBeenCalledWith("notification_doc", {
      readAt: "2026-04-18T11:00:00.000Z",
    })
  })

  it("does not patch chat read state when the unread boundary is unchanged", async () => {
    const patchMock = vi.fn()
    const { markChatConversationUnread } = await import(
      "@/convex/app/chat_read_states"
    )

    getChatReadStateDocMock.mockResolvedValueOnce({
      _id: "chat_read_state_doc",
      id: "chat_read_state_user_1_conversation_1",
      userId: "user_1",
      conversationId: "conversation_1",
      readAt: "2026-04-18T10:30:00.000Z",
      unreadAt: "2026-04-18T10:45:00.000Z",
      messageReadAtById: {},
      createdAt: "2026-04-18T10:30:00.000Z",
      updatedAt: "2026-04-18T10:45:00.000Z",
    })

    await markChatConversationUnread(
      {
        db: {
          patch: patchMock,
        },
      } as never,
      {
        userId: "user_1",
        conversationId: "conversation_1",
        now: "2026-04-18T11:00:00.000Z",
      }
    )

    expect(patchMock).not.toHaveBeenCalled()
  })

  it("filters chat read receipt ids to readable messages in the conversation", async () => {
    const inserts: InsertCapture = []
    const { updateChatReadStateHandler } = await import(
      "@/convex/app/chat_read_states"
    )

    getConversationDocMock.mockResolvedValueOnce(createWorkspaceDirectConversation())
    listChatMessagesByConversationMock.mockResolvedValueOnce([
      {
        id: "message_visible",
        conversationId: "conversation_1",
        createdBy: "user_2",
        createdAt: "2026-04-18T10:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "message_deleted_other",
        conversationId: "conversation_1",
        createdBy: "user_2",
        createdAt: "2026-04-18T10:01:00.000Z",
        deletedAt: "2026-04-18T10:02:00.000Z",
      },
      {
        id: "message_deleted_self",
        conversationId: "conversation_1",
        createdBy: "user_1",
        createdAt: "2026-04-18T10:03:00.000Z",
        deletedAt: "2026-04-18T10:04:00.000Z",
      },
      {
        id: "message_self",
        conversationId: "conversation_1",
        createdBy: "user_1",
        createdAt: "2026-04-18T10:05:00.000Z",
        deletedAt: null,
      },
    ])

    await updateChatReadStateHandler(
      createInsertCaptureCtx(inserts),
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        conversationId: "conversation_1",
        action: "read",
        messageIds: [
          "message_visible",
          "message_deleted_other",
          "message_deleted_self",
          "message_self",
          "message_unknown",
        ],
      }
    )

    expect(getInsertedChatReadStates(inserts)).toEqual([
      expect.objectContaining({
        messageReadAtById: {
          message_visible: "2026-04-18T11:00:00.000Z",
        },
      }),
    ])
  })

  it("keeps team chat read state conversation-level when message ids are provided", async () => {
    const inserts: InsertCapture = []
    const { updateChatReadStateHandler } = await import(
      "@/convex/app/chat_read_states"
    )

    listChatMessagesByConversationMock.mockResolvedValueOnce([
      {
        id: "message_visible",
        conversationId: "conversation_1",
        createdBy: "user_2",
        createdAt: "2026-04-18T10:00:00.000Z",
        deletedAt: null,
      },
    ])

    await updateChatReadStateHandler(
      createInsertCaptureCtx(inserts),
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        conversationId: "conversation_1",
        action: "read",
        messageIds: ["message_visible"],
      }
    )

    expect(getInsertedChatReadStates(inserts)).toEqual([
      expect.objectContaining({
        messageReadAtById: {},
      }),
    ])
    expect(listChatMessagesByConversationMock).not.toHaveBeenCalled()
  })

  it("creates mention notifications without duplicate generic message notifications", async () => {
    const inserts: InsertCapture = []
    const { sendChatMessageHandler } = await import(
      "@/convex/app/collaboration_handlers"
    )

    await sendChatMessageHandler(
      createInsertCaptureCtx(inserts),
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        conversationId: "conversation_1",
        content:
          '<p><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span> hello</p>',
      }
    )

    const notifications = getInsertedNotifications(inserts)

    expect(notifications).toEqual([
      expect.objectContaining({
        userId: "user_2",
        type: "mention",
      }),
    ])
    expect(
      notifications.filter(
        (notification) => (notification as { type: string }).type === "message"
      )
    ).toEqual([])
    expect(getInsertedChatReadStates(inserts)).toEqual([
      expect.objectContaining({
        userId: "user_1",
        readAt: "2026-04-18T11:00:00.000Z",
        unreadAt: null,
      }),
      expect.objectContaining({
        userId: "user_2",
        readAt: null,
        unreadAt: "2026-04-18T11:00:00.000Z",
      }),
      expect.objectContaining({
        userId: "user_3",
        readAt: null,
        unreadAt: "2026-04-18T11:00:00.000Z",
      }),
    ])
  })

  it("creates channel post notifications for the full channel audience without duplicating mentions", async () => {
    createIdMock
      .mockReset()
      .mockReturnValueOnce("notification_mention")
      .mockReturnValueOnce("notification_audience")
    const inserts: InsertCapture = []
    const patchMock = vi.fn()
    const { createChannelPostHandler } = await import(
      "@/convex/app/collaboration_handlers"
    )

    getConversationDocMock.mockResolvedValue(
      createConversation({
        kind: "channel",
        title: "General",
      })
    )
    requireConversationAccessMock.mockImplementation(
      async (_ctx, conversation) => conversation
    )

    await createChannelPostHandler(
      createInsertCaptureCtx(inserts, patchMock),
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        conversationId: "conversation_1",
        postId: "post_client",
        title: "Launch post",
        content:
          '<p><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span> hello team</p>',
      }
    )

    const notifications = getInsertedNotifications(inserts)

    expect(notifications).toEqual([
      expect.objectContaining({
        id: "notification_mention",
        userId: "user_2",
        entityType: "channelPost",
        entityId: "post_client",
        type: "mention",
        contentPreview: "@sam hello team",
      }),
      expect.objectContaining({
        id: "notification_audience",
        userId: "user_3",
        entityType: "channelPost",
        entityId: "post_client",
        type: "message",
        message: "Alex posted Launch post",
        contentPreview: "@sam hello team",
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
    const inserts: InsertCapture = []
    const patchMock = vi.fn()
    const queryMock = vi.fn(() => ({
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
    }))
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
      createInsertCaptureCtx(inserts, patchMock, queryMock),
      {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://app.example.com",
        postId: "post_1",
        content:
          '<p><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span> hello</p>',
      }
    )

    const notifications = getInsertedNotifications(inserts)

    expect(result).toMatchObject({
      commentId: "comment_1",
    })
    expect(notifications).toEqual([
      expect.objectContaining({
        id: "notification_mention",
        userId: "user_2",
        type: "mention",
        contentPreview: "@sam hello",
        targetCommentId: "comment_1",
      }),
      expect.objectContaining({
        id: "notification_follower",
        userId: "user_3",
        type: "comment",
        contentPreview: "@sam hello",
        targetCommentId: "comment_1",
      }),
    ])
    expect(patchMock).toHaveBeenCalledWith("post_doc_1", {
      updatedAt: "2026-04-18T11:00:00.000Z",
    })
  })
})
