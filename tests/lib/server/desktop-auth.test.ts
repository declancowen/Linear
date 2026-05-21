import { afterEach, beforeEach, describe, expect, it } from "vitest"

describe("desktop auth helpers", () => {
  const originalAppUrl = process.env.APP_URL
  const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalTeamsUrl = process.env.TEAMS_URL
  const originalRedirectUri = process.env.DESKTOP_WORKOS_REDIRECT_URI
  const originalDeepLinkScheme = process.env.DESKTOP_DEEP_LINK_SCHEME

  beforeEach(() => {
    process.env.APP_URL = "https://teams.example.com"
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.TEAMS_URL
    delete process.env.DESKTOP_WORKOS_REDIRECT_URI
    process.env.DESKTOP_DEEP_LINK_SCHEME = "recipe-room"
  })

  afterEach(() => {
    process.env.APP_URL = originalAppUrl
    process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl
    process.env.TEAMS_URL = originalTeamsUrl
    process.env.DESKTOP_WORKOS_REDIRECT_URI = originalRedirectUri
    process.env.DESKTOP_DEEP_LINK_SCHEME = originalDeepLinkScheme
  })

  it("builds the hosted WorkOS callback URL for desktop auth", async () => {
    const { getDesktopWorkOSRedirectUri } = await import(
      "@/lib/server/desktop-auth"
    )

    expect(getDesktopWorkOSRedirectUri()).toBe(
      "https://teams.example.com/auth/desktop/callback"
    )
  })

  it("builds desktop completion deep links to concrete renderer paths", async () => {
    const { buildDesktopAuthCompleteUrl } = await import(
      "@/lib/server/desktop-auth"
    )

    expect(
      buildDesktopAuthCompleteUrl({
        nextPath: "/workspace/projects",
        ticket: "ticket_123",
      })
    ).toBe(
      "recipe-room://open?path=%2Fauth%2Fdesktop%2Fcomplete%3Fticket%3Dticket_123%26next%3D%252Fworkspace%252Fprojects"
    )
    expect(
      buildDesktopAuthCompleteUrl({
        error: "Denied",
        nextPath: "/workspace/projects",
      })
    ).toBe(
      "recipe-room://open?path=%2Flogin%3Fnext%3D%252Fworkspace%252Fprojects%26error%3DDenied"
    )
  })
})
