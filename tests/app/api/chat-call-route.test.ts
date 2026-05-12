import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"
import {
  createProviderErrorsMockModule,
  createRouteHandlerInput,
  mockCollaborationRouteAuthContext,
} from "@/tests/lib/fixtures/api-routes"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const startChatCallServerMock = vi.fn()
const bumpScopedReadModelVersionsServerMock = vi.fn()
const resolveConversationReadModelScopeKeysServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  startChatCallServer: startChatCallServerMock,
  bumpScopedReadModelVersionsServer: bumpScopedReadModelVersionsServerMock,
}))

vi.mock("@/lib/server/scoped-read-models", () => ({
  resolveConversationReadModelScopeKeysServer:
    resolveConversationReadModelScopeKeysServerMock,
}))

vi.mock("@/lib/server/provider-errors", () =>
  createProviderErrorsMockModule(logProviderErrorMock)
)

function chatCallRouteInput() {
  return createRouteHandlerInput(
    "http://localhost/api/chats/conversation_1/calls",
    {
      chatId: "conversation_1",
    }
  )
}

describe("chat-call route", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    startChatCallServerMock.mockReset()
    bumpScopedReadModelVersionsServerMock.mockReset()
    resolveConversationReadModelScopeKeysServerMock.mockReset()
    logProviderErrorMock.mockReset()
    bumpScopedReadModelVersionsServerMock.mockResolvedValue(undefined)
    resolveConversationReadModelScopeKeysServerMock.mockResolvedValue([
      "conversation:conversation_1",
    ])
    mockCollaborationRouteAuthContext({
      requireAppContextMock,
      requireSessionMock,
      logProviderErrorMock,
    })
  })

  it("returns the structured call payload from the narrow call command", async () => {
    const { POST } = await import("@/app/api/chats/[chatId]/calls/route")

    startChatCallServerMock.mockResolvedValue({
      call: {
        id: "call_1",
        conversationId: "conversation_1",
        scopeType: "workspace",
        scopeId: "workspace_1",
        roomId: null,
        roomName: null,
        roomKey: "chat-conversation_1",
        roomDescription: "Persistent video room for chat conversation_1",
        startedBy: "user_1",
        startedAt: "2026-04-16T21:00:00.000Z",
        updatedAt: "2026-04-16T21:00:00.000Z",
        endedAt: null,
        participantUserIds: [],
        lastJoinedAt: null,
        lastJoinedBy: null,
        joinCount: 0,
      },
      message: {
        id: "message_1",
        conversationId: "conversation_1",
        kind: "call",
        content: "Started a call",
        callId: "call_1",
        mentionUserIds: [],
        reactions: [],
        createdBy: "user_1",
        createdAt: "2026-04-16T21:00:00.000Z",
      },
    })

    const response = await POST(...chatCallRouteInput())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      call: expect.objectContaining({
        id: "call_1",
      }),
      message: expect.objectContaining({
        id: "message_1",
        kind: "call",
      }),
      joinHref: "/api/calls/join?callId=call_1",
    })
    expect(startChatCallServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      conversationId: "conversation_1",
      roomKey: "chat-conversation_1",
      roomDescription: "Persistent video room for chat conversation_1",
    })
  })

  it("maps typed application errors onto stable route responses", async () => {
    const { POST } = await import("@/app/api/chats/[chatId]/calls/route")

    startChatCallServerMock.mockRejectedValue(
      new ApplicationError("Your current role is read-only", 403, {
        code: "CHAT_READ_ONLY",
      })
    )

    const response = await POST(...chatCallRouteInput())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "Your current role is read-only",
      message: "Your current role is read-only",
      code: "CHAT_READ_ONLY",
    })
  })
})
