import { vi } from "vitest"

export function setMockDesktopAuthBridge(token = "desktop_token") {
  Object.defineProperty(window, "electronApp", {
    configurable: true,
    value: {
      getDesktopAuthToken: vi.fn().mockResolvedValue(token),
      isElectron: true,
      platform: "darwin",
    },
  })
}
