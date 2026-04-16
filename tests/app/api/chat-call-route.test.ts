import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const startChatCallServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  startChatCallServer: startChatCallServerMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

describe("chat-call route", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    startChatCallServerMock.mockReset()
    logProviderErrorMock.mockReset()
  })

  it("returns the structured call payload from the narrow call command", async () => {
    const { POST } = await import("@/app/api/chats/[chatId]/calls/route")

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
        createdBy: "user_1",
        createdAt: "2026-04-16T21:00:00.000Z",
      },
    })

    const response = await POST(
      new Request("http://localhost/api/chats/conversation_1/calls") as never,
      {
        params: Promise.resolve({
          chatId: "conversation_1",
        }),
      }
    )

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
    startChatCallServerMock.mockRejectedValue(
      new ApplicationError("Your current role is read-only", 403, {
        code: "CHAT_READ_ONLY",
      })
    )

    const response = await POST(
      new Request("http://localhost/api/chats/conversation_1/calls") as never,
      {
        params: Promise.resolve({
          chatId: "conversation_1",
        }),
      }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "Your current role is read-only",
      message: "Your current role is read-only",
      code: "CHAT_READ_ONLY",
    })
  })
})
