import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { afterEach, describe, expect, it } from "vitest"

describe("electron runtime config", () => {
  const tempDirectories: string[] = []

  async function createRuntimeConfigFile(config: Record<string, unknown>) {
    const appPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "electron-runtime-config-")
    )
    tempDirectories.push(appPath)

    await fs.writeFile(
      path.join(appPath, "desktop-runtime.json"),
      `${JSON.stringify(config)}\n`
    )

    return appPath
  }

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map((directory) =>
        fs.rm(directory, { force: true, recursive: true })
      )
    )
  })

  it("uses only the explicit Electron renderer override from env", async () => {
    const { resolveConfiguredRendererUrl } = await import(
      "@/electron/renderer-url-config.cjs"
    )

    expect(
      resolveConfiguredRendererUrl({
        NODE_ENV: "test",
        APP_URL: "https://app.example.com/",
        NEXT_PUBLIC_APP_URL: "https://public.example.com",
        TEAMS_URL: "https://teams.example.com",
        ELECTRON_RENDERER_URL: "https://desktop.example.com",
      })
    ).toBe("https://desktop.example.com")

    expect(
      resolveConfiguredRendererUrl({
        NODE_ENV: "test",
        APP_URL: "https://app.example.com/",
        NEXT_PUBLIC_APP_URL: "https://public.example.com",
        TEAMS_URL: "https://teams.example.com",
      })
    ).toBeNull()
  })

  it("uses the configured desktop API base URL from env", async () => {
    const { resolveDesktopApiBaseUrl } = await import(
      "@/electron/runtime-config.cjs"
    )
    const appPath = await createRuntimeConfigFile({
      apiBaseUrl: "https://packaged.example.com",
    })

    expect(
      resolveDesktopApiBaseUrl(appPath, {
        NODE_ENV: "test",
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/",
      })
    ).toBe("https://api.example.com")
  })

  it("uses the packaged desktop API base URL when env values are absent", async () => {
    const { resolveDesktopApiBaseUrl } = await import(
      "@/electron/runtime-config.cjs"
    )
    const appPath = await createRuntimeConfigFile({
      apiBaseUrl: "https://packaged.example.com/",
    })

    expect(resolveDesktopApiBaseUrl(appPath, { NODE_ENV: "test" })).toBe(
      "https://packaged.example.com"
    )
  })

  it("uses the packaged runtime config when env values are absent", async () => {
    const { resolvePackagedRendererUrl } = await import(
      "@/electron/runtime-config.cjs"
    )
    const appPath = await createRuntimeConfigFile({
      rendererUrl: "https://desktop.example.com/",
    })

    expect(resolvePackagedRendererUrl(appPath, { NODE_ENV: "test" })).toBe(
      "https://desktop.example.com"
    )
  })

  it("uses local packaged renderer assets when configured", async () => {
    const {
      DESKTOP_RENDERER_DIR,
      DESKTOP_RENDERER_ENTRY_FILE,
      resolvePackagedRendererUrl,
    } = await import("@/electron/runtime-config.cjs")
    const appPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "electron-runtime-config-")
    )
    const rendererEntryPath = path.join(
      appPath,
      DESKTOP_RENDERER_DIR,
      DESKTOP_RENDERER_ENTRY_FILE
    )
    tempDirectories.push(appPath)

    await fs.mkdir(path.dirname(rendererEntryPath), { recursive: true })
    await fs.writeFile(rendererEntryPath, "<!doctype html>\n")
    await fs.writeFile(
      path.join(appPath, "desktop-runtime.json"),
      `${JSON.stringify({ rendererMode: "packaged" })}\n`
    )

    expect(resolvePackagedRendererUrl(appPath, { NODE_ENV: "test" })).toBe(
      pathToFileURL(rendererEntryPath).toString()
    )
  })

  it("fails clearly when packaged renderer mode is configured without assets", async () => {
    const { resolvePackagedRendererUrl } = await import(
      "@/electron/runtime-config.cjs"
    )
    const appPath = await createRuntimeConfigFile({
      rendererMode: "packaged",
    })

    expect(() =>
      resolvePackagedRendererUrl(appPath, { NODE_ENV: "test" })
    ).toThrow("Packaged desktop renderer entry not found")
  })

  it("falls back to the legacy renderer default when no config is available", async () => {
    const { DEFAULT_RENDERER_URL } = await import(
      "@/electron/renderer-url-config.cjs"
    )
    const { resolvePackagedRendererUrl } = await import(
      "@/electron/runtime-config.cjs"
    )
    const appPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "electron-runtime-config-")
    )
    tempDirectories.push(appPath)

    expect(resolvePackagedRendererUrl(appPath, { NODE_ENV: "test" })).toBe(
      DEFAULT_RENDERER_URL
    )
  })
})
