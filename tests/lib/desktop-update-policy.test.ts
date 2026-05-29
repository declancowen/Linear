import { describe, expect, it } from "vitest"

import {
  compareDesktopVersions,
  DEFAULT_DESKTOP_DOWNLOAD_URLS,
  getDesktopDownloadUrl,
  isDesktopVersionUnsupported,
} from "@/lib/desktop/update-policy"

describe("desktop update policy", () => {
  it("compares desktop app versions numerically", () => {
    expect(compareDesktopVersions("1.10.0", "1.2.0")).toBe(1)
    expect(compareDesktopVersions("v2.0.0", "2.0")).toBe(0)
    expect(compareDesktopVersions("1.0.9", "1.1.0")).toBe(-1)
  })

  it("treats prerelease desktop builds as lower than matching stable builds", () => {
    expect(compareDesktopVersions("1.2.0-beta.1", "1.2.0")).toBe(-1)
    expect(compareDesktopVersions("1.2.0", "1.2.0-rc.1")).toBe(1)
    expect(compareDesktopVersions("1.2.0-beta.2", "1.2.0-beta.10")).toBe(-1)
    expect(compareDesktopVersions("1.2.1-beta.1", "1.2.0")).toBe(1)
    expect(compareDesktopVersions("1.2.0+build.5", "1.2.0")).toBe(0)
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
    expect(
      isDesktopVersionUnsupported({
        currentVersion: "1.1.0-beta.1",
        minSupportedVersion: "1.1.0",
      })
    ).toBe(true)
  })

  it("resolves platform-specific desktop download URLs", () => {
    expect(
      getDesktopDownloadUrl(
        {
          mac: { x64: "https://downloads.example/mac-x64.dmg" },
        },
        { architecture: "x64", platform: "mac" }
      )
    ).toBe("https://downloads.example/mac-x64.dmg")
    expect(
      getDesktopDownloadUrl(null, {
        architecture: "arm64",
        platform: "windows",
      })
    ).toBe(DEFAULT_DESKTOP_DOWNLOAD_URLS.windows.arm64)
  })
})
