import { describe, expect, it } from "vitest"

import {
  findDesktopDeepLinkUrl,
  normalizeDeepLinkScheme,
  parseDesktopDeepLinkUrl,
  resolveDeepLinkScheme,
} from "@/electron/deep-links.cjs"

describe("electron deep links", () => {
  it("resolves a valid custom scheme with a stable fallback", () => {
    expect(resolveDeepLinkScheme({ NODE_ENV: "test" })).toBe("recipe-room")
    expect(
      resolveDeepLinkScheme({
        DESKTOP_DEEP_LINK_SCHEME: "Recipe-Room",
        NODE_ENV: "test",
      })
    ).toBe("recipe-room")
    expect(normalizeDeepLinkScheme("not a scheme")).toBeNull()
  })

  it("finds desktop deep links in process arguments", () => {
    expect(
      findDesktopDeepLinkUrl([
        "/Applications/Recipe Room.app",
        "recipe-room://open?path=/workspace/projects",
      ])
    ).toBe("recipe-room://open?path=/workspace/projects")
  })

  it("parses open links into renderer paths", () => {
    expect(
      parseDesktopDeepLinkUrl("recipe-room://open?path=/workspace/projects")
    ).toBe("/workspace/projects")
    expect(
      parseDesktopDeepLinkUrl("recipe-room://workspace/projects?tab=active")
    ).toBe("/workspace/projects?tab=active")
    expect(
      parseDesktopDeepLinkUrl("recipe-room://open?next=/workspace/docs")
    ).toBe("/workspace/docs")
  })

  it("rejects invalid or unrelated links", () => {
    expect(parseDesktopDeepLinkUrl("https://teams.reciperoom.io")).toBeNull()
    expect(parseDesktopDeepLinkUrl("recipe-room://open?path=//evil.test")).toBe(
      "/workspace/projects"
    )
  })
})
