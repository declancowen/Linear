import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "../..")
const scriptPath = path.join(
  repoRoot,
  "scripts/publish-electron-github-release.mjs"
)

async function createReleaseAssetDir() {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "linear-electron-release-assets-")
  )

  await Promise.all([
    fs.writeFile(path.join(tempDir, "Recipe-Room-mac-arm64.dmg"), "dmg"),
    fs.writeFile(path.join(tempDir, "Recipe-Room-mac-arm64.zip"), "zip"),
    fs.writeFile(path.join(tempDir, "Recipe-Room-mac-x64.dmg"), "dmg"),
    fs.writeFile(path.join(tempDir, "Recipe-Room-mac-x64.zip"), "zip"),
    fs.writeFile(path.join(tempDir, "Recipe-Room-win-arm64.exe"), "exe"),
    fs.writeFile(path.join(tempDir, "Recipe-Room-win-ia32.exe"), "exe"),
    fs.writeFile(path.join(tempDir, "Recipe-Room-win-x64.exe"), "exe"),
    fs.writeFile(path.join(tempDir, "latest-mac.yml"), "manifest"),
    fs.writeFile(path.join(tempDir, "latest.yml"), "manifest"),
  ])

  return tempDir
}

async function runPublisher(
  args: string[],
  env?: Record<string, string | undefined>
) {
  const outputDir = await createReleaseAssetDir()

  try {
    return await execFileAsync(
      process.execPath,
      [
        scriptPath,
        "--dry-run",
        "--output-dir",
        outputDir,
        "--version",
        "1.2.3",
        ...args,
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          ...env,
        },
      }
    )
  } finally {
    await fs.rm(outputDir, { force: true, recursive: true })
  }
}

describe("publish Electron GitHub release script", () => {
  const originalDryRunExists = process.env.DESKTOP_RELEASE_DRY_RUN_EXISTS

  beforeEach(() => {
    delete process.env.DESKTOP_RELEASE_DRY_RUN_EXISTS
  })

  afterEach(() => {
    if (originalDryRunExists === undefined) {
      delete process.env.DESKTOP_RELEASE_DRY_RUN_EXISTS
    } else {
      process.env.DESKTOP_RELEASE_DRY_RUN_EXISTS = originalDryRunExists
    }
  })

  it("marks stable releases as GitHub latest", async () => {
    const { stdout } = await runPublisher([])

    expect(stdout).toContain('"release" "create"')
    expect(stdout).toContain('"--latest"')
    expect(stdout).not.toContain('"--latest=false"')
  })

  it("does not promote prerelease or draft releases to latest", async () => {
    const prerelease = await runPublisher(["--prerelease"])
    const draft = await runPublisher(["--draft"])

    expect(prerelease.stdout).toContain('"--prerelease"')
    expect(prerelease.stdout).toContain('"--latest=false"')
    expect(prerelease.stdout).not.toContain('"--latest" "--prerelease"')
    expect(draft.stdout).toContain('"--draft"')
    expect(draft.stdout).toContain('"--latest=false"')
  })

  it("preserves non-latest state when updating existing prereleases", async () => {
    const { stdout } = await runPublisher(["--prerelease"], {
      DESKTOP_RELEASE_DRY_RUN_EXISTS: "1",
    })

    expect(stdout).toContain('"release" "upload"')
    expect(stdout).toContain('"release" "edit"')
    expect(stdout).toContain('"--draft=false"')
    expect(stdout).toContain('"--prerelease"')
    expect(stdout).toContain('"--latest=false"')
  })

  it("clears draft and prerelease state when updating existing stable releases", async () => {
    const { stdout } = await runPublisher([], {
      DESKTOP_RELEASE_DRY_RUN_EXISTS: "1",
    })

    expect(stdout).toContain('"release" "edit"')
    expect(stdout).toContain('"--draft=false"')
    expect(stdout).toContain('"--prerelease=false"')
    expect(stdout).toContain('"--latest"')
  })
})
