import { describe, expect, it } from "vitest"

import {
  getDisplayAvatarFallback,
  getDisplayInitials,
} from "@/lib/display-initials"

describe("display initials", () => {
  it("builds two-letter initials from display names", () => {
    expect(getDisplayInitials("Alex Morgan", "?")).toBe("AM")
    expect(getDisplayInitials("", "?")).toBe("?")
  })

  it("does not use legacy image URLs as avatar fallback text", () => {
    expect(
      getDisplayAvatarFallback(
        "Alex Morgan",
        "https://cdn.example.com/avatar.png",
        "?"
      )
    ).toBe("AM")
    expect(getDisplayAvatarFallback("Alex Morgan", "AM", "?")).toBe("AM")
  })
})
