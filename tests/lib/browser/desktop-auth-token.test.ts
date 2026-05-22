import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("desktop auth headers", () => {
  const originalElectronApp = window.electronApp

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: originalElectronApp,
    })
    vi.restoreAllMocks()
  })

  it("retries desktop app info after a transient bridge failure", async () => {
    const getDesktopAppInfo = vi
      .fn()
      .mockRejectedValueOnce(new Error("ipc failed"))
      .mockResolvedValueOnce({
        platform: "darwin",
        version: "1.2.3",
      })

    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: {
        getDesktopAppInfo,
        getDesktopAuthToken: vi.fn().mockResolvedValue("desktop_token"),
        isElectron: true,
        platform: "darwin",
      },
    })

    const { buildDesktopAuthHeaders } =
      await import("@/lib/browser/desktop-auth-token")

    const firstHeaders = await buildDesktopAuthHeaders()
    const secondHeaders = await buildDesktopAuthHeaders()

    expect(getDesktopAppInfo).toHaveBeenCalledTimes(2)
    expect(firstHeaders.get("X-Recipe-Room-Desktop-Version")).toBeNull()
    expect(firstHeaders.get("Authorization")).toBe("Bearer desktop_token")
    expect(secondHeaders.get("X-Recipe-Room-Desktop-Version")).toBe("1.2.3")
    expect(secondHeaders.get("X-Recipe-Room-Desktop-Platform")).toBe("darwin")
  })
})
