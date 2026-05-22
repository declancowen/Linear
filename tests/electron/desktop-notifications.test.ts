import { createRequire } from "node:module"

import { describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const {
  createDesktopNotificationBridge,
  normalizeDesktopNotificationPayload,
  normalizeNotificationPath,
} = require("../../electron/desktop-notifications.cjs") as typeof import("../../electron/desktop-notifications.cjs")

class MockNotification {
  static instances: MockNotification[] = []
  static supported = true

  readonly listeners = new Map<string, () => void>()
  readonly show = vi.fn()

  constructor(readonly options: { body?: string; title: string }) {
    MockNotification.instances.push(this)
  }

  static isSupported() {
    return MockNotification.supported
  }

  on(event: string, listener: () => void) {
    this.listeners.set(event, listener)
  }

  click() {
    this.listeners.get("click")?.()
  }
}

describe("desktop notifications", () => {
  it("normalizes notification payloads and route paths", () => {
    expect(normalizeNotificationPath("/workspace/docs")).toBe("/workspace/docs")
    expect(normalizeNotificationPath("https://example.com")).toBeNull()
    expect(normalizeNotificationPath("//example.com/path")).toBeNull()
    expect(
      normalizeDesktopNotificationPayload({
        body: " Body ",
        path: "/workspace/docs",
        title: " Title ",
      })
    ).toEqual({
      body: "Body",
      path: "/workspace/docs",
      title: "Title",
    })
    expect(normalizeDesktopNotificationPayload({ title: "" })).toBeNull()
  })

  it("shows supported native notifications and opens app paths on click", async () => {
    MockNotification.instances = []
    MockNotification.supported = true
    const loadURL = vi.fn().mockResolvedValue(undefined)
    const focusWindow = vi.fn()
    const window = {
      isDestroyed: vi.fn(() => false),
      loadURL,
    }
    const bridge = createDesktopNotificationBridge({
      createWindow: vi.fn(),
      focusWindow,
      getMainWindow: vi.fn(() => window),
      NativeNotification: MockNotification,
      resolveRendererTargetUrl: (path: string) =>
        new URL(path, "https://teams.example.com").toString(),
    })

    expect(
      bridge.show({
        body: "New mention",
        path: "/workspace/docs",
        title: "New notification",
      })
    ).toBe(true)

    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].options).toEqual({
      body: "New mention",
      title: "New notification",
    })
    expect(MockNotification.instances[0].show).toHaveBeenCalled()

    MockNotification.instances[0].click()
    await vi.waitFor(() => {
      expect(loadURL).toHaveBeenCalledWith(
        "https://teams.example.com/workspace/docs"
      )
    })
    expect(focusWindow).toHaveBeenCalledWith(window)
  })

  it("opens packaged file renderer paths through the resolved renderer target", async () => {
    MockNotification.instances = []
    MockNotification.supported = true
    const loadURL = vi.fn().mockResolvedValue(undefined)
    const window = {
      isDestroyed: vi.fn(() => false),
      loadURL,
    }
    const bridge = createDesktopNotificationBridge({
      createWindow: vi.fn(),
      focusWindow: vi.fn(),
      getMainWindow: vi.fn(() => window),
      NativeNotification: MockNotification,
      resolveRendererTargetUrl: (path: string) =>
        `file:///Applications/Recipe%20Room.app/index.html#${path}`,
    })

    expect(
      bridge.show({
        path: "/items/item_1",
        title: "Assigned",
      })
    ).toBe(true)

    MockNotification.instances[0].click()
    await vi.waitFor(() => {
      expect(loadURL).toHaveBeenCalledWith(
        "file:///Applications/Recipe%20Room.app/index.html#/items/item_1"
      )
    })
  })

  it("does not show notifications when the platform reports unsupported", () => {
    MockNotification.instances = []
    MockNotification.supported = false
    const bridge = createDesktopNotificationBridge({
      createWindow: vi.fn(),
      focusWindow: vi.fn(),
      getMainWindow: vi.fn(),
      NativeNotification: MockNotification,
      resolveRendererTargetUrl: (path: string) =>
        new URL(path, "https://teams.example.com").toString(),
    })

    expect(bridge.show({ title: "New notification" })).toBe(false)
    expect(MockNotification.instances).toHaveLength(0)
  })
})
