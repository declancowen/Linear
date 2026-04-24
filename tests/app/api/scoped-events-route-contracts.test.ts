import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApplicationError } from "@/lib/server/application-errors"

const requireSessionMock = vi.fn()
const requireConvexUserMock = vi.fn()
const getScopedReadModelVersionsServerMock = vi.fn()
const authorizeScopedReadModelScopeKeysServerMock = vi.fn()

vi.mock("@/lib/server/route-auth", () => ({
  requireSession: requireSessionMock,
  requireConvexUser: requireConvexUserMock,
}))

vi.mock("@/lib/server/convex", () => ({
  getScopedReadModelVersionsServer: getScopedReadModelVersionsServerMock,
}))

vi.mock("@/lib/server/provider-errors", () => ({
  logProviderError: vi.fn(),
}))

vi.mock("@/lib/server/scoped-read-models", () => ({
  authorizeScopedReadModelScopeKeysServer:
    authorizeScopedReadModelScopeKeysServerMock,
}))

describe("scoped events route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireConvexUserMock.mockReset()
    getScopedReadModelVersionsServerMock.mockReset()
    authorizeScopedReadModelScopeKeysServerMock.mockReset()

    requireSessionMock.mockResolvedValue({
      user: {
        id: "workos_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
    requireConvexUserMock.mockResolvedValue({
      currentUser: {
        id: "user_1",
      },
    })
    getScopedReadModelVersionsServerMock.mockResolvedValue({
      versions: [],
    })
    authorizeScopedReadModelScopeKeysServerMock.mockResolvedValue(undefined)
  })

  it("rejects scoped event requests without any scope keys", async () => {
    const { GET } = await import("@/app/api/events/scoped/route")

    const response = await GET(
      new Request("http://localhost/api/events/scoped")
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "At least one scopeKey is required",
      message: "At least one scopeKey is required",
      code: "ROUTE_INVALID_QUERY",
    })
  })

  it("rejects unauthorized scope keys", async () => {
    authorizeScopedReadModelScopeKeysServerMock.mockRejectedValueOnce(
      new Error("Unauthorized scoped read model key: notification-inbox:user_2")
    )

    const { GET } = await import("@/app/api/events/scoped/route")

    const response = await GET(
      new Request(
        "http://localhost/api/events/scoped?scopeKey=notification-inbox:user_2"
      )
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized scoped read model key: notification-inbox:user_2",
      message: "Unauthorized scoped read model key: notification-inbox:user_2",
      code: "ROUTE_FORBIDDEN_SCOPE_KEY",
    })
  })

  it("authorizes scope keys before opening the stream", async () => {
    const { GET } = await import("@/app/api/events/scoped/route")

    const response = await GET(
      new Request("http://localhost/api/events/scoped?scopeKey=shell-context")
    )

    expect(response.status).toBe(200)
    expect(authorizeScopedReadModelScopeKeysServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          id: "workos_1",
        }),
      }),
      ["shell-context"]
    )
    expect(getScopedReadModelVersionsServerMock).toHaveBeenCalledWith({
      scopeKeys: ["shell-context"],
    })
  })

  it("emits a healthy ready event with the default retry interval", async () => {
    const { GET } = await import("@/app/api/events/scoped/route")
    const requestAbortController = new AbortController()

    const response = await GET(
      new Request("http://localhost/api/events/scoped?scopeKey=shell-context", {
        signal: requestAbortController.signal,
      })
    )

    expect(response.status).toBe(200)
    const reader = response.body?.getReader()
    expect(reader).toBeDefined()

    const firstChunk = await reader!.read()
    const text = new TextDecoder().decode(firstChunk.value)

    expect(text).toContain("retry: 3000")
    expect(text).toContain("event: ready")

    requestAbortController.abort()
    await reader!.cancel()
  })

  it("emits an unavailable event when scoped read model versions are unavailable", async () => {
    getScopedReadModelVersionsServerMock.mockRejectedValueOnce(
      new ApplicationError("Scoped read model versions are unavailable", 503, {
        code: "SCOPED_READ_MODELS_UNAVAILABLE",
      })
    )

    const { GET } = await import("@/app/api/events/scoped/route")

    const response = await GET(
      new Request("http://localhost/api/events/scoped?scopeKey=shell-context")
    )

    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain("retry: 10000")
    expect(body).toContain("event: unavailable")
  })
})
