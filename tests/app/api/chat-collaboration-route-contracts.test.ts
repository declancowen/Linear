import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"
import { verifySignedCollaborationToken } from "@/lib/server/collaboration-token"
import {
  createProviderErrorsMockModule,
  createRouteHandlerInput,
  createRouteAuthMockModule,
  expectTypedJsonError,
  mockCollaborationRouteAuthContext,
} from "@/tests/lib/fixtures/api-routes"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const getCallJoinContextServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () =>
  createRouteAuthMockModule(requireSessionMock, requireAppContextMock)
)

vi.mock("@/lib/server/convex", () => ({
  getCallJoinContextServer: getCallJoinContextServerMock,
}))

vi.mock("@/lib/server/provider-errors", () =>
  createProviderErrorsMockModule(logProviderErrorMock)
)

function chatSessionRouteInput(url = "http://localhost", init?: RequestInit) {
  return createRouteHandlerInput(
    url,
    {
      chatId: "conversation_1",
    },
    init
  )
}

describe("chat collaboration session route contracts", () => {
  beforeEach(() => {
    mockCollaborationRouteAuthContext({
      extraMocks: [getCallJoinContextServerMock],
      requireAppContextMock,
      requireSessionMock,
      logProviderErrorMock,
    })
  })

  it("returns the chat presence session contract for an accessible chat", async () => {
    const { POST } = await import(
      "@/app/api/collaboration/chats/[chatId]/session/route"
    )

    getCallJoinContextServerMock.mockResolvedValue({
      callId: null,
      conversationId: "conversation_1",
      roomId: null,
      roomName: null,
      roomKey: "chat-conversation_1",
      roomDescription: "Chat room",
      role: "host",
    })

    const response = await POST(...chatSessionRouteInput())

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload).toMatchObject({
      roomId: "chat:conversation_1",
      conversationId: "conversation_1",
      serviceUrl: "https://partykit.example.com",
    })

    const claims = verifySignedCollaborationToken(payload.token)

    expect(claims).toMatchObject({
      kind: "chat",
      sub: "user_1",
      roomId: "chat:conversation_1",
      conversationId: "conversation_1",
    })
  })

  it("maps chat presence access failures to typed responses", async () => {
    const { POST } = await import(
      "@/app/api/collaboration/chats/[chatId]/session/route"
    )

    getCallJoinContextServerMock.mockRejectedValue(
      new ApplicationError("You do not have access to this conversation", 403, {
        code: "CHAT_ACCESS_DENIED",
      })
    )

    const response = await POST(...chatSessionRouteInput())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "You do not have access to this conversation",
      message: "You do not have access to this conversation",
      code: "CHAT_ACCESS_DENIED",
    })
  })

  it("rejects insecure collaboration transport when the app request is HTTPS", async () => {
    const { POST } = await import(
      "@/app/api/collaboration/chats/[chatId]/session/route"
    )

    process.env.NEXT_PUBLIC_PARTYKIT_URL = "http://127.0.0.1:1999"

    getCallJoinContextServerMock.mockResolvedValue({
      callId: null,
      conversationId: "conversation_1",
      roomId: null,
      roomName: null,
      roomKey: "chat-conversation_1",
      roomDescription: "Chat room",
      role: "host",
    })

    const response = await POST(
      ...chatSessionRouteInput(
        "https://localhost/api/collaboration/chats/conversation_1/session",
        {
          method: "POST",
        }
      )
    )

    await expectTypedJsonError(
      response,
      503,
      "Collaboration service must use HTTPS/WSS when the app is served over HTTPS",
      "COLLABORATION_UNAVAILABLE"
    )
  })
})
