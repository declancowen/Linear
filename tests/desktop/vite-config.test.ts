import { describe, expect, it } from "vitest"
import path from "node:path"
import { pathToFileURL } from "node:url"

async function loadDesktopViteConfig() {
  const viteConfig = await import(
    pathToFileURL(
      path.join(process.cwd(), "desktop", "renderer", "vite.config.mjs")
    ).href
  )

  return viteConfig as {
    getHostedAppOrigin: (
      env: Record<string, string | undefined>,
      mode: string
    ) => string
  }
}

describe("desktop renderer Vite config", () => {
  it("ignores local development app URLs for production packaged builds", async () => {
    const { getHostedAppOrigin } = await loadDesktopViteConfig()

    expect(
      getHostedAppOrigin(
        {
          APP_URL: "http://127.0.0.1:3000",
          NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
          TEAMS_URL: "http://127.0.0.1:3000",
        },
        "production"
      )
    ).toBe("https://teams.reciperoom.io")
  })

  it("keeps localhost origins available for development builds", async () => {
    const { getHostedAppOrigin } = await loadDesktopViteConfig()

    expect(
      getHostedAppOrigin(
        {
          NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
        },
        "development"
      )
    ).toBe("http://127.0.0.1:3000")
  })
})
