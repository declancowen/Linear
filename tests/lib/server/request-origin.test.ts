import { afterEach, beforeEach, describe, expect, it } from "vitest"

describe("request origin resolution", () => {
  const originalAppUrl = process.env.APP_URL
  const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalTeamsUrl = process.env.TEAMS_URL

  beforeEach(() => {
    delete process.env.APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.TEAMS_URL
  })

  afterEach(() => {
    process.env.APP_URL = originalAppUrl
    process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl
    process.env.TEAMS_URL = originalTeamsUrl
  })

  it("falls back to the configured app origin defaults instead of request headers", async () => {
    const { resolveServerOrigin } = await import("@/lib/server/request-origin")

    await expect(resolveServerOrigin()).resolves.toBe(
      "https://teams.reciperoom.io"
    )
  })
})
