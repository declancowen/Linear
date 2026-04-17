import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const headersMock = vi.fn()

vi.mock("next/headers", () => ({
  headers: headersMock,
}))

describe("request origin resolution", () => {
  const originalAppUrl = process.env.APP_URL
  const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalTeamsUrl = process.env.TEAMS_URL

  beforeEach(() => {
    headersMock.mockReset()
    delete process.env.APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.TEAMS_URL
  })

  afterEach(() => {
    process.env.APP_URL = originalAppUrl
    process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl
    process.env.TEAMS_URL = originalTeamsUrl
  })

  it("derives the app origin from request headers when env is not configured", async () => {
    const { resolveServerOrigin } = await import("@/lib/server/request-origin")

    headersMock.mockResolvedValue({
      get(name: string) {
        switch (name) {
          case "origin":
            return null
          case "x-forwarded-host":
            return "preview.reciperoom.dev"
          case "x-forwarded-proto":
            return "https"
          default:
            return null
        }
      },
    })

    await expect(resolveServerOrigin()).resolves.toBe("https://preview.reciperoom.dev")
  })
})
