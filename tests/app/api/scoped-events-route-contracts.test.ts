import { beforeEach, describe, expect, it, vi } from "vitest"

const requireSessionMock = vi.fn()
const requireConvexUserMock = vi.fn()
const getScopedReadModelVersionsServerMock = vi.fn()

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

describe("scoped events route contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    requireConvexUserMock.mockReset()
    getScopedReadModelVersionsServerMock.mockReset()

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
})
