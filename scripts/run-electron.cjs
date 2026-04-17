/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("node:child_process")
const fs = require("node:fs/promises")
const path = require("node:path")

const electronBinary = require("electron")

const repoRoot = path.resolve(__dirname, "..")

async function ensureSymlink(targetPath, sourcePath) {
  try {
    const existingPath = await fs.readlink(targetPath)
    const resolvedExistingPath = path.resolve(
      path.dirname(targetPath),
      existingPath
    )

    if (resolvedExistingPath === sourcePath) {
      return
    }
  } catch {}

  await fs.rm(targetPath, {
    force: true,
    recursive: true,
  })

  await fs.symlink(
    sourcePath,
    targetPath,
    process.platform === "win32" ? "junction" : "dir"
  )
}

async function ensureStandaloneAssets() {
  const standaloneRoot = path.join(repoRoot, ".next", "standalone")
  const standaloneServerPath = path.join(standaloneRoot, "server.js")

  try {
    await fs.access(standaloneServerPath)
  } catch {
    return
  }

  await ensureSymlink(
    path.join(standaloneRoot, ".next", "static"),
    path.join(repoRoot, ".next", "static")
  )
  await ensureSymlink(
    path.join(standaloneRoot, "public"),
    path.join(repoRoot, "public")
  )
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    await ensureStandaloneAssets()
  }

  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  const child = spawn(electronBinary, ["."], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    windowsHide: true,
  })

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })

  for (const eventName of ["SIGINT", "SIGTERM"]) {
    process.on(eventName, () => {
      if (child.exitCode === null && !child.killed) {
        child.kill(eventName)
      }
    })
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
