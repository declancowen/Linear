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
const syncEnsureTeamChatMock = vi.fn()
const syncSendChatMessageMock = vi.fn()
const syncStartConversationCallMock = vi.fn()
const syncToggleChatMessageReactionMock = vi.fn()
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
  syncEnsureTeamChat: syncEnsureTeamChatMock,
  syncSendChatMessage: syncSendChatMessageMock,
  syncStartConversationCall: syncStartConversationCallMock,
  syncToggleChatMessageReaction: syncToggleChatMessageReactionMock,
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
  const { createCollaborationConversationActions } = await import(
    "@/lib/store/app-store-internal/slices/collaboration-conversation-actions"
  )
  const state = createConversationTestState()
  const backgroundTasks: Array<Promise<unknown> | null> = []
  const setState = vi.fn((update: unknown) => {
    const patch =
      typeof update === "function"
        ? update(state as never)
        : update

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

describe("collaboration conversation actions", () => {
  beforeEach(() => {
    vi.resetModules()
    syncCreateChannelMock.mockReset()
    syncCreateWorkspaceChatMock.mockReset()
    syncEnsureTeamChatMock.mockReset()
    syncSendChatMessageMock.mockReset()
    syncStartConversationCallMock.mockReset()
    syncToggleChatMessageReactionMock.mockReset()
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
    expect(syncSendChatMessageMock).toHaveBeenCalledWith(
      "conversation_1",
      "<p>Hello</p>",
      state.chatMessages[0]?.id
    )
    await expect(backgroundTasks[0]).resolves.toBeNull()
  })

  it("adds optimistic generic message notifications for other participants", async () => {
    syncSendChatMessageMock.mockResolvedValueOnce(null)

    const { backgroundTasks, slice, state } =
      await createConversationActionsHarness()

    slice.sendChatMessage({
      conversationId: "conversation_1",
      content: "<p>Hello</p>",
    })

    expect(state.notifications).toEqual([
      expect.objectContaining({
        userId: "user_2",
        actorId: "user_1",
        entityType: "chat",
        entityId: "conversation_1",
        type: "message",
      }),
    ])
    expect(state.notifications.map((notification) => notification.userId)).not.toContain(
      "user_1"
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
    expect(state.conversations.find((entry) => entry.id === workspaceChatId))
      .toMatchObject({
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
    expect(state.conversations.find((entry) => entry.id === channelId))
      .toMatchObject({
        kind: "channel",
        participantIds: ["user_1", "user_2"],
        scopeType: "team",
        title: "Platform",
      })
    expect(toastSuccessMock).not.toHaveBeenCalledWith("Channel ready")
    await expect(backgroundTasks[0]).resolves.toBeNull()
    await expect(backgroundTasks[1]).resolves.toBeNull()
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
