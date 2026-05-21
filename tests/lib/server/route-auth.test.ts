import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const withAuthMock = vi.fn()
const nextHeadersMock = vi.fn()
const ensureAuthenticatedAppContextMock = vi.fn()
const ensureConvexUserReadyServerMock = vi.fn()
const toAuthenticatedAppUserMock = vi.fn()

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: withAuthMock,
}))

vi.mock("next/headers", () => ({
  headers: nextHeadersMock,
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
  const originalDesktopSessionSecret = process.env.DESKTOP_SESSION_SECRET

  beforeEach(() => {
    withAuthMock.mockReset()
    nextHeadersMock.mockReset()
    nextHeadersMock.mockResolvedValue(new Headers())
    ensureAuthenticatedAppContextMock.mockReset()
    ensureConvexUserReadyServerMock.mockReset()
    toAuthenticatedAppUserMock.mockReset()
    process.env.DESKTOP_SESSION_SECRET = "x".repeat(32)
  })

  afterEach(() => {
    process.env.DESKTOP_SESSION_SECRET = originalDesktopSessionSecret
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
      message: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
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

  it("falls back to a desktop bearer session when AuthKit cookies are absent", async () => {
    const {
      createDesktopHandoffTicket,
      createDesktopSessionTokenFromHandoffTicket,
    } = await import("@/lib/server/desktop-session")
    const { requireSession } = await import("@/lib/server/route-auth")
    const { ticket } = createDesktopHandoffTicket({
      organizationId: "org_desktop",
      user: {
        id: "workos_desktop",
        email: "desktop@example.com",
      },
    })
    const session = createDesktopSessionTokenFromHandoffTicket(ticket)

    withAuthMock.mockResolvedValue({
      user: null,
      organizationId: null,
    })
    nextHeadersMock.mockResolvedValue(
      new Headers({
        Authorization: `Bearer ${session?.token}`,
      })
    )

    await expect(requireSession()).resolves.toEqual({
      organizationId: "org_desktop",
      user: {
        email: "desktop@example.com",
        firstName: null,
        id: "workos_desktop",
        lastName: null,
      },
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
      message: "User context not found",
      code: "AUTH_CONVEX_USER_NOT_FOUND",
    })
  })
})
