/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("node:child_process")
const { createServer } = require("node:net")
const path = require("node:path")

const { app, BrowserWindow, nativeImage, shell } = require("electron")

const appName = "Recipe Room"
const isDev = process.env.NODE_ENV !== "production"
const localServerUrl =
  process.env.NEXT_DEV_SERVER_URL ?? "http://localhost:3000"

let mainWindow = null
let nextServerProcess = null
let nextServerUrl = null

app.setName(appName)

function resolveDesktopIcon() {
  const iconPath = path.join(__dirname, "app-icon.png")
  const icon = nativeImage.createFromPath(iconPath)

  if (icon.isEmpty()) {
    return null
  }

  return {
    icon,
    iconPath,
  }
}

function sleep(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration)
  })
}

async function waitForUrl(url, timeout = 30000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
      })

      if (response.ok || response.status < 500) {
        return
      }
    } catch {}

    await sleep(500)
  }

  throw new Error(`Timed out waiting for ${url}`)
}

function findAvailablePort(host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, host, () => {
      const address = server.address()

      if (!address || typeof address === "string") {
        server.close(() => {
          reject(new Error("Failed to allocate a local port"))
        })
        return
      }

      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(address.port)
      })
    })
  })
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

function isAppUrl(url, rendererOrigin) {
  try {
    return new URL(url).origin === rendererOrigin
  } catch {
    return false
  }
}

async function resolveRendererUrl() {
  if (isDev) {
    await waitForUrl(localServerUrl, 120000)
    return localServerUrl
  }

  if (
    nextServerProcess &&
    nextServerProcess.exitCode === null &&
    !nextServerProcess.killed &&
    nextServerUrl
  ) {
    try {
      await waitForUrl(nextServerUrl, 5000)
      return nextServerUrl
    } catch {
      nextServerProcess.kill()
      nextServerProcess = null
      nextServerUrl = null
    }
  }

  const appPath = app.getAppPath()
  const standaloneServer = path.join(appPath, ".next", "standalone", "server.js")
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

async function createWindow(iconPath) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus()
    return mainWindow
  }

  const rendererUrl = await resolveRendererUrl()
  const rendererOrigin = new URL(rendererUrl).origin
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#f7f6f2",
    ...(iconPath ? { icon: iconPath } : {}),
    title: appName,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url, rendererOrigin)) {
      void mainWindow.loadURL(url)
      return { action: "deny" }
    }

    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    }

    return { action: "deny" }
  })

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url, rendererOrigin)) {
      return
    }

    event.preventDefault()

    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    }
  })

  await mainWindow.loadURL(rendererUrl)

  if (isDev) {
    mainWindow.webContents.openDevTools({
      mode: "detach",
    })
  }

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

  if (process.platform === "darwin" && desktopIcon) {
    app.dock.setIcon(desktopIcon.icon.resize({ width: 256, height: 256 }))
  }

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
