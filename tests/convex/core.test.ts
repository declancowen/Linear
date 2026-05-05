import { describe, expect, it } from "vitest"

import { createUniqueSlug } from "@/convex/app/core"

describe("Convex core helpers", () => {
  it("returns unique slugs with fallbacks, suffixes, and exhaustion errors", () => {
    expect(createUniqueSlug([], "platform", "team", "failed")).toBe("platform")
    expect(createUniqueSlug(["team"], "", "team", "failed")).toBe("team-2")
    expect(
      createUniqueSlug(
        ["platform", "platform-2"],
        "platform",
        "team",
        "failed"
      )
    ).toBe("platform-3")
    expect(() =>
      createUniqueSlug(
        Array.from({ length: 999 }, (_, index) =>
          index === 0 ? "team" : `team-${index + 1}`
        ),
        "",
        "team",
        "failed"
      )
    ).toThrow("failed")
  })
})
