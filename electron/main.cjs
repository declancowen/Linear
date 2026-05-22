/* eslint-disable @typescript-eslint/no-require-imports */
if (process.env.DESKTOP_STARTUP_LOG) {
  require("node:fs").appendFileSync(
    process.env.DESKTOP_STARTUP_LOG,
    `${JSON.stringify({
      time: new Date().toISOString(),
      event: "main.entry",
    })}\n`
  )
}

const { spawn } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")

const {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  nativeImage,
  Notification: NativeNotification,
  safeStorage,
  session,
  shell,
} = require("electron")
const {
  createDesktopNotificationBridge,
} = require("./desktop-notifications.cjs")
const { createDesktopAuthStore } = require("./desktop-auth-store.cjs")
const {
  submitDesktopPasswordLogin,
  submitDesktopPasswordSignup,
} = require("./desktop-auth-flow.cjs")
const {
  findDesktopDeepLinkUrl,
  isDesktopDeepLinkUrl,
  parseDesktopDeepLinkUrl,
  resolveDeepLinkScheme,
} = require("./deep-links.cjs")
const { findAvailablePort, waitForUrl } = require("./local-server.cjs")
const {
  isAllowedExternalUrl,
  isTrustedInAppUrl,
} = require("./navigation-policy.cjs")
const {
  resolveDesktopApiBaseUrl,
  resolvePackagedRendererUrl,
} = require("./runtime-config.cjs")

const appName = "Recipe Room"
const desktopStartupLogPath = process.env.DESKTOP_STARTUP_LOG
const desktopDeepLinkScheme = resolveDeepLinkScheme(process.env)
const isDevelopment = !app.isPackaged && process.env.NODE_ENV === "development"
const shouldUseLocalStandaloneServer = process.env.ELECTRON_LOCAL_SERVER === "1"
const localServerUrl =
  process.env.NEXT_DEV_SERVER_URL ?? "http://localhost:3000"
const desktopRemoteDebuggingPort =
  process.env.DESKTOP_REMOTE_DEBUGGING_PORT?.trim()
let mainWindow = null
let nextServerProcess = null
let nextServerUrl = null
let pendingDeepLinkUrl = null
let desktopIconPath = null
let rendererOrigin = null
let rendererUrl = null
let desktopApiBaseUrl = null
const desktopAuthStore = createDesktopAuthStore({
  app,
  persistTokens: process.env.DESKTOP_ENABLE_AUTH_TOKEN_PERSISTENCE === "1",
  safeStorage,
})

app.setName(appName)

if (/^\d+$/.test(desktopRemoteDebuggingPort ?? "")) {
  app.commandLine.appendSwitch(
    "remote-debugging-port",
    desktopRemoteDebuggingPort
  )
}

function logDesktopStartup(event, details = {}) {
  if (!desktopStartupLogPath) {
    return
  }

  try {
    fs.appendFileSync(
      desktopStartupLogPath,
      `${JSON.stringify({
        time: new Date().toISOString(),
        event,
        ...details,
      })}\n`
    )
  } catch {}
}

function sanitizeDesktopUrlForLog(value) {
  try {
    const url = new URL(value)

    if (url.searchParams.has("ticket")) {
      url.searchParams.set("ticket", "<redacted>")
    }

    const path = url.searchParams.get("path")

    if (path) {
      const nestedPath = new URL(path, "https://desktop.local")

      if (nestedPath.searchParams.has("ticket")) {
        nestedPath.searchParams.set("ticket", "<redacted>")
        url.searchParams.set(
          "path",
          `${nestedPath.pathname}${nestedPath.search}${nestedPath.hash}`
        )
      }
    }

    if (url.hash.startsWith("#/")) {
      const hashPath = new URL(url.hash.slice(1), "https://desktop.local")

      if (hashPath.searchParams.has("ticket")) {
        hashPath.searchParams.set("ticket", "<redacted>")
        url.hash = `#${hashPath.pathname}${hashPath.search}${hashPath.hash}`
      }
    }

    return url.toString()
  } catch {
    return "<invalid-url>"
  }
}

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

function registerDeepLinkProtocolClient() {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(desktopDeepLinkScheme, process.execPath, [
      path.resolve(process.argv[1]),
    ])
    return
  }

  app.setAsDefaultProtocolClient(desktopDeepLinkScheme)
}

function isFileRendererUrl(url) {
  try {
    return new URL(url).protocol === "file:"
  } catch {
    return false
  }
}

function resolveRendererTargetUrl(targetPath) {
  if (!rendererUrl) {
    return null
  }

  if (isFileRendererUrl(rendererUrl)) {
    const baseUrl = rendererUrl.split("#")[0]

    return `${baseUrl}#${targetPath}`
  }

  return new URL(targetPath, rendererOrigin).toString()
}

async function resolveRendererUrl() {
  if (isDevelopment) {
    await waitForUrl(localServerUrl, 120000)
    return localServerUrl
  }

  const appPath = app.getAppPath()
  const standaloneServer = path.join(
    appPath,
    ".next",
    "standalone",
    "server.js"
  )

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
  return fs.existsSync(standaloneServer) && shouldUseLocalStandaloneServer
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

function focusWindow(window) {
  if (window.isMinimized()) {
    window.restore()
  }

  window.focus()
}

async function loadDesktopDeepLink(window, url) {
  logDesktopStartup("deeplink.load-start", {
    url: sanitizeDesktopUrlForLog(url),
  })

  if (!rendererOrigin) {
    pendingDeepLinkUrl = url
    return false
  }

  const targetPath = parseDesktopDeepLinkUrl(url, desktopDeepLinkScheme)

  if (!targetPath) {
    logDesktopStartup("deeplink.load-rejected")
    return false
  }

  const targetUrl = resolveRendererTargetUrl(targetPath)

  if (!targetUrl) {
    logDesktopStartup("deeplink.load-no-target")
    return false
  }

  logDesktopStartup("deeplink.load-target", {
    targetUrl: sanitizeDesktopUrlForLog(targetUrl),
  })
  await window.loadURL(targetUrl)
  focusWindow(window)

  return true
}

async function loadPendingDesktopDeepLink(window) {
  const url = pendingDeepLinkUrl

  if (!url) {
    return
  }

  pendingDeepLinkUrl = null
  await loadDesktopDeepLink(window, url)
}

async function handleDesktopDeepLink(url) {
  logDesktopStartup("deeplink.handle", {
    url: sanitizeDesktopUrlForLog(url),
  })
  pendingDeepLinkUrl = url

  if (!app.isReady()) {
    return
  }

  const existingWindow = getExistingMainWindow()

  if (existingWindow) {
    const nextUrl = pendingDeepLinkUrl
    pendingDeepLinkUrl = null
    await loadDesktopDeepLink(existingWindow, nextUrl)
    return
  }

  await createWindow(desktopIconPath)
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  })
}

function registerMainWindowLifecycle(window) {
  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedUrl) => {
      logDesktopStartup("window.did-fail-load", {
        errorCode,
        errorDescription,
        validatedUrl,
      })
    }
  )
  window.webContents.on("did-finish-load", () => {
    logDesktopStartup("window.did-finish-load", {
      url: window.webContents.getURL(),
    })
  })
  window.webContents.on("render-process-gone", (_event, details) => {
    logDesktopStartup("window.render-process-gone", details)
  })
  window.on("closed", () => {
    logDesktopStartup("window.closed")
    mainWindow = null
  })
}

function registerMainWindowNavigationGuards(window, rendererOrigin) {
  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isDesktopDeepLinkUrl(url, desktopDeepLinkScheme)) {
      void handleDesktopDeepLink(url)
      return { action: "deny" }
    }

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
    if (isDesktopDeepLinkUrl(url, desktopDeepLinkScheme)) {
      event.preventDefault()
      void handleDesktopDeepLink(url)
      return
    }

    if (isTrustedInAppUrl(url, rendererOrigin)) {
      return
    }

    event.preventDefault()

    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    }
  })
}

function registerDefaultSessionGuards() {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false)
    }
  )
}

function registerDesktopAuthHandlers() {
  ipcMain.handle("desktop-auth:get-token", () => desktopAuthStore.getToken())
  ipcMain.handle("desktop-auth:set-token", (_event, value) => {
    const didSetToken = desktopAuthStore.setToken(value)
    logDesktopStartup("desktop-auth.set-token", {
      didSetToken,
    })

    return didSetToken
  })
  ipcMain.handle("desktop-auth:clear-token", () =>
    desktopAuthStore.clearToken()
  )
  ipcMain.handle("desktop-auth:submit-password-login", async (_event, value) => {
    logDesktopStartup("desktop-auth.submit-password-login", {
      apiBaseUrl: desktopApiBaseUrl,
      hasEmail: typeof value?.email === "string" && value.email.length > 0,
      hasPassword:
        typeof value?.password === "string" && value.password.length > 0,
      nextPath: value?.nextPath,
    })

    try {
      const result = await submitDesktopPasswordLogin(value, {
        apiBaseUrl: desktopApiBaseUrl,
        handleDesktopDeepLink,
        isDesktopDeepLinkUrl: (url) =>
          isDesktopDeepLinkUrl(url, desktopDeepLinkScheme),
      })

      logDesktopStartup("desktop-auth.submit-password-login-result", result)

      return result
    } catch (error) {
      logDesktopStartup("desktop-auth.submit-password-login-error", {
        message: error instanceof Error ? error.message : "Unknown error",
      })

      return {
        error: "Desktop sign-in failed. Check your connection and try again.",
        ok: false,
      }
    }
  })
  ipcMain.handle(
    "desktop-auth:submit-password-signup",
    async (_event, value) => {
      logDesktopStartup("desktop-auth.submit-password-signup", {
        apiBaseUrl: desktopApiBaseUrl,
        hasEmail: typeof value?.email === "string" && value.email.length > 0,
        hasFirstName:
          typeof value?.firstName === "string" && value.firstName.length > 0,
        hasLastName:
          typeof value?.lastName === "string" && value.lastName.length > 0,
        hasPassword:
          typeof value?.password === "string" && value.password.length > 0,
        nextPath: value?.nextPath,
      })

      try {
        const result = await submitDesktopPasswordSignup(value, {
          apiBaseUrl: desktopApiBaseUrl,
          handleDesktopDeepLink,
          isDesktopDeepLinkUrl: (url) =>
            isDesktopDeepLinkUrl(url, desktopDeepLinkScheme),
        })

        logDesktopStartup("desktop-auth.submit-password-signup-result", result)

        return result
      } catch (error) {
        logDesktopStartup("desktop-auth.submit-password-signup-error", {
          message: error instanceof Error ? error.message : "Unknown error",
        })

        return {
          error: "Desktop sign-up failed. Check your connection and try again.",
          ok: false,
        }
      }
    }
  )
}

function registerDesktopNotificationHandlers() {
  const desktopNotificationBridge = createDesktopNotificationBridge({
    createWindow: () => createWindow(desktopIconPath),
    focusWindow,
    getMainWindow: getExistingMainWindow,
    NativeNotification,
    resolveRendererTargetUrl,
  })

  ipcMain.handle("desktop-notifications:show", (_event, value) =>
    desktopNotificationBridge.show(value)
  )
}

function registerDesktopClipboardHandlers() {
  ipcMain.handle("desktop-clipboard:write-text", (_event, value) => {
    if (typeof value !== "string" || value.length === 0) {
      return false
    }

    clipboard.writeText(value)
    return true
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
  logDesktopStartup("window.create-start")
  const existingWindow = getExistingMainWindow()

  if (existingWindow) {
    existingWindow.focus()
    return existingWindow
  }

  rendererUrl = await resolveRendererUrl()
  rendererOrigin = new URL(rendererUrl).origin
  logDesktopStartup("window.renderer-url", {
    rendererOrigin,
    rendererUrl,
  })
  mainWindow = createMainBrowserWindow(iconPath)

  registerMainWindowLifecycle(mainWindow)
  registerMainWindowNavigationGuards(mainWindow, rendererOrigin)

  await mainWindow.loadURL(rendererUrl)
  logDesktopStartup("window.load-url-complete", {
    url: mainWindow.webContents.getURL(),
  })
  await loadPendingDesktopDeepLink(mainWindow)
  openDevToolsForDevelopment(mainWindow)

  return mainWindow
}

function logDesktopStartupError(event, error) {
  logDesktopStartup(event, {
    message: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
  })
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
logDesktopStartup("app.single-instance-lock", {
  hasSingleInstanceLock,
})

if (!hasSingleInstanceLock) {
  logDesktopStartup("app.quit-no-single-instance-lock")
  app.quit()
} else {
  app.on("second-instance", (_event, commandLine) => {
    const deepLinkUrl = findDesktopDeepLinkUrl(
      commandLine,
      desktopDeepLinkScheme
    )

    if (deepLinkUrl) {
      void handleDesktopDeepLink(deepLinkUrl)
    }

    if (!mainWindow) {
      return
    }

    focusWindow(mainWindow)
  })

  registerDeepLinkProtocolClient()

  app.on("open-url", (event, url) => {
    event.preventDefault()
    void handleDesktopDeepLink(url)
  })

  app.whenReady().then(async () => {
    logDesktopStartup("app.ready", {
      appPath: app.getAppPath(),
      isPackaged: app.isPackaged,
      remoteDebuggingEnabled: /^\d+$/.test(desktopRemoteDebuggingPort ?? ""),
    })
    desktopApiBaseUrl = resolveDesktopApiBaseUrl(app.getAppPath())
    logDesktopStartup("app.desktop-api-base-url", {
      desktopApiBaseUrl,
    })
    logDesktopStartup("app.resolve-icon-start")
    const desktopIcon = resolveDesktopIcon()
    desktopIconPath = desktopIcon?.iconPath
    logDesktopStartup("app.resolve-icon-complete", {
      hasIcon: Boolean(desktopIconPath),
    })

    app.setAboutPanelOptions({
      applicationName: appName,
    })
    logDesktopStartup("app.register-session-guards-start")
    registerDefaultSessionGuards()
    logDesktopStartup("app.load-auth-token-start")
    desktopAuthStore.loadToken()
    logDesktopStartup("app.load-auth-token-complete", {
      hasToken: Boolean(desktopAuthStore.getToken()),
    })
    logDesktopStartup("app.register-auth-handlers-start")
    registerDesktopAuthHandlers()
    logDesktopStartup("app.register-notification-handlers-start")
    registerDesktopNotificationHandlers()
    registerDesktopClipboardHandlers()

    await createWindow(desktopIconPath)

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow(desktopIconPath)
      }
    })
  }).catch((error) => {
    logDesktopStartupError("app.ready-error", error)
  })
}

app.on("before-quit", () => {
  logDesktopStartup("app.before-quit")
  nextServerProcess?.kill()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
