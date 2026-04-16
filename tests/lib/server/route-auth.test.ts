import { beforeEach, describe, expect, it, vi } from "vitest"

const withAuthMock = vi.fn()
const ensureAuthenticatedAppContextMock = vi.fn()
const ensureConvexUserReadyServerMock = vi.fn()
const toAuthenticatedAppUserMock = vi.fn()

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: withAuthMock,
}))

vi.mock("@/lib/server/authenticated-app", () => ({
  ensureAuthenticatedAppContext: ensureAuthenticatedAppContextMock,
}))

vi.mock("@/lib/server/convex", () => ({
  ensureConvexUserReadyServer: ensureConvexUserReadyServerMock,
}))

vi.mock("@/lib/workos/auth", () => ({
  toAuthenticatedAppUser: toAuthenticatedAppUserMock,
}))

describe("route auth helpers", () => {
  beforeEach(() => {
    withAuthMock.mockReset()
    ensureAuthenticatedAppContextMock.mockReset()
    ensureConvexUserReadyServerMock.mockReset()
    toAuthenticatedAppUserMock.mockReset()
  })

  it("returns a 401 response when no session user exists", async () => {
    const { requireSession } = await import("@/lib/server/route-auth")

    withAuthMock.mockResolvedValue({
      user: null,
      organizationId: null,
    })

    const result = await requireSession()

    expect(result).toBeInstanceOf(Response)
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    })
  })

  it("returns the authenticated session when a user exists", async () => {
    const { requireSession } = await import("@/lib/server/route-auth")

    withAuthMock.mockResolvedValue({
      user: {
        id: "user_123",
        email: "person@example.com",
      },
      organizationId: "org_123",
    })

    const result = await requireSession()

    expect(result).toEqual({
      user: {
        id: "user_123",
        email: "person@example.com",
      },
      organizationId: "org_123",
    })
  })

  it("loads the app context from the authenticated session", async () => {
    const { requireAppContext } = await import("@/lib/server/route-auth")

    const session = {
      user: {
        id: "user_123",
        email: "person@example.com",
      },
      organizationId: "org_123",
    }

    ensureAuthenticatedAppContextMock.mockResolvedValue({
      ensuredUser: {
        userId: "user_123",
      },
    })

    await expect(requireAppContext(session as never)).resolves.toEqual({
      ensuredUser: {
        userId: "user_123",
      },
    })
    expect(ensureAuthenticatedAppContextMock).toHaveBeenCalledWith(
      session.user,
      "org_123"
    )
  })

  it("returns a 404 response when the convex user context is missing", async () => {
    const { requireConvexUser } = await import("@/lib/server/route-auth")

    const session = {
      user: {
        id: "user_123",
        email: "person@example.com",
      },
      organizationId: "org_123",
    }

    toAuthenticatedAppUserMock.mockReturnValue({
      workosUserId: "workos_123",
      email: "person@example.com",
      name: "Person",
      avatarUrl: "P",
      organizationId: "org_123",
    })
    ensureConvexUserReadyServerMock.mockResolvedValue({
      currentUser: null,
    })

    const result = await requireConvexUser(session as never)

    expect(result).toBeInstanceOf(Response)
    await expect((result as Response).json()).resolves.toEqual({
      error: "User context not found",
    })
  })
})
