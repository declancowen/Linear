import { afterEach, describe, expect, it, vi } from "vitest"

describe("desktop notification browser helper", () => {
  const originalElectronApp = window.electronApp
  const originalVisibilityState = document.visibilityState

  function setDesktopNotificationState(input: {
    hasFocus: boolean
    showNotification: ReturnType<typeof vi.fn>
    visibilityState: DocumentVisibilityState
  }) {
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "darwin",
        showNotification: input.showNotification,
      },
    })
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: input.visibilityState,
    })
    vi.spyOn(document, "hasFocus").mockReturnValue(input.hasFocus)
  }

  afterEach(() => {
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: originalElectronApp,
    })
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: originalVisibilityState,
    })
    vi.restoreAllMocks()
  })

  it("sends native notifications through Electron while the document is hidden", async () => {
    const showNotification = vi.fn().mockResolvedValue(true)

    setDesktopNotificationState({
      hasFocus: false,
      showNotification,
      visibilityState: "hidden",
    })

    const { showDesktopNotification } = await import(
      "@/lib/browser/desktop-notifications"
    )

    await expect(
      showDesktopNotification({
        body: "New mention",
        path: "/workspace/docs",
        title: "New notification",
      })
    ).resolves.toBe(true)
    expect(showNotification).toHaveBeenCalledWith({
      body: "New mention",
      path: "/workspace/docs",
      title: "New notification",
    })
  })

  it("does not duplicate native notifications while the document is focused", async () => {
    const showNotification = vi.fn().mockResolvedValue(true)

    setDesktopNotificationState({
      hasFocus: true,
      showNotification,
      visibilityState: "visible",
    })

    const { showDesktopNotification } = await import(
      "@/lib/browser/desktop-notifications"
    )

    await expect(
      showDesktopNotification({
        title: "New notification",
      })
    ).resolves.toBe(false)
    expect(showNotification).not.toHaveBeenCalled()
  })
})
