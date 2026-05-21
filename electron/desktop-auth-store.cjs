/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")

const DESKTOP_AUTH_TOKEN_FILE = "desktop-auth-token.v1"

function normalizeDesktopAuthToken(value) {
  if (typeof value !== "string") {
    return null
  }

  const token = value.trim()

  return token.length > 0 && token.length <= 8192 ? token : null
}

function canUseSafeStorage(safeStorage, persistTokens) {
  if (!persistTokens) {
    return false
  }

  try {
    return safeStorage?.isEncryptionAvailable?.() === true
  } catch {
    return false
  }
}

function createDesktopAuthStore({ app, persistTokens = true, safeStorage }) {
  let desktopAuthToken = null

  function getTokenFilePath() {
    return path.join(app.getPath("userData"), DESKTOP_AUTH_TOKEN_FILE)
  }

  function readPersistedToken() {
    if (!canUseSafeStorage(safeStorage, persistTokens)) {
      return null
    }

    try {
      const encryptedToken = fs.readFileSync(getTokenFilePath())
      return normalizeDesktopAuthToken(
        safeStorage.decryptString(encryptedToken)
      )
    } catch {
      return null
    }
  }

  function persistToken(token) {
    if (!canUseSafeStorage(safeStorage, persistTokens)) {
      return false
    }

    try {
      fs.mkdirSync(path.dirname(getTokenFilePath()), { recursive: true })
      fs.writeFileSync(getTokenFilePath(), safeStorage.encryptString(token))
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
}
