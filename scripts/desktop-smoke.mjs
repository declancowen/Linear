import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const { findAvailablePort, waitForUrl } = require("../electron/local-server.cjs")

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

async function assertExists(targetPath, label) {
  try {
    await fs.access(targetPath)
  } catch {
    throw new Error(`${label} not found at ${targetPath}`)
  }
}

async function assertDesktopSmokeInputs() {
  await Promise.all([
    assertExists(standaloneServerPath, "Next standalone server"),
    assertExists(electronMainPath, "Electron main entry"),
    assertExists(electronPreloadPath, "Electron preload entry"),
    assertExists(appIconPath, "Desktop app icon"),
  ])
}

function createDesktopSmokeEnv(port, smokeUrl) {
  const fallbackConvexUrl = "https://desktop-smoke.example.convex.cloud"

  return {
    ...process.env,
    HOSTNAME: "localhost",
    NODE_ENV: "production",
    PORT: String(port),
    APP_URL: getDesktopSmokeEnvValue("APP_URL", smokeUrl),
    NEXT_PUBLIC_APP_URL: getDesktopSmokeEnvValue("NEXT_PUBLIC_APP_URL", smokeUrl),
    CONVEX_URL: getDesktopSmokeEnvValue("CONVEX_URL", fallbackConvexUrl),
    NEXT_PUBLIC_CONVEX_URL: getDesktopSmokeEnvValue(
      "NEXT_PUBLIC_CONVEX_URL",
      fallbackConvexUrl
    ),
    WORKOS_API_KEY: getDesktopSmokeEnvValue(
      "WORKOS_API_KEY",
      "sk_desktop_smoke"
    ),
    WORKOS_CLIENT_ID: getDesktopSmokeEnvValue(
      "WORKOS_CLIENT_ID",
      "client_desktop_smoke"
    ),
  }
}

function getDesktopSmokeEnvValue(name, fallbackValue) {
  return process.env[name] ?? fallbackValue
}

function startDesktopSmokeServer(port, smokeUrl) {
  return spawn(process.execPath, [standaloneServerPath], {
    cwd: repoRoot,
    env: createDesktopSmokeEnv(port, smokeUrl),
    stdio: "inherit",
    windowsHide: true,
  })
}

function stopDesktopSmokeServer(serverProcess) {
  if (serverProcess.exitCode === null && !serverProcess.killed) {
    serverProcess.kill()
  }
}

async function main() {
  await assertDesktopSmokeInputs()

  const port = await findAvailablePort()
  const smokeUrl = `http://localhost:${port}`
  const smokeProbeUrl = new URL("/icon.svg", smokeUrl).toString()
  const serverProcess = startDesktopSmokeServer(port, smokeUrl)

  try {
    await waitForUrl(smokeProbeUrl, 30000)
  } finally {
    stopDesktopSmokeServer(serverProcess)
  }

  console.log("Desktop packaged-runtime smoke passed")
}

await main()
