import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastCustomMock, toastDismissMock, toastSuccessMock } = vi.hoisted(
  () => ({
    toastCustomMock: vi.fn(),
    toastDismissMock: vi.fn(),
    toastSuccessMock: vi.fn(),
  })
)

vi.mock("sonner", () => ({
  toast: {
    custom: toastCustomMock,
    dismiss: toastDismissMock,
    success: toastSuccessMock,
  },
}))

import { DesktopUpdateController } from "@/components/app/desktop-update-controller"

function setElectronApp(
  overrides: Partial<NonNullable<Window["electronApp"]>>
) {
  Object.defineProperty(window, "electronApp", {
    configurable: true,
    value: {
      isElectron: true,
      onUpdateState: vi.fn(() => vi.fn()),
      platform: "darwin",
      ...overrides,
    },
  })
}

describe("DesktopUpdateController", () => {
  const originalElectronApp = window.electronApp
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    toastCustomMock.mockReset()
    toastDismissMock.mockReset()
    toastSuccessMock.mockReset()
    document.body.innerHTML = ""

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          latestDownloadUrl:
            "https://github.com/declancowen/Linear/releases/latest/download/Recipe-Room-mac-arm64.dmg",
          minSupportedVersion: "2.0.0",
          unsupportedMessage: "This desktop build is no longer supported.",
        }),
        ok: true,
      }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: originalElectronApp,
    })
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
    })
  })

  it("still enforces the unsupported-version policy when update-state IPC fails", async () => {
    setElectronApp({
      getDesktopAppInfo: vi.fn().mockResolvedValue({
        apiBaseUrl: "https://teams.reciperoom.io",
        isPackaged: true,
        platform: "darwin",
        version: "1.0.0",
      }),
      getUpdateState: vi.fn().mockRejectedValue(new Error("IPC failed")),
    })

    render(<DesktopUpdateController />)

    expect(
      await screen.findByText("Update Recipe Room to continue")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /This desktop build is no longer supported\. You are running version 1\.0\.0 and version 2\.0\.0 or newer is required\./u
      )
    ).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://teams.reciperoom.io/api/desktop/update-policy",
      expect.objectContaining({ cache: "no-store", credentials: "include" })
    )
  })

  it("blocks when a minimum version exists but desktop app info cannot be verified", async () => {
    setElectronApp({
      getDesktopAppInfo: vi.fn().mockRejectedValue(new Error("IPC failed")),
      getUpdateState: vi.fn().mockResolvedValue({
        configured: true,
        status: "idle",
      }),
    })

    render(<DesktopUpdateController />)

    expect(
      await screen.findByText("Update Recipe Room to continue")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Recipe Room could not verify this desktop app version and version 2\.0\.0 or newer is required\./u
      )
    ).toBeInTheDocument()
  })

  it("shows latest-version feedback from a forced native menu check", async () => {
    let updateListener:
      | Parameters<
          NonNullable<NonNullable<Window["electronApp"]>["onUpdateState"]>
        >[0]
      | null = null

    setElectronApp({
      getDesktopAppInfo: vi.fn().mockResolvedValue({
        apiBaseUrl: "https://teams.reciperoom.io",
        isPackaged: true,
        platform: "darwin",
        version: "2.0.0",
      }),
      getUpdateState: vi.fn().mockResolvedValue({
        configured: true,
        status: "idle",
      }),
      onUpdateState: vi.fn((listener) => {
        updateListener = listener
        return vi.fn()
      }),
    })

    render(<DesktopUpdateController />)

    await waitFor(() => expect(updateListener).not.toBeNull())

    act(() => {
      updateListener?.({
        showToast: true,
        source: "menu",
        state: {
          configured: true,
          message: "Recipe Room 2.0.0 is up to date.",
          status: "idle",
        },
      })
    })

    expect(
      await screen.findByText("You're on the latest version")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Recipe Room 2.0.0 is up to date.")
    ).toBeInTheDocument()
  })

  it("shows update-available feedback from a forced native menu check", async () => {
    let updateListener:
      | Parameters<
          NonNullable<NonNullable<Window["electronApp"]>["onUpdateState"]>
        >[0]
      | null = null
    const downloadUpdate = vi.fn().mockResolvedValue({
      accepted: true,
      completed: false,
    })

    setElectronApp({
      downloadUpdate,
      getDesktopAppInfo: vi.fn().mockResolvedValue({
        apiBaseUrl: "https://teams.reciperoom.io",
        isPackaged: true,
        platform: "darwin",
        version: "2.0.0",
      }),
      getUpdateState: vi.fn().mockResolvedValue({
        configured: true,
        status: "idle",
      }),
      onUpdateState: vi.fn((listener) => {
        updateListener = listener
        return vi.fn()
      }),
    })

    render(<DesktopUpdateController />)

    await waitFor(() => expect(updateListener).not.toBeNull())

    act(() => {
      updateListener?.({
        showToast: true,
        source: "menu",
        state: {
          availableVersion: "0.0.8",
          configured: true,
          status: "available",
        },
      })
    })

    expect(
      await screen.findByText("A new update is available")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Download Update" }))

    expect(downloadUpdate).toHaveBeenCalled()
  })
})
