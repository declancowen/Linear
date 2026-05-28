import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const {
  DESKTOP_AUTH_TOKEN_FILE,
  createDesktopAuthStore,
  normalizeDesktopAuthToken,
  normalizeDesktopAuthTokenStorageMode,
  resolveDesktopAuthTokenStorageMode,
  shouldPersistDesktopAuthTokens,
} =
  require("../../electron/desktop-auth-store.cjs") as typeof import("../../electron/desktop-auth-store.cjs")

function createMockApp(userDataPath: string) {
  return {
    getPath: vi.fn((name: string) => {
      if (name !== "userData") {
        throw new Error(`Unexpected app path: ${name}`)
      }

      return userDataPath
    }),
  }
}

function createMockSafeStorage(available = true) {
  return {
    decryptString: vi.fn((value: Buffer) =>
      Buffer.from(value.toString(), "base64url").toString("utf8")
    ),
    encryptString: vi.fn((value: string) =>
      Buffer.from(Buffer.from(value, "utf8").toString("base64url"))
    ),
    isEncryptionAvailable: vi.fn(() => available),
  }
}

function expectMemoryOnlyToken(
  userDataPath: string,
  store: {
    getToken: () => string | null
    loadToken: () => string | null
    setToken: (value: string) => boolean
  }
) {
  expect(store.setToken("desktop_token")).toBe(true)
  expect(store.getToken()).toBe("desktop_token")
  expect(fs.existsSync(path.join(userDataPath, DESKTOP_AUTH_TOKEN_FILE))).toBe(
    false
  )
  expect(store.loadToken()).toBeNull()
}

function expectPersistedDesktopToken({
  encrypts,
  storageMode,
  userDataPath,
}: {
  encrypts: boolean
  storageMode?: "safe"
  userDataPath: string
}) {
  const safeStorage = createMockSafeStorage()
  const store = createDesktopAuthStore({
    app: createMockApp(userDataPath),
    safeStorage,
    ...(storageMode ? { storageMode } : {}),
  })
  const tokenFilePath = path.join(userDataPath, DESKTOP_AUTH_TOKEN_FILE)

  expect(store.setToken(" desktop_token ")).toBe(true)
  expect(store.getToken()).toBe("desktop_token")
  expect(fs.existsSync(tokenFilePath)).toBe(true)

  if (encrypts) {
    expect(safeStorage.encryptString).toHaveBeenCalledWith("desktop_token")
  } else {
    expect(safeStorage.encryptString).not.toHaveBeenCalled()
  }

  const reloadedStore = createDesktopAuthStore({
    app: createMockApp(userDataPath),
    safeStorage,
    ...(storageMode ? { storageMode } : {}),
  })

  expect(reloadedStore.loadToken()).toBe("desktop_token")
  expect(reloadedStore.getToken()).toBe("desktop_token")
}

describe("desktop auth store", () => {
  let userDataPath: string

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-auth-store-"))
  })

  afterEach(() => {
    fs.rmSync(userDataPath, { force: true, recursive: true })
  })

  it("normalizes desktop auth tokens before storing them", () => {
    expect(normalizeDesktopAuthToken(" token ")).toBe("token")
    expect(normalizeDesktopAuthToken("")).toBeNull()
    expect(normalizeDesktopAuthToken("x".repeat(8193))).toBeNull()
  })

  it("defaults desktop auth token storage to local files", () => {
    expect(normalizeDesktopAuthTokenStorageMode(undefined)).toBe("local")
    expect(normalizeDesktopAuthTokenStorageMode("safe")).toBe("safe")
    expect(normalizeDesktopAuthTokenStorageMode("memory")).toBe("memory")
    expect(normalizeDesktopAuthTokenStorageMode("unknown")).toBe("local")
    expect(resolveDesktopAuthTokenStorageMode({} as NodeJS.ProcessEnv)).toBe(
      "local"
    )
    expect(
      resolveDesktopAuthTokenStorageMode({
        DESKTOP_AUTH_TOKEN_STORAGE: "safe",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe("safe")
  })

  it("persists desktop auth tokens by default unless explicitly disabled", () => {
    expect(shouldPersistDesktopAuthTokens({} as NodeJS.ProcessEnv)).toBe(true)
    expect(
      shouldPersistDesktopAuthTokens({
        DESKTOP_ENABLE_AUTH_TOKEN_PERSISTENCE: "1",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(true)
    expect(
      shouldPersistDesktopAuthTokens({
        DESKTOP_ENABLE_AUTH_TOKEN_PERSISTENCE: "0",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(false)
  })

  it("persists accepted tokens to a local app file by default", () => {
    expectPersistedDesktopToken({
      encrypts: false,
      userDataPath,
    })
  })

  it("can persist accepted tokens through Electron safeStorage", () => {
    expectPersistedDesktopToken({
      encrypts: true,
      storageMode: "safe",
      userDataPath,
    })
  })

  it("falls back to memory-only storage when safe storage is requested but unavailable", () => {
    const safeStorage = createMockSafeStorage(false)
    const store = createDesktopAuthStore({
      app: createMockApp(userDataPath),
      safeStorage,
      storageMode: "safe",
    })

    expectMemoryOnlyToken(userDataPath, store)
  })

  it("can disable persisted token storage to avoid blocking startup", () => {
    const safeStorage = createMockSafeStorage()
    const store = createDesktopAuthStore({
      app: createMockApp(userDataPath),
      persistTokens: false,
      safeStorage,
    })

    expectMemoryOnlyToken(userDataPath, store)
    expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled()
  })

  it("clears in-memory and persisted desktop tokens", () => {
    const safeStorage = createMockSafeStorage()
    const store = createDesktopAuthStore({
      app: createMockApp(userDataPath),
      safeStorage,
    })
    const tokenFilePath = path.join(userDataPath, DESKTOP_AUTH_TOKEN_FILE)

    store.setToken("desktop_token")
    expect(fs.existsSync(tokenFilePath)).toBe(true)

    expect(store.clearToken()).toBe(true)
    expect(store.getToken()).toBeNull()
    expect(fs.existsSync(tokenFilePath)).toBe(false)
  })
})
