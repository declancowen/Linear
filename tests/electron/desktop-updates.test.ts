import { EventEmitter } from "node:events"
import { createRequire } from "node:module"

import { describe, expect, it, vi } from "vitest"

type DesktopUpdateTestManager = {
  configure: () => DesktopUpdateState
  getState: () => DesktopUpdateState
  installUpdate: () => {
    accepted: boolean
    completed: boolean
    state: DesktopUpdateState
  }
}

type DesktopUpdatesModule = {
  createDesktopUpdateManager: (options: {
    app: { isPackaged: boolean }
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
}

const require = createRequire(import.meta.url)
const {
  createDesktopUpdateManager,
  getDesktopAutoUpdateDisabledReason,
  normalizeGitHubRepository,
  resolveGitHubUpdatePublishConfig,
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
      app: { isPackaged: true },
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

  it("installs a downloaded update when requested by the renderer", () => {
    const autoUpdater = createAutoUpdaterMock()
    const manager = createDesktopUpdateManager({
      app: { isPackaged: true },
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
    expect(manager.installUpdate()).toMatchObject({
      accepted: true,
      completed: false,
    })
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })
})
