/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")

const { app, BrowserWindow, nativeImage, shell } = require("electron")
const { findAvailablePort, waitForUrl } = require("./local-server.cjs")
const { resolvePackagedRendererUrl } = require("./runtime-config.cjs")

const appName = "Recipe Room"
const isDevelopment = !app.isPackaged && process.env.NODE_ENV === "development"
const shouldUseLocalStandaloneServer = process.env.ELECTRON_LOCAL_SERVER === "1"
const localServerUrl =
  process.env.NEXT_DEV_SERVER_URL ?? "http://localhost:3000"
const trustedInAppExactHosts = new Set([
  "api.workos.com",
  "accounts.google.com",
  "appleid.apple.com",
])
const trustedInAppHostSuffixes = [
  ".workos.com",
  ".google.com",
  ".googleusercontent.com",
]

let mainWindow = null
let nextServerProcess = null
let nextServerUrl = null

app.setName(appName)

function resolveDesktopIcon() {
  const iconPaths = [
    path.resolve(__dirname, "..", "app-icon.png"),
    path.join(__dirname, "app-icon.png"),
  ]

  for (const iconPath of iconPaths) {
    const icon = nativeImage.createFromPath(iconPath)

    if (icon.isEmpty()) {
      continue
    }

    return {
      icon,
      iconPath,
    }
  }

  return null
}

function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(url)

    if (parsed.protocol === "mailto:") {
      return true
    }

    return parsed.protocol === "https:"
  } catch {
    return false
  }
}

function isTrustedInAppHttpsHost(hostname) {
  return (
    trustedInAppExactHosts.has(hostname) ||
    trustedInAppHostSuffixes.some((suffix) => hostname.endsWith(suffix))
  )
}

function isTrustedInAppUrl(url, rendererOrigin) {
  try {
    const parsed = new URL(url)

    if (parsed.origin === rendererOrigin) {
      return true
    }

    return parsed.protocol === "https:" && isTrustedInAppHttpsHost(parsed.hostname)
  } catch {
    return false
  }
}

async function resolveRendererUrl() {
  if (isDevelopment) {
    await waitForUrl(localServerUrl, 120000)
    return localServerUrl
  }

  const appPath = app.getAppPath()
  const standaloneServer = path.join(appPath, ".next", "standalone", "server.js")

  if (!shouldUseStandaloneRendererServer(standaloneServer)) {
    return resolvePackagedRendererUrl(appPath)
  }

  const existingServerUrl = await resolveExistingStandaloneRendererUrl()

  if (existingServerUrl) {
    return existingServerUrl
  }

  return startStandaloneRendererServer(appPath, standaloneServer)
}

function shouldUseStandaloneRendererServer(standaloneServer) {
  return (
    fs.existsSync(standaloneServer) &&
    (shouldUseLocalStandaloneServer || app.isPackaged)
  )
}

function hasRunningStandaloneRendererServer() {
  return (
    nextServerProcess &&
    nextServerProcess.exitCode === null &&
    !nextServerProcess.killed &&
    nextServerUrl
  )
}

async function resolveExistingStandaloneRendererUrl() {
  if (!hasRunningStandaloneRendererServer()) {
    return null
  }

  try {
    await waitForUrl(nextServerUrl, 5000)
    return nextServerUrl
  } catch {
    nextServerProcess.kill()
    nextServerProcess = null
    nextServerUrl = null
    return null
  }
}

async function startStandaloneRendererServer(appPath, standaloneServer) {
  const port = await findAvailablePort()
  const rendererUrl = `http://localhost:${port}`
  const serverProcess = spawn(process.execPath, [standaloneServer], {
    cwd: appPath,
    env: {
      ...process.env,
      HOSTNAME: "localhost",
      NODE_ENV: "production",
      PORT: String(port),
    },
    stdio: "inherit",
    windowsHide: true,
  })

  serverProcess.once("exit", () => {
    if (nextServerProcess === serverProcess) {
      nextServerProcess = null
      nextServerUrl = null
    }
  })

  nextServerProcess = serverProcess
  nextServerUrl = rendererUrl

  await waitForUrl(rendererUrl, 60000)

  return rendererUrl
}

function getExistingMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }

  return null
}

function createMainBrowserWindow(iconPath) {
  return new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#f7f6f2",
    ...(process.platform !== "darwin" && iconPath ? { icon: iconPath } : {}),
    title: appName,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  })
}

function registerMainWindowLifecycle(window) {
  window.on("closed", () => {
    mainWindow = null
  })
}

function registerMainWindowNavigationGuards(window, rendererOrigin) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedInAppUrl(url, rendererOrigin)) {
      void window.loadURL(url)
      return { action: "deny" }
    }

    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    }

    return { action: "deny" }
  })

  window.webContents.on("will-navigate", (event, url) => {
    if (isTrustedInAppUrl(url, rendererOrigin)) {
      return
    }

    event.preventDefault()

    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    }
  })
}

function openDevToolsForDevelopment(window) {
  if (isDevelopment) {
    window.webContents.openDevTools({
      mode: "detach",
    })
  }
}

async function createWindow(iconPath) {
  const existingWindow = getExistingMainWindow()

  if (existingWindow) {
    existingWindow.focus()
    return existingWindow
  }

  const rendererUrl = await resolveRendererUrl()
  const rendererOrigin = new URL(rendererUrl).origin
  mainWindow = createMainBrowserWindow(iconPath)

  registerMainWindowLifecycle(mainWindow)
  registerMainWindowNavigationGuards(mainWindow, rendererOrigin)

  await mainWindow.loadURL(rendererUrl)
  openDevToolsForDevelopment(mainWindow)

  return mainWindow
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    const desktopIcon = resolveDesktopIcon()

    app.setAboutPanelOptions({
      applicationName: appName,
    })

    await createWindow(desktopIcon?.iconPath)

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow(desktopIcon?.iconPath)
      }
    })
  })
}

app.on("before-quit", () => {
  nextServerProcess?.kill()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
