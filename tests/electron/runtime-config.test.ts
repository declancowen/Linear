import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

describe("electron runtime config", () => {
  const tempDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map((directory) =>
        fs.rm(directory, { force: true, recursive: true })
      )
    )
  })

  it("prefers app url env values over the legacy renderer override", async () => {
    const { resolveConfiguredRendererUrl } = await import(
      "@/electron/runtime-config.cjs"
    )

    expect(
      resolveConfiguredRendererUrl({
        NODE_ENV: "test",
        APP_URL: "https://app.example.com/",
        NEXT_PUBLIC_APP_URL: "https://public.example.com",
        TEAMS_URL: "https://teams.example.com",
        ELECTRON_RENDERER_URL: "https://legacy.example.com",
      })
    ).toBe("https://app.example.com")
  })

  it("uses the packaged runtime config when env values are absent", async () => {
    const { resolvePackagedRendererUrl } = await import(
      "@/electron/runtime-config.cjs"
    )
    const appPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "electron-runtime-config-")
    )
    tempDirectories.push(appPath)

    await fs.writeFile(
      path.join(appPath, "desktop-runtime.json"),
      `${JSON.stringify({ rendererUrl: "https://desktop.example.com/" })}\n`
    )

    expect(resolvePackagedRendererUrl(appPath, { NODE_ENV: "test" })).toBe(
      "https://desktop.example.com"
    )
  })

  it("falls back to the legacy renderer default when no config is available", async () => {
    const { DEFAULT_RENDERER_URL, resolvePackagedRendererUrl } = await import(
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
