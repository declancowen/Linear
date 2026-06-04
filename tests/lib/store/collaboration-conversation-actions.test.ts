import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createDefaultTeamFeatureSettings,
  type AppData,
} from "@/lib/domain/types"
import {
  createTestAppData,
  createTestTeam,
  createTestTeamMembership,
  createTestUser,
  createTestWorkspace,
  createTestWorkspaceMembership,
} from "@/tests/lib/fixtures/app-data"

const syncCreateChannelMock = vi.fn()
const syncCreateWorkspaceChatMock = vi.fn()
const syncDeleteChatMessageMock = vi.fn()
const syncEnsureTeamChatMock = vi.fn()
const syncSendChatMessageMock = vi.fn()
const syncStartConversationCallMock = vi.fn()
const syncToggleChatMessageReactionMock = vi.fn()
const syncUpdateChatMessageMock = vi.fn()
const syncUpdateChatReadStateMock = vi.fn()
const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}))

vi.mock("@/lib/convex/client", () => ({
  syncCreateChannel: syncCreateChannelMock,
  syncCreateWorkspaceChat: syncCreateWorkspaceChatMock,
  syncDeleteChatMessage: syncDeleteChatMessageMock,
  syncEnsureTeamChat: syncEnsureTeamChatMock,
  syncSendChatMessage: syncSendChatMessageMock,
  syncStartConversationCall: syncStartConversationCallMock,
  syncToggleChatMessageReaction: syncToggleChatMessageReactionMock,
  syncUpdateChatMessage: syncUpdateChatMessageMock,
  syncUpdateChatReadState: syncUpdateChatReadStateMock,
}))

function createConversationTestState(): AppData {
  return createTestAppData({
    workspaces: [
      createTestWorkspace({
        slug: "workspace-1",
        name: "Workspace 1",
        workosOrganizationId: null,
        settings: {
          accent: "#000000",
          description: "",
        },
      }),
    ],
    users: [
      createTestUser({
        name: "Alex Example",
        title: "",
      }),
      createTestUser({
        id: "user_2",
        name: "Sam Example",
        handle: "sam",
        email: "sam@example.com",
        title: "",
      }),
    ],
    teams: [
      createTestTeam({
        settings: {
          features: {
            ...createDefaultTeamFeatureSettings("software-development"),
            channels: true,
            chat: true,
          },
        },
      }),
    ],
    workspaceMemberships: [
      createTestWorkspaceMembership(),
      createTestWorkspaceMembership({
        userId: "user_2",
        role: "member",
      }),
    ],
    teamMemberships: [
      createTestTeamMembership({
        role: "member",
      }),
      createTestTeamMembership({
        userId: "user_2",
        role: "member",
      }),
    ],
    conversations: [
      {
        id: "conversation_1",
        kind: "chat",
        scopeType: "team",
        scopeId: "team_1",
        variant: "team",
        title: "Platform",
        description: "",
        participantIds: ["user_1", "user_2"],
        roomId: null,
        roomName: null,
        createdBy: "user_1",
        createdAt: "2026-04-21T10:00:00.000Z",
        updatedAt: "2026-04-21T10:00:00.000Z",
        lastActivityAt: "2026-04-21T10:00:00.000Z",
      },
    ],
  })
}

async function createConversationActionsHarness() {
  const { createCollaborationConversationActions } =
    await import("@/lib/store/app-store-internal/slices/collaboration-conversation-actions")
  const state = createConversationTestState()
  const backgroundTasks: Array<Promise<unknown> | null> = []
  const setState = vi.fn((update: unknown) => {
    const patch = typeof update === "function" ? update(state as never) : update

    Object.assign(state, patch)
  })

  const slice = createCollaborationConversationActions({
    set: setState as never,
    get: () => state as never,
    runtime: {
      refreshFromServer: vi.fn().mockResolvedValue(undefined),
      syncInBackground(task: Promise<unknown> | null) {
        backgroundTasks.push(task)
      },
    } as never,
  })

  return { backgroundTasks, setState, slice, state }
}

function setConversationAsWorkspaceDirect(state: AppData) {
  state.conversations = state.conversations.map((conversation) =>
    conversation.id === "conversation_1"
      ? {
          ...conversation,
          scopeType: "workspace",
          scopeId: "workspace_1",
          variant: "direct",
        }
      : conversation
  )
}

describe("collaboration conversation actions", () => {
  beforeEach(() => {
    vi.resetModules()
    syncCreateChannelMock.mockReset()
    syncCreateWorkspaceChatMock.mockReset()
    syncDeleteChatMessageMock.mockReset()
    syncEnsureTeamChatMock.mockReset()
    syncSendChatMessageMock.mockReset()
    syncStartConversationCallMock.mockReset()
    syncToggleChatMessageReactionMock.mockReset()
    syncUpdateChatMessageMock.mockReset()
    syncUpdateChatReadStateMock.mockReset()
    syncUpdateChatReadStateMock.mockResolvedValue(null)
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
  })

  it("reverts the optimistic reaction if the pending message send fails", async () => {
    syncSendChatMessageMock.mockRejectedValueOnce(new Error("send failed"))

    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()

    slice.sendChatMessage({
      conversationId: "conversation_1",
      content: "<p>Hello</p>",
    })

    const optimisticMessageId = state.chatMessages[0]?.id

    expect(optimisticMessageId).toBeTruthy()

    slice.toggleChatMessageReaction(optimisticMessageId ?? "", "🔥")

    expect(state.chatMessages[0]?.reactions).toEqual([
      {
        emoji: "🔥",
        userIds: ["user_1"],
      },
    ])

    await expect(backgroundTasks[0]).rejects.toThrow("send failed")
    await expect(backgroundTasks[1]).resolves.toBeNull()

    expect(syncToggleChatMessageReactionMock).not.toHaveBeenCalled()
    expect(state.chatMessages[0]?.reactions).toEqual([])
  })

  it("trims trailing hard breaks from optimistic chat messages before syncing", async () => {
    syncSendChatMessageMock.mockResolvedValueOnce(null)

    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()

    slice.sendChatMessage({
      conversationId: "conversation_1",
      content: "<p>Hello<br><br></p>",
    })

    expect(state.chatMessages[0]?.content).toBe("<p>Hello</p>")
    expect(
      (
        state as AppData & {
          pendingChatMessageSyncsById: Record<string, string>
        }
      ).pendingChatMessageSyncsById[state.chatMessages[0]?.id ?? ""]
    ).toEqual(expect.any(String))
    expect(syncSendChatMessageMock).toHaveBeenCalledWith(
      "conversation_1",
      "<p>Hello</p>",
      state.chatMessages[0]?.id
    )
    await expect(backgroundTasks[0]).resolves.toBeNull()
    expect(
      (
        state as AppData & {
          pendingChatMessageSyncsById: Record<string, string>
        }
      ).pendingChatMessageSyncsById
    ).toEqual({})
  })

  it("updates owned chat messages optimistically before syncing", async () => {
    syncUpdateChatMessageMock.mockResolvedValueOnce(null)

    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()
    state.chatMessages = [
      {
        id: "message_1",
        conversationId: "conversation_1",
        kind: "text",
        content: "<p>Original</p>",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: "2026-04-21T10:01:00.000Z",
      },
    ]

    slice.updateChatMessage("message_1", {
      content: "<p>Edited<br><br></p>",
    })

    expect(state.chatMessages[0]).toMatchObject({
      content: "<p>Edited</p>",
      editedAt: expect.any(String),
    })
    expect(syncUpdateChatMessageMock).toHaveBeenCalledWith(
      "message_1",
      "<p>Edited</p>"
    )
    await expect(backgroundTasks[0]).resolves.toBeNull()
  })

  it("marks owned chat messages deleted locally before syncing", async () => {
    syncDeleteChatMessageMock.mockResolvedValueOnce(null)

    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()
    state.chatMessages = [
      {
        id: "message_1",
        conversationId: "conversation_1",
        kind: "text",
        content: "<p>Original</p>",
        mentionUserIds: ["user_2"],
        reactions: [
          {
            emoji: "👍",
            userIds: ["user_2"],
          },
        ],
        createdBy: "user_1",
        createdAt: "2026-04-21T10:01:00.000Z",
      },
    ]

    slice.deleteChatMessage("message_1")

    expect(state.chatMessages[0]).toMatchObject({
      content: "",
      mentionUserIds: [],
      reactions: [],
      editedAt: null,
      deletedAt: expect.any(String),
    })
    expect(syncDeleteChatMessageMock).toHaveBeenCalledWith("message_1")
    await expect(backgroundTasks[0]).resolves.toBeNull()
  })

  it("does not optimistically mutate chat messages for read-only roles", async () => {
    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()
    state.teamMemberships = state.teamMemberships.map((membership) =>
      membership.userId === "user_1"
        ? {
            ...membership,
            role: "viewer",
          }
        : membership
    )
    state.chatMessages = [
      {
        id: "message_1",
        conversationId: "conversation_1",
        kind: "text",
        content: "<p>Original</p>",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: "2026-04-21T10:01:00.000Z",
      },
    ]

    slice.updateChatMessage("message_1", {
      content: "<p>Edited</p>",
    })
    slice.deleteChatMessage("message_1")
    slice.toggleChatMessageReaction("message_1", "🔥")

    expect(state.chatMessages[0]?.content).toBe("<p>Original</p>")
    expect(state.chatMessages[0]?.reactions).toEqual([])
    expect(state.chatMessages[0]).not.toHaveProperty("deletedAt")
    expect(state.chatMessages[0]).not.toHaveProperty("editedAt")
    expect(syncUpdateChatMessageMock).not.toHaveBeenCalled()
    expect(syncDeleteChatMessageMock).not.toHaveBeenCalled()
    expect(syncToggleChatMessageReactionMock).not.toHaveBeenCalled()
    expect(backgroundTasks).toEqual([])
    expect(toastErrorMock).toHaveBeenCalledWith("Your current role is read-only")
  })

  it("marks the sent chat read without creating a self message receipt or generic inbox notification", async () => {
    syncSendChatMessageMock.mockResolvedValueOnce(null)

    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()

    slice.sendChatMessage({
      conversationId: "conversation_1",
      content: "<p>Hello</p>",
    })

    expect(state.notifications).toEqual([])
    expect(state.chatReadStates).toEqual([
      expect.objectContaining({
        userId: "user_1",
        conversationId: "conversation_1",
        readAt: expect.any(String),
        unreadAt: null,
        messageReadAtById: {},
      }),
    ])
    expect(
      state.chatReadStates[0]?.messageReadAtById?.[
        state.chatMessages[0]?.id ?? ""
      ]
    ).toBeUndefined()
    await expect(backgroundTasks[0]).resolves.toBeNull()
  })

  it("marks visible chat messages read once without overwriting existing receipt timestamps", async () => {
    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()
    setConversationAsWorkspaceDirect(state)
    state.chatReadStates = [
      {
        id: "chat_read_state_user_1_conversation_1",
        userId: "user_1",
        conversationId: "conversation_1",
        readAt: "2026-04-21T10:02:00.000Z",
        unreadAt: "2026-04-21T10:03:00.000Z",
        messageReadAtById: {
          message_old: "2026-04-21T10:02:00.000Z",
        },
        createdAt: "2026-04-21T10:02:00.000Z",
        updatedAt: "2026-04-21T10:03:00.000Z",
      },
    ]
    state.chatMessages = [
      {
        id: "message_old",
        conversationId: "conversation_1",
        kind: "text",
        content: "<p>Already read</p>",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_2",
        createdAt: "2026-04-21T10:01:00.000Z",
      },
      {
        id: "message_new",
        conversationId: "conversation_1",
        kind: "text",
        content: "<p>Unread</p>",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_2",
        createdAt: "2026-04-21T10:04:00.000Z",
      },
      {
        id: "message_self",
        conversationId: "conversation_1",
        kind: "text",
        content: "<p>Mine</p>",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: "2026-04-21T10:05:00.000Z",
      },
    ]

    slice.markChatRead("conversation_1", [
      "message_old",
      "message_new",
      "message_self",
    ])

    expect(state.chatReadStates[0]).toMatchObject({
      readAt: expect.any(String),
      unreadAt: null,
      messageReadAtById: {
        message_old: "2026-04-21T10:02:00.000Z",
        message_new: expect.any(String),
      },
    })
    expect(
      state.chatReadStates[0]?.messageReadAtById?.message_new
    ).not.toBe("2026-04-21T10:02:00.000Z")
    expect(syncUpdateChatReadStateMock).toHaveBeenCalledWith(
      "conversation_1",
      "read",
      {
        messageIds: ["message_new"],
      }
    )
    expect(
      state.chatReadStates[0]?.messageReadAtById?.message_self
    ).toBeUndefined()
    await expect(backgroundTasks[0]).resolves.toBeNull()
  })

  it("does not sync chat read state when every visible message is already read", async () => {
    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()
    setConversationAsWorkspaceDirect(state)
    state.chatReadStates = [
      {
        id: "chat_read_state_user_1_conversation_1",
        userId: "user_1",
        conversationId: "conversation_1",
        readAt: "2026-04-21T10:02:00.000Z",
        unreadAt: null,
        messageReadAtById: {
          message_old: "2026-04-21T10:02:00.000Z",
        },
        createdAt: "2026-04-21T10:02:00.000Z",
        updatedAt: "2026-04-21T10:02:00.000Z",
      },
    ]
    state.chatMessages = [
      {
        id: "message_old",
        conversationId: "conversation_1",
        kind: "text",
        content: "<p>Already read</p>",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_2",
        createdAt: "2026-04-21T10:01:00.000Z",
      },
    ]

    slice.markChatRead("conversation_1", ["message_old"])

    expect(syncUpdateChatReadStateMock).not.toHaveBeenCalled()
    expect(backgroundTasks).toEqual([])
    expect(state.chatReadStates[0]).toMatchObject({
      readAt: "2026-04-21T10:02:00.000Z",
      updatedAt: "2026-04-21T10:02:00.000Z",
    })
  })

  it("keeps team chat reads conversation-level when message ids are provided", async () => {
    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()
    state.chatReadStates = [
      {
        id: "chat_read_state_user_1_conversation_1",
        userId: "user_1",
        conversationId: "conversation_1",
        readAt: "2026-04-21T10:02:00.000Z",
        unreadAt: "2026-04-21T10:03:00.000Z",
        messageReadAtById: {},
        createdAt: "2026-04-21T10:02:00.000Z",
        updatedAt: "2026-04-21T10:03:00.000Z",
      },
    ]
    state.chatMessages = [
      {
        id: "message_new",
        conversationId: "conversation_1",
        kind: "text",
        content: "<p>Unread</p>",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_2",
        createdAt: "2026-04-21T10:04:00.000Z",
      },
    ]

    slice.markChatRead("conversation_1", ["message_new"])

    expect(state.chatReadStates[0]).toMatchObject({
      readAt: expect.any(String),
      unreadAt: null,
      messageReadAtById: {},
    })
    expect(syncUpdateChatReadStateMock).toHaveBeenCalledWith(
      "conversation_1",
      "read",
      {
        messageIds: undefined,
      }
    )
    await expect(backgroundTasks[0]).resolves.toBeNull()
  })

  it("does not add duplicate optimistic message notifications for mentions", async () => {
    syncSendChatMessageMock.mockResolvedValueOnce(null)

    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()

    slice.sendChatMessage({
      conversationId: "conversation_1",
      content:
        '<p><span class="editor-mention" data-type="mention" data-id="user_2">@sam</span> hello</p>',
    })

    expect(state.notifications).toEqual([
      expect.objectContaining({
        userId: "user_2",
        type: "mention",
      }),
    ])
    expect(
      state.notifications.filter(
        (notification) =>
          notification.userId === "user_2" && notification.type === "message"
      )
    ).toEqual([])
    await expect(backgroundTasks[0]).resolves.toBeNull()
  })

  it("creates workspace chats and team channels through editable collaboration scopes", async () => {
    syncCreateWorkspaceChatMock.mockResolvedValueOnce(null)
    syncCreateChannelMock.mockResolvedValueOnce(null)

    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()

    const workspaceChatId = slice.createWorkspaceChat({
      workspaceId: "workspace_1",
      participantIds: ["user_2"],
      title: "",
      description: "",
    })

    expect(workspaceChatId).toBeTruthy()
    expect(
      state.conversations.find((entry) => entry.id === workspaceChatId)
    ).toMatchObject({
      kind: "chat",
      participantIds: ["user_1", "user_2"],
      scopeType: "workspace",
    })

    const channelId = slice.createChannel({
      teamId: "team_1",
      title: "",
      description: "",
      silent: true,
    })

    expect(channelId).toBeTruthy()
    expect(
      state.conversations.find((entry) => entry.id === channelId)
    ).toMatchObject({
      kind: "channel",
      participantIds: ["user_1", "user_2"],
      scopeType: "team",
      title: "Platform",
    })
    expect(toastSuccessMock).not.toHaveBeenCalledWith("Channel ready")
    await expect(backgroundTasks[0]).resolves.toBe(workspaceChatId)
    await expect(backgroundTasks[1]).resolves.toBeNull()
  })

  it("waits for a canonical team chat id before syncing the first message", async () => {
    let resolveTeamChat!: (result: { conversationId: string }) => void
    syncEnsureTeamChatMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTeamChat = resolve
      })
    )
    syncSendChatMessageMock.mockResolvedValueOnce({
      messageId: "chat_message_server",
    })

    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()
    state.conversations = []

    const optimisticConversationId = slice.ensureTeamChat({
      teamId: "team_1",
      title: "",
      description: "",
    })

    expect(optimisticConversationId).toBeTruthy()

    slice.sendChatMessage({
      conversationId: optimisticConversationId ?? "",
      content: "<p>Hello</p>",
    })

    expect(syncSendChatMessageMock).not.toHaveBeenCalled()

    resolveTeamChat({
      conversationId: "conversation_server",
    })

    await expect(backgroundTasks[0]).resolves.toBe("conversation_server")
    await expect(backgroundTasks[1]).resolves.toEqual({
      messageId: "chat_message_server",
    })

    expect(syncSendChatMessageMock).toHaveBeenCalledWith(
      "conversation_server",
      "<p>Hello</p>",
      state.chatMessages[0]?.id
    )
    expect(
      state.conversations.some(
        (conversation) => conversation.id === optimisticConversationId
      )
    ).toBe(false)
    expect(state.conversations[0]?.id).toBe("conversation_server")
    expect(state.chatMessages[0]?.conversationId).toBe("conversation_server")
    expect(state.chatReadStates[0]?.conversationId).toBe(
      "conversation_server"
    )
    expect(
      state.notifications.every(
        (notification) =>
          notification.entityType !== "chat" ||
          notification.entityId === "conversation_server"
      )
    ).toBe(true)
  })

  it("marks a chat unread without clearing the last read timestamp", async () => {
    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()
    state.chatReadStates = [
      {
        id: "chat_read_state_user_1_conversation_1",
        userId: "user_1",
        conversationId: "conversation_1",
        readAt: "2026-04-21T10:02:00.000Z",
        unreadAt: null,
        createdAt: "2026-04-21T10:02:00.000Z",
        updatedAt: "2026-04-21T10:02:00.000Z",
      },
    ]

    slice.markChatUnread("conversation_1")

    expect(state.chatReadStates[0]).toMatchObject({
      readAt: "2026-04-21T10:02:00.000Z",
      unreadAt: expect.any(String),
    })
    expect(syncUpdateChatReadStateMock).toHaveBeenCalledWith(
      "conversation_1",
      "unread"
    )
    await expect(backgroundTasks[0]).resolves.toBeNull()
  })

  it("does not sync chat unread state when it is already unread", async () => {
    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()
    state.chatReadStates = [
      {
        id: "chat_read_state_user_1_conversation_1",
        userId: "user_1",
        conversationId: "conversation_1",
        readAt: "2026-04-21T10:02:00.000Z",
        unreadAt: "2026-04-21T10:03:00.000Z",
        createdAt: "2026-04-21T10:02:00.000Z",
        updatedAt: "2026-04-21T10:03:00.000Z",
      },
    ]

    slice.markChatUnread("conversation_1")

    expect(syncUpdateChatReadStateMock).not.toHaveBeenCalled()
    expect(backgroundTasks).toEqual([])
    expect(state.chatReadStates[0]).toMatchObject({
      unreadAt: "2026-04-21T10:03:00.000Z",
      updatedAt: "2026-04-21T10:03:00.000Z",
    })
  })

  it("stores structured call activity when a conversation call starts", async () => {
    syncStartConversationCallMock.mockResolvedValueOnce({
      joinHref: "https://calls.example.com/join",
      call: {
        id: "call_1",
        conversationId: "conversation_1",
        scopeType: "team",
        scopeId: "team_1",
        roomId: null,
        roomName: null,
        roomKey: "room_1",
        roomDescription: "Platform call",
        startedBy: "user_1",
        startedAt: "2026-04-21T10:05:00.000Z",
        updatedAt: "2026-04-21T10:05:00.000Z",
        endedAt: null,
        participantUserIds: ["user_1"],
      },
      message: {
        id: "message_1",
        conversationId: "conversation_1",
        kind: "call",
        content: "<p>Call started</p>",
        callId: "call_1",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: "2026-04-21T10:05:00.000Z",
      },
    })

    const { slice, state } = await createConversationActionsHarness()

    await expect(slice.startConversationCall("conversation_1")).resolves.toBe(
      "https://calls.example.com/join"
    )

    expect(state.calls).toEqual([
      expect.objectContaining({
        id: "call_1",
      }),
    ])
    expect(state.chatMessages).toEqual([
      expect.objectContaining({
        id: "message_1",
        callId: "call_1",
      }),
    ])
    expect(state.conversations[0]).toMatchObject({
      lastActivityAt: "2026-04-21T10:05:00.000Z",
      updatedAt: "2026-04-21T10:05:00.000Z",
    })
  })
})
