/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")

const DEFAULT_UPDATE_CHECK_DELAY_MS = 15_000
const DEFAULT_UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const UPDATE_CONFIG_FILE_NAME = "app-update.yml"

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeGitHubRepository(value) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  const withoutGitSuffix = trimmed.replace(/\.git$/u, "")
  const sshMatch = withoutGitSuffix.match(/^git@github\.com:([^/]+)\/(.+)$/u)
  const httpsMatch = withoutGitSuffix.match(
    /^https:\/\/github\.com\/([^/]+)\/(.+)$/u
  )
  const shorthandMatch = withoutGitSuffix.match(/^([^/\s]+)\/([^/\s]+)$/u)
  const match = sshMatch ?? httpsMatch ?? shorthandMatch

  if (!match?.[1] || !match[2]) {
    return null
  }

  return {
    owner: match[1],
    repo: match[2],
  }
}

function resolveGitHubUpdatePublishConfig(env = process.env) {
  const repository = normalizeGitHubRepository(
    env.DESKTOP_UPDATE_REPOSITORY ?? env.GITHUB_REPOSITORY
  )

  if (!repository) {
    return null
  }

  return {
    provider: "github",
    owner: repository.owner,
    repo: repository.repo,
    releaseType: "release",
  }
}

function getPackagedUpdateConfigPath(resourcesPath = process.resourcesPath) {
  return resourcesPath
    ? path.join(resourcesPath, UPDATE_CONFIG_FILE_NAME)
    : UPDATE_CONFIG_FILE_NAME
}

function hasPackagedUpdateConfig(resourcesPath = process.resourcesPath) {
  return fs.existsSync(getPackagedUpdateConfigPath(resourcesPath))
}

function isAutoUpdateDisabled(env = process.env) {
  const value = env.DESKTOP_DISABLE_AUTO_UPDATE?.trim().toLowerCase()

  return value === "1" || value === "true"
}

function getDesktopAutoUpdateDisabledReason({
  app,
  env = process.env,
  resourcesPath = process.resourcesPath,
} = {}) {
  if (isAutoUpdateDisabled(env)) {
    return "Automatic updates are disabled by DESKTOP_DISABLE_AUTO_UPDATE."
  }

  if (!app?.isPackaged) {
    return "Automatic updates are only available in packaged builds."
  }

  if (
    !hasPackagedUpdateConfig(resourcesPath) &&
    !resolveGitHubUpdatePublishConfig(env)
  ) {
    return "Automatic updates are unavailable because no GitHub update feed is configured."
  }

  return null
}

function getUpdateVersion(info) {
  return typeof info?.version === "string" && info.version.trim()
    ? info.version.trim()
    : null
}

function shouldForceDesktopUpdateToastForActionResult(result) {
  return Boolean(result?.error)
}

function createDesktopUpdateManager({
  app,
  autoUpdater,
  env = process.env,
  log = () => {},
  onStateChange = () => {},
  resourcesPath = process.resourcesPath,
  timers = globalThis,
}) {
  let configured = false
  let status = "idle"
  let message = null
  let availableVersion = null
  let downloadedVersion = null
  let checkingForUpdates = false
  let downloadingUpdate = false
  const startupDelayMs = parsePositiveInteger(
    env.DESKTOP_UPDATE_CHECK_DELAY_MS,
    DEFAULT_UPDATE_CHECK_DELAY_MS
  )
  const checkIntervalMs = parsePositiveInteger(
    env.DESKTOP_UPDATE_CHECK_INTERVAL_MS,
    DEFAULT_UPDATE_CHECK_INTERVAL_MS
  )

  function setState(nextState) {
    status = nextState.status ?? status
    message = nextState.message ?? null
    availableVersion =
      "availableVersion" in nextState
        ? nextState.availableVersion
        : availableVersion
    downloadedVersion =
      "downloadedVersion" in nextState
        ? nextState.downloadedVersion
        : downloadedVersion
    onStateChange(getState())
  }

  function getState() {
    const disabledReason = getDesktopAutoUpdateDisabledReason({
      app,
      env,
      resourcesPath,
    })

    return {
      availableVersion,
      configured,
      disabledReason,
      downloadedVersion,
      message,
      status: disabledReason ? "disabled" : status,
    }
  }

  async function checkForUpdates(reason = "manual") {
    const disabledReason = getDesktopAutoUpdateDisabledReason({
      app,
      env,
      resourcesPath,
    })

    if (disabledReason || !configured || checkingForUpdates) {
      return {
        checked: false,
        reason: disabledReason ?? "Update check already in progress.",
        state: getState(),
      }
    }

    if (
      status === "available" ||
      status === "downloaded" ||
      status === "downloading"
    ) {
      const existingUpdateReason =
        status === "available"
          ? "Update already available."
          : status === "downloaded"
            ? "Update already downloaded."
            : "Update download already in progress."

      return {
        checked: false,
        reason: existingUpdateReason,
        state: getState(),
      }
    }

    checkingForUpdates = true
    setState({ message: null, status: "checking" })
    log("desktop-updates.check-start", { reason })

    try {
      await autoUpdater.checkForUpdates()

      return {
        checked: true,
        state: getState(),
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to check for updates."
      setState({
        message: errorMessage,
        status: "error",
      })
      log("desktop-updates.check-error", { message: errorMessage, reason })

      return {
        checked: true,
        error: errorMessage,
        state: getState(),
      }
    } finally {
      checkingForUpdates = false
    }
  }

  async function downloadUpdate() {
    if (!configured || downloadingUpdate) {
      return {
        accepted: false,
        completed: false,
        state: getState(),
      }
    }

    downloadingUpdate = true
    setState({ message: null, status: "downloading" })

    try {
      await autoUpdater.downloadUpdate()

      return {
        accepted: true,
        completed: true,
        state: getState(),
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to download update."
      setState({
        message: errorMessage,
        status: "error",
      })
      log("desktop-updates.download-error", { message: errorMessage })

      return {
        accepted: true,
        completed: false,
        error: errorMessage,
        state: getState(),
      }
    } finally {
      downloadingUpdate = false
    }
  }

  function installUpdate() {
    if (!configured) {
      return {
        accepted: false,
        completed: false,
        state: getState(),
      }
    }

    try {
      setState({ message: null, status: "installing" })
      autoUpdater.quitAndInstall(false, true)

      return {
        accepted: true,
        completed: false,
        state: getState(),
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to install update."
      setState({
        message: errorMessage,
        status: "error",
      })
      log("desktop-updates.install-error", { message: errorMessage })

      return {
        accepted: true,
        completed: false,
        error: errorMessage,
        state: getState(),
      }
    }
  }

  function configure() {
    if (configured) {
      return getState()
    }

    const disabledReason = getDesktopAutoUpdateDisabledReason({
      app,
      env,
      resourcesPath,
    })

    if (disabledReason) {
      setState({ message: disabledReason, status: "disabled" })
      log("desktop-updates.disabled", { reason: disabledReason })
      return getState()
    }

    const publishConfig = resolveGitHubUpdatePublishConfig(env)

    if (publishConfig && !hasPackagedUpdateConfig(resourcesPath)) {
      autoUpdater.setFeedURL(publishConfig)
    }

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.channel = "latest"

    autoUpdater.on("checking-for-update", () => {
      setState({ message: null, status: "checking" })
      log("desktop-updates.checking")
    })
    autoUpdater.on("update-available", (info) => {
      const version = getUpdateVersion(info)
      setState({
        availableVersion: version,
        message: null,
        status: "available",
      })
      log("desktop-updates.available", { version })
    })
    autoUpdater.on("update-not-available", () => {
      setState({ message: null, status: "idle" })
      log("desktop-updates.not-available")
    })
    autoUpdater.on("download-progress", (progress) => {
      setState({ message: null, status: "downloading" })
      log("desktop-updates.download-progress", {
        percent:
          typeof progress?.percent === "number"
            ? Math.floor(progress.percent)
            : null,
      })
    })
    autoUpdater.on("update-downloaded", (info) => {
      const version = getUpdateVersion(info)
      setState({
        downloadedVersion: version,
        message: null,
        status: "downloaded",
      })
      log("desktop-updates.downloaded", { version })
    })
    autoUpdater.on("error", (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Updater error."
      setState({
        message: errorMessage,
        status: "error",
      })
      log("desktop-updates.error", { message: errorMessage })
    })

    configured = true
    setState({ message: null, status: "idle" })
    timers.setTimeout(() => {
      void checkForUpdates("startup")
    }, startupDelayMs)
    timers.setInterval(() => {
      void checkForUpdates("poll")
    }, checkIntervalMs)
    log("desktop-updates.configured", {
      checkIntervalMs,
      startupDelayMs,
    })

    return getState()
  }

  return {
    checkForUpdates,
    configure,
    downloadUpdate,
    getState,
    installUpdate,
  }
}

module.exports = {
  DEFAULT_UPDATE_CHECK_DELAY_MS,
  DEFAULT_UPDATE_CHECK_INTERVAL_MS,
  UPDATE_CONFIG_FILE_NAME,
  createDesktopUpdateManager,
  getDesktopAutoUpdateDisabledReason,
  getPackagedUpdateConfigPath,
  hasPackagedUpdateConfig,
  normalizeGitHubRepository,
  resolveGitHubUpdatePublishConfig,
  shouldForceDesktopUpdateToastForActionResult,
}
