import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getSupportedDesktopDownloadTarget,
  isSupportedMacDesktopDownloadBrowser,
} from "@/lib/browser/desktop-download-eligibility"

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

  it("resolves Apple Silicon macOS browsers when architecture is reported", async () => {
    const getHighEntropyValues = vi.fn().mockResolvedValue({
      architecture: "arm",
      bitness: "64",
      platform: "macOS",
    })
    setNavigator({
      userAgentData: {
        getHighEntropyValues,
        mobile: false,
        platform: "macOS",
      },
    })

    await expect(getSupportedDesktopDownloadTarget()).resolves.toEqual({
      architecture: "arm64",
      platform: "mac",
    })
    await expect(isSupportedMacDesktopDownloadBrowser()).resolves.toBe(true)
    expect(getHighEntropyValues).toHaveBeenCalledWith([
      "architecture",
      "bitness",
      "platform",
      "wow64",
    ])
  })

  it("resolves Intel macOS browsers to the x64 download", async () => {
    setNavigator({
      userAgentData: {
        getHighEntropyValues: vi.fn().mockResolvedValue({
          architecture: "x86",
          bitness: "64",
          platform: "macOS",
        }),
        mobile: false,
        platform: "macOS",
      },
    })

    await expect(getSupportedDesktopDownloadTarget()).resolves.toEqual({
      architecture: "x64",
      platform: "mac",
    })
  })

  it("falls back to Intel macOS when browser architecture is unavailable", async () => {
    setNavigator()

    await expect(getSupportedDesktopDownloadTarget()).resolves.toEqual({
      architecture: "x64",
      platform: "mac",
    })
  })

  it("keeps the Mac platform fallback when high-entropy hints fail", async () => {
    setNavigator({
      platform: "MacIntel",
      userAgentData: {
        getHighEntropyValues: vi.fn().mockRejectedValue(new Error("blocked")),
        mobile: false,
        platform: "macOS",
      },
    })

    await expect(getSupportedDesktopDownloadTarget()).resolves.toEqual({
      architecture: "x64",
      platform: "mac",
    })
  })

  it("rejects iPad browsers using desktop-class Mac platform values", async () => {
    setNavigator({
      maxTouchPoints: 5,
      userAgentData: {
        getHighEntropyValues: vi.fn().mockResolvedValue({
          architecture: "arm",
          bitness: "64",
          platform: "macOS",
        }),
        mobile: true,
        platform: "macOS",
      },
    })

    await expect(getSupportedDesktopDownloadTarget()).resolves.toBeNull()
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
          bitness: "64",
          platform: "macOS",
        }),
        mobile: false,
        platform: "macOS",
      },
    })

    await expect(getSupportedDesktopDownloadTarget()).resolves.toBeNull()
  })

  it("resolves Windows x64 browsers", async () => {
    setNavigator({
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      userAgentData: {
        getHighEntropyValues: vi.fn().mockResolvedValue({
          architecture: "x86",
          bitness: "64",
          platform: "Windows",
        }),
        mobile: false,
        platform: "Windows",
      },
    })

    await expect(getSupportedDesktopDownloadTarget()).resolves.toEqual({
      architecture: "x64",
      platform: "windows",
    })
  })

  it("resolves 32-bit Windows browsers", async () => {
    setNavigator({
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      userAgentData: {
        getHighEntropyValues: vi.fn().mockResolvedValue({
          architecture: "x86",
          bitness: "32",
          platform: "Windows",
        }),
        mobile: false,
        platform: "Windows",
      },
    })

    await expect(getSupportedDesktopDownloadTarget()).resolves.toEqual({
      architecture: "ia32",
      platform: "windows",
    })
  })

  it("resolves Windows on ARM browsers", async () => {
    setNavigator({
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; ARM64)",
      userAgentData: {
        getHighEntropyValues: vi.fn().mockResolvedValue({
          architecture: "arm",
          bitness: "64",
          platform: "Windows",
        }),
        mobile: false,
        platform: "Windows",
      },
    })

    await expect(getSupportedDesktopDownloadTarget()).resolves.toEqual({
      architecture: "arm64",
      platform: "windows",
    })
  })
})
