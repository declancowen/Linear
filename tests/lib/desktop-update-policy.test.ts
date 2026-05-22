import { describe, expect, it } from "vitest"

import {
  compareDesktopVersions,
  isDesktopVersionUnsupported,
} from "@/lib/desktop/update-policy"

describe("desktop update policy", () => {
  it("compares desktop app versions numerically", () => {
    expect(compareDesktopVersions("1.10.0", "1.2.0")).toBe(1)
    expect(compareDesktopVersions("v2.0.0", "2.0")).toBe(0)
    expect(compareDesktopVersions("1.0.9", "1.1.0")).toBe(-1)
  })

  it("marks desktop builds unsupported below the server minimum", () => {
    expect(
      isDesktopVersionUnsupported({
        currentVersion: "1.0.0",
        minSupportedVersion: "1.1.0",
      })
    ).toBe(true)
    expect(
      isDesktopVersionUnsupported({
        currentVersion: "1.1.0",
        minSupportedVersion: "1.1.0",
      })
    ).toBe(false)
    expect(
      isDesktopVersionUnsupported({
        currentVersion: "1.2.0",
        minSupportedVersion: null,
      })
    ).toBe(false)
  })
})
