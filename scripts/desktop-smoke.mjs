import { spawn } from "node:child_process"
import { createServer } from "node:net"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const standaloneServerPath = path.join(
  repoRoot,
  ".next",
  "standalone",
  "server.js"
)
const electronMainPath = path.join(repoRoot, "electron", "main.cjs")
const electronPreloadPath = path.join(repoRoot, "electron", "preload.cjs")
const appIconPath = path.join(repoRoot, "app-icon.png")

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

async function assertExists(targetPath, label) {
  try {
    await fs.access(targetPath)
  } catch {
    throw new Error(`${label} not found at ${targetPath}`)
  }
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

async function waitForUrl(url, timeoutMs = 30000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
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

async function main() {
  await Promise.all([
    assertExists(standaloneServerPath, "Next standalone server"),
    assertExists(electronMainPath, "Electron main entry"),
    assertExists(electronPreloadPath, "Electron preload entry"),
    assertExists(appIconPath, "Desktop app icon"),
  ])

  const port = await findAvailablePort()
  const smokeUrl = `http://localhost:${port}`
  const smokeProbeUrl = new URL("/icon.svg", smokeUrl).toString()
  const serverProcess = spawn(process.execPath, [standaloneServerPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOSTNAME: "localhost",
      NODE_ENV: "production",
      PORT: String(port),
      APP_URL: process.env.APP_URL ?? smokeUrl,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? smokeUrl,
      CONVEX_URL:
        process.env.CONVEX_URL ?? "https://desktop-smoke.example.convex.cloud",
      NEXT_PUBLIC_CONVEX_URL:
        process.env.NEXT_PUBLIC_CONVEX_URL ??
        "https://desktop-smoke.example.convex.cloud",
      WORKOS_API_KEY: process.env.WORKOS_API_KEY ?? "sk_desktop_smoke",
      WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID ?? "client_desktop_smoke",
    },
    stdio: "inherit",
    windowsHide: true,
  })

  try {
    await waitForUrl(smokeProbeUrl, 30000)
  } finally {
    if (serverProcess.exitCode === null && !serverProcess.killed) {
      serverProcess.kill()
    }
  }

  console.log("Desktop packaged-runtime smoke passed")
}

await main()
