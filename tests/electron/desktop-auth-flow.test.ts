import { createRequire } from "node:module"

import { describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const {
  createDesktopPasswordLoginBody,
  createDesktopPasswordSignupBody,
  getDesktopPasswordLoginUrl,
  getDesktopPasswordSignupUrl,
  submitDesktopPasswordLogin,
  submitDesktopPasswordSignup,
} =
  require("../../electron/desktop-auth-flow.cjs") as typeof import("../../electron/desktop-auth-flow.cjs")

const DESKTOP_HANDOFF_LOCATION =
  "recipe-room://open?path=%2Fauth%2Fdesktop%2Fcomplete%3Fticket%3Dabc"

function createDesktopAuthFetchMock() {
  return vi.fn().mockResolvedValue({
    headers: new Headers({
      location: DESKTOP_HANDOFF_LOCATION,
    }),
  })
}

async function submitAndExpectDesktopDeepLink(
  submitPasswordAuth: (input: unknown, options?: object) => Promise<unknown>,
  input: unknown
) {
  const handleDesktopDeepLink = vi.fn()
  const fetchImpl = createDesktopAuthFetchMock()
  const result = await submitPasswordAuth(input, {
    fetchImpl,
    handleDesktopDeepLink,
    isDesktopDeepLinkUrl: (url: string) => url.startsWith("recipe-room://"),
  })

  expect(result).toEqual({ ok: true })
  expect(handleDesktopDeepLink).toHaveBeenCalledWith(DESKTOP_HANDOFF_LOCATION)

  return fetchImpl
}

describe("desktop auth flow", () => {
  it("posts password login to the hosted desktop auth route", async () => {
    const fetchImpl = await submitAndExpectDesktopDeepLink(
      submitDesktopPasswordLogin,
      {
        email: " chef@example.com ",
        nextPath: "/workspace/docs",
        password: "password-123",
      }
    )

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
  })

  it("does not depend on local development origins", () => {
    expect(getDesktopPasswordLoginUrl()).toBe(
      "https://teams.reciperoom.io/auth/desktop/login"
    )
    expect(getDesktopPasswordSignupUrl()).toBe(
      "https://teams.reciperoom.io/auth/desktop/signup"
    )
  })

  it("can post password login to a configured hosted API base URL", async () => {
    const fetchImpl = createDesktopAuthFetchMock()

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

  it("posts password signup to the hosted desktop auth route", async () => {
    const fetchImpl = await submitAndExpectDesktopDeepLink(
      submitDesktopPasswordSignup,
      {
        email: " chef@example.com ",
        firstName: " Taylor ",
        lastName: " Morgan ",
        nextPath: "/workspace/docs",
        password: "password-123",
      }
    )

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://teams.reciperoom.io/auth/desktop/signup",
      expect.objectContaining({
        method: "POST",
        redirect: "manual",
      })
    )
    expect(
      (fetchImpl.mock.calls[0][1].body as URLSearchParams).toString()
    ).toBe(
      createDesktopPasswordSignupBody({
        email: "chef@example.com",
        firstName: "Taylor",
        lastName: "Morgan",
        nextPath: "/workspace/docs",
        password: "password-123",
      }).toString()
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
