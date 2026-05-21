import { afterEach, beforeEach, describe, expect, it } from "vitest"

describe("desktop session tokens", () => {
  const originalSecret = process.env.DESKTOP_SESSION_SECRET

  beforeEach(() => {
    process.env.DESKTOP_SESSION_SECRET = "x".repeat(32)
  })

  afterEach(() => {
    process.env.DESKTOP_SESSION_SECRET = originalSecret
  })

  it("exchanges a short-lived handoff ticket for a desktop session token", async () => {
    const {
      createDesktopHandoffTicket,
      createDesktopSessionTokenFromHandoffTicket,
      verifyDesktopSessionToken,
    } = await import("@/lib/server/desktop-session")
    const now = 1_700_000_000_000
    const { ticket } = createDesktopHandoffTicket({
      now,
      organizationId: "org_123",
      user: {
        id: "workos_user",
        email: "alex@example.com",
        firstName: "Alex",
        lastName: "Lee",
      },
    })
    const session = createDesktopSessionTokenFromHandoffTicket(ticket, now + 1000)

    expect(session).toEqual({
      expiresAt: now + 1000 + 7 * 24 * 60 * 60 * 1000,
      token: expect.any(String),
    })
    expect(verifyDesktopSessionToken(session?.token ?? "", now + 1000)).toMatchObject(
      {
        email: "alex@example.com",
        firstName: "Alex",
        lastName: "Lee",
        organizationId: "org_123",
        sub: "workos_user",
        typ: "desktop-session",
      }
    )
  })

  it("rejects expired handoff tickets", async () => {
    const {
      createDesktopHandoffTicket,
      createDesktopSessionTokenFromHandoffTicket,
    } = await import("@/lib/server/desktop-session")
    const now = 1_700_000_000_000
    const { ticket } = createDesktopHandoffTicket({
      now,
      user: {
        id: "workos_user",
        email: "alex@example.com",
      },
    })

    expect(
      createDesktopSessionTokenFromHandoffTicket(ticket, now + 2 * 60 * 1000)
    ).toBeNull()
  })

  it("rejects tampered session tokens", async () => {
    const {
      createDesktopHandoffTicket,
      createDesktopSessionTokenFromHandoffTicket,
      verifyDesktopSessionToken,
    } = await import("@/lib/server/desktop-session")
    const { ticket } = createDesktopHandoffTicket({
      user: {
        id: "workos_user",
        email: "alex@example.com",
      },
    })
    const session = createDesktopSessionTokenFromHandoffTicket(ticket)

    expect(
      verifyDesktopSessionToken(`${session?.token ?? ""}tampered`)
    ).toBeNull()
  })

  it("creates an authenticated session from authorization headers", async () => {
    const {
      createDesktopHandoffTicket,
      createDesktopSessionTokenFromHandoffTicket,
      getDesktopSessionFromRequestHeaders,
    } = await import("@/lib/server/desktop-session")
    const { ticket } = createDesktopHandoffTicket({
      organizationId: "org_123",
      user: {
        id: "workos_user",
        email: "alex@example.com",
      },
    })
    const session = createDesktopSessionTokenFromHandoffTicket(ticket)

    await expect(
      getDesktopSessionFromRequestHeaders(
        new Headers({
          Authorization: `Bearer ${session?.token}`,
        })
      )
    ).resolves.toEqual({
      organizationId: "org_123",
      user: {
        email: "alex@example.com",
        firstName: null,
        id: "workos_user",
        lastName: null,
      },
    })
  })
})
