import { createRequire } from "node:module"

import { describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const {
  createDesktopPasswordLoginBody,
  getDesktopPasswordLoginUrl,
  submitDesktopPasswordLogin,
} =
  require("../../electron/desktop-auth-flow.cjs") as typeof import("../../electron/desktop-auth-flow.cjs")

describe("desktop auth flow", () => {
  it("posts password login to the hosted desktop auth route", async () => {
    const handleDesktopDeepLink = vi.fn()
    const fetchImpl = vi.fn().mockResolvedValue({
      headers: new Headers({
        location:
          "recipe-room://open?path=%2Fauth%2Fdesktop%2Fcomplete%3Fticket%3Dabc",
      }),
    })

    const result = await submitDesktopPasswordLogin(
      {
        email: " chef@example.com ",
        nextPath: "/workspace/docs",
        password: "password-123",
      },
      {
        fetchImpl,
        handleDesktopDeepLink,
        isDesktopDeepLinkUrl: (url: string) => url.startsWith("recipe-room://"),
      }
    )

    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://teams.reciperoom.io/auth/desktop/login",
      expect.objectContaining({
        method: "POST",
        redirect: "manual",
      })
    )
    expect(
      (fetchImpl.mock.calls[0][1].body as URLSearchParams).toString()
    ).toBe(
      createDesktopPasswordLoginBody({
        email: "chef@example.com",
        nextPath: "/workspace/docs",
        password: "password-123",
      }).toString()
    )
    expect(handleDesktopDeepLink).toHaveBeenCalledWith(
      "recipe-room://open?path=%2Fauth%2Fdesktop%2Fcomplete%3Fticket%3Dabc"
    )
  })

  it("does not depend on local development origins", () => {
    expect(getDesktopPasswordLoginUrl()).toBe(
      "https://teams.reciperoom.io/auth/desktop/login"
    )
  })

  it("can post password login to a configured hosted API base URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      headers: new Headers({
        location:
          "recipe-room://open?path=%2Fauth%2Fdesktop%2Fcomplete%3Fticket%3Dabc",
      }),
    })

    await submitDesktopPasswordLogin(
      {
        email: "chef@example.com",
        nextPath: "/workspace/docs",
        password: "password-123",
      },
      {
        apiBaseUrl: "https://desktop-api.example.com/",
        fetchImpl,
        isDesktopDeepLinkUrl: (url: string) => url.startsWith("recipe-room://"),
      }
    )

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://desktop-api.example.com/auth/desktop/login",
      expect.objectContaining({
        method: "POST",
      })
    )
  })

  it("reports a missing deployed desktop auth route clearly", async () => {
    const result = await submitDesktopPasswordLogin(
      {
        email: "chef@example.com",
        nextPath: "/workspace/docs",
        password: "password-123",
      },
      {
        fetchImpl: vi.fn().mockResolvedValue({
          headers: new Headers(),
          status: 404,
        }),
      }
    )

    expect(result).toEqual({
      error: "Desktop sign-in is not deployed on the configured hosted API.",
      ok: false,
    })
  })
})
