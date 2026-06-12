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

type DesktopUpdateStateListener = Parameters<
  NonNullable<NonNullable<Window["electronApp"]>["onUpdateState"]>
>[0]
type DesktopUpdateStatePayload = Parameters<DesktopUpdateStateListener>[0]

async function renderDesktopUpdateControllerWithMenuListener(
  overrides: Partial<NonNullable<Window["electronApp"]>> = {}
) {
  let updateListener: DesktopUpdateStateListener | null = null

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
    ...overrides,
    onUpdateState: vi.fn((listener) => {
      updateListener = listener
      return vi.fn()
    }),
  })

  render(<DesktopUpdateController />)

  await waitFor(() => expect(updateListener).not.toBeNull())

  return {
    emitMenuUpdateState(state: DesktopUpdateStatePayload["state"]) {
      act(() => {
        updateListener?.({
          showToast: true,
          source: "menu",
          state,
        })
      })
    },
  }
}

function expectStandardUpdateDialogShell() {
  expect(screen.getByRole("dialog")).toHaveClass(
    "w-[min(28rem,calc(100%-2rem))]"
  )
  expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1)
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

  it("uses the platform-specific fallback download for unsupported Windows builds", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({
        latestDownloadUrls: {
          windows: {
            arm64: "https://downloads.example/Recipe-Room-win-arm64.exe",
          },
        },
        minSupportedVersion: "2.0.0",
        unsupportedMessage: "This desktop build is no longer supported.",
      }),
      ok: true,
    } as unknown as Response)
    setElectronApp({
      getDesktopAppInfo: vi.fn().mockResolvedValue({
        apiBaseUrl: "https://teams.reciperoom.io",
        arch: "arm64",
        isPackaged: true,
        platform: "win32",
        version: "1.0.0",
      }),
      getUpdateState: vi.fn().mockRejectedValue(new Error("IPC failed")),
    })

    render(<DesktopUpdateController />)

    const link = await screen.findByRole("link", { name: "Download latest" })

    expect(link).toHaveAttribute(
      "href",
      "https://downloads.example/Recipe-Room-win-arm64.exe"
    )
  })

  it("shows latest-version feedback from a forced native menu check", async () => {
    const { emitMenuUpdateState } =
      await renderDesktopUpdateControllerWithMenuListener()

    emitMenuUpdateState({
      configured: true,
      message: "Recipe Room 2.0.0 is up to date.",
      status: "idle",
    })

    expect(
      await screen.findByText("You're on the latest version")
    ).toBeInTheDocument()
    expectStandardUpdateDialogShell()
    expect(
      screen.getByText("Recipe Room 2.0.0 is up to date.")
    ).toBeInTheDocument()
  })

  it("uses the standard toast width for background update prompts", async () => {
    setElectronApp({
      getDesktopAppInfo: vi.fn().mockResolvedValue({
        apiBaseUrl: "https://teams.reciperoom.io",
        isPackaged: true,
        platform: "darwin",
        version: "2.0.0",
      }),
      getUpdateState: vi.fn().mockResolvedValue({
        configured: true,
        downloadedVersion: "2.0.1",
        status: "downloaded",
      }),
    })

    render(<DesktopUpdateController />)

    await waitFor(() => expect(toastCustomMock).toHaveBeenCalled())

    const [renderToast] = toastCustomMock.mock.calls[0] ?? []

    render(renderToast())

    expect(
      screen
        .getByText("Desktop update ready")
        .closest('[data-slot="toast-card"]')
    ).toHaveClass("w-[var(--width)]")
  })

  it("shows update-available feedback from a forced native menu check", async () => {
    const downloadUpdate = vi.fn().mockResolvedValue({
      accepted: true,
      completed: false,
    })
    const { emitMenuUpdateState } =
      await renderDesktopUpdateControllerWithMenuListener({
        downloadUpdate,
      })

    emitMenuUpdateState({
      availableVersion: "0.0.8",
      configured: true,
      status: "available",
    })

    expect(
      await screen.findByText("A new update is available")
    ).toBeInTheDocument()
    expectStandardUpdateDialogShell()
    fireEvent.click(screen.getByRole("button", { name: "Download Update" }))

    expect(downloadUpdate).toHaveBeenCalled()
  })
})
