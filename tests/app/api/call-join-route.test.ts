import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const getCallJoinContextServerMock = vi.fn()
const finalizeCallJoinServerMock = vi.fn()
const ensureConversationRoomMock = vi.fn()
const createConversationJoinUrlMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  getCallJoinContextServer: getCallJoinContextServerMock,
  finalizeCallJoinServer: finalizeCallJoinServerMock,
}))

vi.mock("@/lib/server/100ms", () => ({
  ensureConversationRoom: ensureConversationRoomMock,
  createConversationJoinUrl: createConversationJoinUrlMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getHmsErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

describe("call-join route", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    getCallJoinContextServerMock.mockReset()
    finalizeCallJoinServerMock.mockReset()
    ensureConversationRoomMock.mockReset()
    createConversationJoinUrlMock.mockReset()
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
      authContext: {
        currentUser: {
          id: "user_1",
          name: "Alex",
        },
      },
    })
  })

  it("uses the narrow join context and canonical finalize state for call joins", async () => {
    const { GET } = await import("@/app/api/calls/join/route")

    getCallJoinContextServerMock.mockResolvedValue({
      callId: "call_1",
      conversationId: "conversation_1",
      roomId: "room_existing",
      roomName: "Launch",
      roomKey: "chat-conversation_1",
      roomDescription: "Persistent video room for chat conversation_1",
      role: "host",
    })
    finalizeCallJoinServerMock.mockResolvedValue({
      callId: "call_1",
      conversationId: "conversation_1",
      roomId: "room_existing",
      roomName: "Launch",
    })
    createConversationJoinUrlMock.mockResolvedValue(
      "https://meet.example.com/join"
    )

    const response = await GET(
      new Request("http://localhost/api/calls/join?callId=call_1")
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://meet.example.com/join"
    )
    expect(getCallJoinContextServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      callId: "call_1",
      conversationId: undefined,
    })
    expect(finalizeCallJoinServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      callId: "call_1",
      conversationId: "conversation_1",
      roomId: "room_existing",
      roomName: "Launch",
    })
    expect(ensureConversationRoomMock).not.toHaveBeenCalled()
    expect(createConversationJoinUrlMock).toHaveBeenCalledWith({
      roomKey: "chat-conversation_1",
      roomDescription: "Persistent video room for chat conversation_1",
      roomId: "room_existing",
      userId: "user_1",
      userName: "Alex",
      role: "host",
    })
  })

  it("provisions missing conversation rooms but joins using the canonical finalized room", async () => {
    const { GET } = await import("@/app/api/calls/join/route")

    getCallJoinContextServerMock.mockResolvedValue({
      callId: null,
      conversationId: "conversation_1",
      roomId: null,
      roomName: null,
      roomKey: "chat-conversation_1",
      roomDescription: "Persistent video room for workspace chat conversation_1",
      role: "guest",
    })
    ensureConversationRoomMock.mockResolvedValue({
      id: "room_provisioned",
      name: "Provisioned",
    })
    finalizeCallJoinServerMock.mockResolvedValue({
      callId: null,
      conversationId: "conversation_1",
      roomId: "room_canonical",
      roomName: "Canonical",
    })
    createConversationJoinUrlMock.mockResolvedValue(
      "https://meet.example.com/canonical"
    )

    const response = await GET(
      new Request("http://localhost/api/calls/join?conversationId=conversation_1")
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://meet.example.com/canonical"
    )
    expect(ensureConversationRoomMock).toHaveBeenCalledWith({
      roomKey: "chat-conversation_1",
      roomDescription: "Persistent video room for workspace chat conversation_1",
    })
    expect(finalizeCallJoinServerMock).toHaveBeenCalledWith({
      currentUserId: "user_1",
      callId: undefined,
      conversationId: "conversation_1",
      roomId: "room_provisioned",
      roomName: "Provisioned",
    })
    expect(createConversationJoinUrlMock).toHaveBeenCalledWith({
      roomKey: "chat-conversation_1",
      roomDescription: "Persistent video room for workspace chat conversation_1",
      roomId: "room_canonical",
      userId: "user_1",
      userName: "Alex",
      role: "guest",
    })
  })

  it("renders typed application failures as an error page without provider logging noise", async () => {
    const { GET } = await import("@/app/api/calls/join/route")

    getCallJoinContextServerMock.mockRejectedValue(
      new ApplicationError("You do not have access to this chat", 403, {
        code: "CHAT_ACCESS_DENIED",
      })
    )

    const response = await GET(
      new Request("http://localhost/api/calls/join?callId=call_1")
    )

    expect(response.status).toBe(403)
    await expect(response.text()).resolves.toContain(
      "You do not have access to this chat"
    )
    expect(logProviderErrorMock).not.toHaveBeenCalled()
  })
})
