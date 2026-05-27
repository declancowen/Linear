import { EventEmitter } from "node:events"
import { createRequire } from "node:module"

import { describe, expect, it, vi } from "vitest"

type DesktopUpdateTestManager = {
  configure: () => DesktopUpdateState
  checkForUpdates: (reason?: string) => Promise<{
    checked: boolean
    error?: string
    reason?: string
    state: DesktopUpdateState
  }>
  downloadUpdate: () => Promise<{
    accepted: boolean
    completed: boolean
    error?: string
    state: DesktopUpdateState
  }>
  getState: () => DesktopUpdateState
  installUpdate: () => {
    accepted: boolean
    completed: boolean
    error?: string
    state: DesktopUpdateState
  }
}

type DesktopUpdatesModule = {
  createDesktopUpdateManager: (options: {
    app: { getVersion?: () => string; isPackaged: boolean }
    autoUpdater: ReturnType<typeof createAutoUpdaterMock>
    env?: Record<string, string>
    onStateChange?: (state: DesktopUpdateState) => void
    resourcesPath?: string
    timers?: typeof globalThis
  }) => DesktopUpdateTestManager
  getDesktopAutoUpdateDisabledReason: (options: {
    app?: { isPackaged: boolean }
    env?: Record<string, string>
    resourcesPath?: string
  }) => string | null
  normalizeGitHubRepository: (
    value: string
  ) => { owner: string; repo: string } | null
  resolveGitHubUpdatePublishConfig: (env: Record<string, string>) => {
    owner: string
    provider: string
    releaseType: string
    repo: string
  } | null
  shouldForceDesktopUpdateToastForActionResult: (result: {
    error?: string
  }) => boolean
}

const require = createRequire(import.meta.url)
const {
  createDesktopUpdateManager,
  getDesktopAutoUpdateDisabledReason,
  normalizeGitHubRepository,
  resolveGitHubUpdatePublishConfig,
  shouldForceDesktopUpdateToastForActionResult,
} = require("../../electron/desktop-updates.cjs") as DesktopUpdatesModule

function createAutoUpdaterMock() {
  const emitter = new EventEmitter() as EventEmitter & {
    allowPrerelease?: boolean
    autoDownload?: boolean
    autoInstallOnAppQuit?: boolean
    channel?: string
    checkForUpdates: ReturnType<typeof vi.fn>
    downloadUpdate: ReturnType<typeof vi.fn>
    quitAndInstall: ReturnType<typeof vi.fn>
    setFeedURL: ReturnType<typeof vi.fn>
  }

  emitter.checkForUpdates = vi.fn().mockResolvedValue(undefined)
  emitter.downloadUpdate = vi.fn().mockResolvedValue(undefined)
  emitter.quitAndInstall = vi.fn()
  emitter.setFeedURL = vi.fn()

  return emitter
}

function createConfiguredUpdateManager(autoUpdater = createAutoUpdaterMock()) {
  const manager = createDesktopUpdateManager({
    app: { getVersion: () => "0.0.1", isPackaged: true },
    autoUpdater,
    env: {
      DESKTOP_UPDATE_REPOSITORY: "declancowen/Linear",
    },
    resourcesPath: "/missing-resources-path",
    timers: {
      setInterval: vi.fn(),
      setTimeout: vi.fn(),
    } as unknown as typeof globalThis,
  })

  manager.configure()

  return {
    autoUpdater,
    manager,
  }
}

describe("desktop updates", () => {
  it("normalizes GitHub repository values for updater feeds", () => {
    expect(normalizeGitHubRepository("declancowen/Linear")).toEqual({
      owner: "declancowen",
      repo: "Linear",
    })
    expect(
      normalizeGitHubRepository("https://github.com/declancowen/Linear.git")
    ).toEqual({
      owner: "declancowen",
      repo: "Linear",
    })
    expect(
      normalizeGitHubRepository("git@github.com:declancowen/Linear.git")
    ).toEqual({
      owner: "declancowen",
      repo: "Linear",
    })
    expect(normalizeGitHubRepository("not a repo")).toBeNull()
  })

  it("resolves an electron-updater GitHub publish config", () => {
    expect(
      resolveGitHubUpdatePublishConfig({
        DESKTOP_UPDATE_REPOSITORY: "declancowen/Linear",
      })
    ).toEqual({
      owner: "declancowen",
      provider: "github",
      releaseType: "release",
      repo: "Linear",
    })
  })

  it("disables updates outside packaged builds", () => {
    expect(
      getDesktopAutoUpdateDisabledReason({
        app: { isPackaged: false },
        env: {
          DESKTOP_UPDATE_REPOSITORY: "declancowen/Linear",
        },
      })
    ).toBe("Automatic updates are only available in packaged builds.")
  })

  it("configures a packaged GitHub updater without auto-downloading", () => {
    const autoUpdater = createAutoUpdaterMock()
    const timers = {
      setInterval: vi.fn(),
      setTimeout: vi.fn(),
    }
    const onStateChange = vi.fn()
    const manager = createDesktopUpdateManager({
      app: { getVersion: () => "0.0.1", isPackaged: true },
      autoUpdater,
      env: {
        DESKTOP_UPDATE_CHECK_DELAY_MS: "10",
        DESKTOP_UPDATE_CHECK_INTERVAL_MS: "20",
        DESKTOP_UPDATE_REPOSITORY: "declancowen/Linear",
      },
      onStateChange,
      resourcesPath: "/missing-resources-path",
      timers: timers as unknown as typeof globalThis,
    })

    expect(manager.configure()).toMatchObject({
      configured: true,
      status: "idle",
    })
    expect(autoUpdater.setFeedURL).toHaveBeenCalledWith({
      owner: "declancowen",
      provider: "github",
      releaseType: "release",
      repo: "Linear",
    })
    expect(autoUpdater.autoDownload).toBe(false)
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true)
    expect(autoUpdater.channel).toBe("latest")
    expect(timers.setTimeout).toHaveBeenCalled()
    expect(timers.setInterval).toHaveBeenCalled()

    autoUpdater.emit("update-available", { version: "0.0.2" })
    expect(manager.getState()).toMatchObject({
      availableVersion: "0.0.2",
      currentVersion: "0.0.1",
      status: "available",
    })
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled()

    autoUpdater.emit("update-downloaded", { version: "0.0.2" })
    expect(manager.getState()).toMatchObject({
      downloadedVersion: "0.0.2",
      status: "downloaded",
    })
    expect(onStateChange).toHaveBeenCalled()
  })

  it("reports the current version when no update is available", async () => {
    const { autoUpdater, manager } = createConfiguredUpdateManager()

    autoUpdater.checkForUpdates.mockImplementationOnce(async () => {
      autoUpdater.emit("update-not-available")
    })

    await expect(manager.checkForUpdates("renderer")).resolves.toMatchObject({
      checked: true,
      state: {
        currentVersion: "0.0.1",
        message: "Recipe Room 0.0.1 is up to date.",
        status: "idle",
      },
    })
  })

  it("installs a downloaded update when requested by the renderer", () => {
    const { autoUpdater, manager } = createConfiguredUpdateManager()

    expect(manager.installUpdate()).toMatchObject({
      accepted: true,
      completed: false,
    })
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })

  it("marks failed manual update actions as requiring visible feedback", async () => {
    const { autoUpdater, manager } = createConfiguredUpdateManager()

    autoUpdater.downloadUpdate.mockRejectedValueOnce(new Error("asset missing"))

    const result = await manager.downloadUpdate()

    expect(result).toMatchObject({
      accepted: true,
      completed: false,
      error: "asset missing",
      state: {
        status: "error",
      },
    })
    expect(shouldForceDesktopUpdateToastForActionResult(result)).toBe(true)
    expect(
      shouldForceDesktopUpdateToastForActionResult({
        error: undefined,
      })
    ).toBe(false)
  })
})
