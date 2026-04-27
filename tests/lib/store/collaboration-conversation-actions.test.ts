import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "@/lib/domain/empty-state"
import {
  type AppData,
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"

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
  return {
    ...createEmptyState(),
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    workspaces: [
      {
        id: "workspace_1",
        slug: "workspace-1",
        name: "Workspace 1",
        logoUrl: "",
        logoImageUrl: null,
        createdBy: "user_1",
        workosOrganizationId: null,
        settings: {
          accent: "#000000",
          description: "",
        },
      },
    ],
    users: [
      {
        id: "user_1",
        name: "Alex Example",
        handle: "alex",
        email: "alex@example.com",
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
      },
      {
        id: "user_2",
        name: "Sam Example",
        handle: "sam",
        email: "sam@example.com",
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
      },
    ],
    teams: [
      {
        id: "team_1",
        workspaceId: "workspace_1",
        slug: "platform",
        name: "Platform",
        icon: "robot",
        settings: {
          joinCode: "JOIN1234",
          summary: "Platform team",
          guestProjectIds: [],
          guestDocumentIds: [],
          guestWorkItemIds: [],
          experience: "software-development",
          features: createDefaultTeamFeatureSettings("software-development"),
          workflow: createDefaultTeamWorkflowSettings("software-development"),
        },
      },
    ],
    teamMemberships: [
      {
        teamId: "team_1",
        userId: "user_1",
        role: "member",
      },
      {
        teamId: "team_1",
        userId: "user_2",
        role: "member",
      },
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
  }
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

    syncSendChatMessageMock.mockRejectedValueOnce(new Error("send failed"))

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

    syncSendChatMessageMock.mockResolvedValueOnce(null)

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
})
