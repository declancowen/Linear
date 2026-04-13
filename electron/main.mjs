import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { app, BrowserWindow, nativeImage, shell } from "electron"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDev = !app.isPackaged
const localServerUrl = process.env.NEXT_DEV_SERVER_URL ?? "http://127.0.0.1:3000"

let nextServerProcess = null

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

async function resolveRendererUrl() {
  if (isDev) {
    await waitForUrl(localServerUrl, 120000)
    return localServerUrl
  }

  const appPath = app.getAppPath()
  const standaloneServer = path.join(appPath, ".next", "standalone", "server.js")

  nextServerProcess = spawn(process.execPath, [standaloneServer], {
    cwd: appPath,
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      PORT: "3000",
    },
    stdio: "inherit",
    windowsHide: true,
  })

  await waitForUrl("http://127.0.0.1:3000", 60000)

  return "http://127.0.0.1:3000"
}

async function createWindow(iconPath) {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#f7f6f2",
    ...(iconPath ? { icon: iconPath } : {}),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.mjs"),
      sandbox: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  const rendererUrl = await resolveRendererUrl()
  await mainWindow.loadURL(rendererUrl)

  if (isDev) {
    mainWindow.webContents.openDevTools({
      mode: "detach",
    })
  }
}

app.whenReady().then(async () => {
  const desktopIcon = resolveDesktopIcon()

  if (process.platform === "darwin" && desktopIcon) {
    app.dock.setIcon(desktopIcon.icon)
  }

  await createWindow(desktopIcon?.iconPath)

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow(desktopIcon?.iconPath)
    }
  })
})

app.on("before-quit", () => {
  nextServerProcess?.kill()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
