import { afterEach, describe, expect, it, vi } from "vitest"

import { isSupportedMacDesktopDownloadBrowser } from "@/lib/browser/desktop-download-eligibility"

const originalElectronApp = window.electronApp
const originalMaxTouchPoints = window.navigator.maxTouchPoints
const originalPlatform = window.navigator.platform
const originalUserAgent = window.navigator.userAgent
const originalUserAgentData = (
  window.navigator as Navigator & {
    userAgentData?: unknown
  }
).userAgentData

function setNavigator({
  maxTouchPoints = 0,
  platform = "MacIntel",
  userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  userAgentData,
}: {
  maxTouchPoints?: number
  platform?: string
  userAgent?: string
  userAgentData?: unknown
} = {}) {
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  })
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  })
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  })
  Object.defineProperty(window.navigator, "userAgentData", {
    configurable: true,
    value: userAgentData,
  })
}

describe("desktop download eligibility", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: originalElectronApp,
    })
    setNavigator({
      maxTouchPoints: originalMaxTouchPoints,
      platform: originalPlatform,
      userAgent: originalUserAgent,
      userAgentData: originalUserAgentData,
    })
  })

  it("allows Apple Silicon macOS browsers when architecture is reported", async () => {
    const getHighEntropyValues = vi.fn().mockResolvedValue({
      architecture: "arm",
      platform: "macOS",
    })
    setNavigator({
      userAgentData: {
        getHighEntropyValues,
        mobile: false,
        platform: "macOS",
      },
    })

    await expect(isSupportedMacDesktopDownloadBrowser()).resolves.toBe(true)
    expect(getHighEntropyValues).toHaveBeenCalledWith([
      "architecture",
      "platform",
    ])
  })

  it("rejects Intel macOS browsers for arm64-only releases", async () => {
    setNavigator({
      userAgentData: {
        getHighEntropyValues: vi.fn().mockResolvedValue({
          architecture: "x86",
          platform: "macOS",
        }),
        mobile: false,
        platform: "macOS",
      },
    })

    await expect(isSupportedMacDesktopDownloadBrowser()).resolves.toBe(false)
  })

  it("rejects macOS browsers when architecture is unavailable", async () => {
    setNavigator()

    await expect(isSupportedMacDesktopDownloadBrowser()).resolves.toBe(false)
  })

  it("rejects iPad browsers using desktop-class Mac platform values", async () => {
    setNavigator({
      maxTouchPoints: 5,
      userAgentData: {
        getHighEntropyValues: vi.fn().mockResolvedValue({
          architecture: "arm",
          platform: "macOS",
        }),
        mobile: true,
        platform: "macOS",
      },
    })

    await expect(isSupportedMacDesktopDownloadBrowser()).resolves.toBe(false)
  })

  it("rejects Electron even on Apple Silicon", async () => {
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "darwin",
      },
    })
    setNavigator({
      userAgentData: {
        getHighEntropyValues: vi.fn().mockResolvedValue({
          architecture: "arm64",
          platform: "macOS",
        }),
        mobile: false,
        platform: "macOS",
      },
    })

    await expect(isSupportedMacDesktopDownloadBrowser()).resolves.toBe(false)
  })
})
