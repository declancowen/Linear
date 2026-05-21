import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("browser logout helpers", () => {
  const originalElectronApp = window.electronApp
  const originalFormSubmit = HTMLFormElement.prototype.submit
  let formSubmitMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    formSubmitMock = vi.fn()
    HTMLFormElement.prototype.submit =
      formSubmitMock as unknown as HTMLFormElement["submit"]
  })

  afterEach(() => {
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: originalElectronApp,
    })
    HTMLFormElement.prototype.submit = originalFormSubmit
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("clears Electron desktop auth before submitting logout forms", async () => {
    const clearDesktopAuthToken = vi.fn().mockResolvedValue(true)

    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: {
        clearDesktopAuthToken,
        isElectron: true,
        platform: "darwin",
      },
    })

    const { submitLogoutForm } = await import("@/lib/browser/logout")

    submitLogoutForm("/login")

    await vi.waitFor(() => {
      expect(formSubmitMock).toHaveBeenCalled()
    })

    const form = document.querySelector("form")

    expect(clearDesktopAuthToken).toHaveBeenCalled()
    expect(form?.method).toBe("post")
    expect(form?.getAttribute("action")).toBe(
      "https://teams.reciperoom.io/auth/logout?returnTo=%2Flogin"
    )
  })

  it("still submits logout when Electron token clearing fails", async () => {
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: {
        clearDesktopAuthToken: vi.fn().mockRejectedValue(new Error("failed")),
        isElectron: true,
        platform: "darwin",
      },
    })

    const { submitLogoutForm } = await import("@/lib/browser/logout")

    submitLogoutForm("/login")

    await vi.waitFor(() => {
      expect(formSubmitMock).toHaveBeenCalled()
    })
  })
})
