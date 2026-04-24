import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApplicationError } from "@/lib/server/application-errors"
import { verifySignedCollaborationToken } from "@/lib/server/collaboration-token"

const requireSessionMock = vi.fn()
const requireAppContextMock = vi.fn()
const getCallJoinContextServerMock = vi.fn()
const logProviderErrorMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireAppContext: requireAppContextMock,
  requireConvexUser: vi.fn(),
}))

vi.mock("@/lib/server/convex", () => ({
  getCallJoinContextServer: getCallJoinContextServerMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  getConvexErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  logProviderError: logProviderErrorMock,
}))

describe("chat collaboration session route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireAppContextMock.mockReset()
    getCallJoinContextServerMock.mockReset()
    logProviderErrorMock.mockReset()

    process.env.COLLABORATION_TOKEN_SECRET = "test-collaboration-token-secret"
    process.env.NEXT_PUBLIC_PARTYKIT_URL = "https://partykit.example.com"

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

    const response = await POST(new Request("http://localhost") as never, {
      params: Promise.resolve({
        chatId: "conversation_1",
      }),
    })

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

    const response = await POST(new Request("http://localhost") as never, {
      params: Promise.resolve({
        chatId: "conversation_1",
      }),
    })

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
      new Request("https://localhost/api/collaboration/chats/conversation_1/session", {
        method: "POST",
      }) as never,
      {
        params: Promise.resolve({
          chatId: "conversation_1",
        }),
      }
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error:
        "Collaboration service must use HTTPS/WSS when the app is served over HTTPS",
      message:
        "Collaboration service must use HTTPS/WSS when the app is served over HTTPS",
      code: "COLLABORATION_UNAVAILABLE",
    })
  })
})
