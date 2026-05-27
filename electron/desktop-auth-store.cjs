/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")

const DESKTOP_AUTH_TOKEN_FILE = "desktop-auth-token.v1"
const DESKTOP_AUTH_TOKEN_STORAGE_MODES = new Set(["local", "memory", "safe"])

function normalizeDesktopAuthToken(value) {
  if (typeof value !== "string") {
    return null
  }

  const token = value.trim()

  return token.length > 0 && token.length <= 8192 ? token : null
}

function normalizeDesktopAuthTokenStorageMode(value) {
  const mode = value?.trim().toLowerCase()

  return DESKTOP_AUTH_TOKEN_STORAGE_MODES.has(mode) ? mode : "local"
}

function canUseSafeStorage(safeStorage, persistTokens, storageMode) {
  if (!persistTokens || storageMode !== "safe") {
    return false
  }

  try {
    return safeStorage?.isEncryptionAvailable?.() === true
  } catch {
    return false
  }
}

function shouldPersistDesktopAuthTokens(env = process.env) {
  const value = env.DESKTOP_ENABLE_AUTH_TOKEN_PERSISTENCE?.trim().toLowerCase()

  return value !== "0" && value !== "false"
}

function resolveDesktopAuthTokenStorageMode(env = process.env) {
  return normalizeDesktopAuthTokenStorageMode(env.DESKTOP_AUTH_TOKEN_STORAGE)
}

function createDesktopAuthStore({
  app,
  persistTokens = true,
  safeStorage,
  storageMode = "local",
}) {
  let desktopAuthToken = null
  const resolvedStorageMode = normalizeDesktopAuthTokenStorageMode(storageMode)

  function getTokenFilePath() {
    return path.join(app.getPath("userData"), DESKTOP_AUTH_TOKEN_FILE)
  }

  function readPersistedToken() {
    if (!persistTokens || resolvedStorageMode === "memory") {
      return null
    }

    try {
      const tokenFile = fs.readFileSync(getTokenFilePath())

      if (resolvedStorageMode === "safe") {
        if (
          !canUseSafeStorage(safeStorage, persistTokens, resolvedStorageMode)
        ) {
          return null
        }

        return normalizeDesktopAuthToken(safeStorage.decryptString(tokenFile))
      }

      const parsed = JSON.parse(tokenFile.toString("utf8"))

      return normalizeDesktopAuthToken(parsed?.token)
    } catch {
      return null
    }
  }

  function persistToken(token) {
    if (!persistTokens || resolvedStorageMode === "memory") {
      return false
    }

    try {
      fs.mkdirSync(path.dirname(getTokenFilePath()), { recursive: true })

      if (resolvedStorageMode === "safe") {
        if (
          !canUseSafeStorage(safeStorage, persistTokens, resolvedStorageMode)
        ) {
          return false
        }

        fs.writeFileSync(getTokenFilePath(), safeStorage.encryptString(token))
      } else {
        fs.writeFileSync(
          getTokenFilePath(),
          `${JSON.stringify({ token, version: 1 })}\n`,
          {
            mode: 0o600,
          }
        )
      }

      return true
    } catch {
      return false
    }
  }

  function clearPersistedToken() {
    try {
      fs.rmSync(getTokenFilePath(), { force: true })
    } catch {}
  }

  return {
    clearToken() {
      desktopAuthToken = null
      clearPersistedToken()

      return true
    },
    getToken() {
      return desktopAuthToken
    },
    loadToken() {
      desktopAuthToken = readPersistedToken()

      return desktopAuthToken
    },
    setToken(value) {
      const token = normalizeDesktopAuthToken(value)

      if (!token) {
        return false
      }

      desktopAuthToken = token
      persistToken(token)

      return true
    },
  }
}

module.exports = {
  DESKTOP_AUTH_TOKEN_FILE,
  createDesktopAuthStore,
  normalizeDesktopAuthToken,
  normalizeDesktopAuthTokenStorageMode,
  resolveDesktopAuthTokenStorageMode,
  shouldPersistDesktopAuthTokens,
}
