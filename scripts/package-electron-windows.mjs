import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { getCommandShimSpawnOptions } from "./shared/electron-package.mjs"
import { readDotenvFile } from "./shared/dotenv.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const { resolveDeepLinkScheme } = require("../electron/deep-links.cjs")
const {
  DEFAULT_RENDERER_URL,
  resolveConfiguredDesktopApiBaseUrl,
  resolveConfiguredRendererUrl,
} = require("../electron/renderer-url-config.cjs")
const {
  resolveGitHubUpdatePublishConfig,
} = require("../electron/desktop-updates.cjs")
const repoRoot = path.resolve(__dirname, "..")
const VERCEL_PRODUCTION_ENV_FILE = ".env.vercel.production.local"
const outputDir = path.join(repoRoot, "dist", "electron")
const shouldBuildReleaseArtifacts =
  process.env.DESKTOP_RELEASE_ARTIFACTS === "1" ||
  process.env.DESKTOP_RELEASE === "1"
const desktopDeepLinkScheme = resolveDeepLinkScheme(process.env)
const desktopRendererMode =
  process.env.DESKTOP_RENDERER_MODE === "packaged" ? "packaged" : "hosted"
const desktopRendererDir = path.join(repoRoot, "dist", "desktop-renderer")
const desktopRendererEntryPath = path.join(desktopRendererDir, "index.html")
const supportedWindowsArchitectures = new Set(["arm64", "ia32", "x64"])

function normalizeWindowsArchitecture(value) {
  const normalized = value?.trim().toLowerCase()

  if (normalized === "aarch64") {
    return "arm64"
  }

  if (normalized === "amd64" || normalized === "x86_64") {
    return "x64"
  }

  if (normalized === "i386" || normalized === "i686" || normalized === "x86") {
    return "ia32"
  }

  return supportedWindowsArchitectures.has(normalized) ? normalized : null
}

function parseWindowsBuildArchitectures() {
  const configuredArchitectures = process.env.DESKTOP_WINDOWS_ARCHES?.trim()
  const defaultArchitectures = shouldBuildReleaseArtifacts
    ? ["x64", "ia32", "arm64"]
    : [normalizeWindowsArchitecture(process.arch) ?? "x64"]
  const parsedArchitectures = configuredArchitectures
    ? configuredArchitectures
        .split(/[\s,]+/u)
        .map(normalizeWindowsArchitecture)
        .filter(Boolean)
    : defaultArchitectures

  return [...new Set(parsedArchitectures)]
}

const windowsBuildArchitectures = parseWindowsBuildArchitectures()

async function loadDesktopPackageEnv() {
  return {
    ...(await readDotenvFile(path.join(repoRoot, VERCEL_PRODUCTION_ENV_FILE))),
    ...process.env,
  }
}

function getCommandExitError(command, code, signal, stderr = "") {
  if (signal) {
    return new Error(`${command} exited with signal ${signal}`)
  }

  if (code !== 0) {
    return new Error(
      `${command} exited with code ${code}${stderr ? `: ${stderr}` : ""}`
    )
  }

  return null
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    })

    child.on("error", reject)
    child.on("exit", (code, signal) => {
      const error = getCommandExitError(command, code, signal)

      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    })
    const stdout = []
    const stderr = []

    child.stdout.on("data", (chunk) => {
      stdout.push(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr.push(chunk)
    })
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      const error = getCommandExitError(
        command,
        code,
        signal,
        Buffer.concat(stderr).toString("utf8")
      )

      if (error) {
        reject(error)
        return
      }

      resolve(Buffer.concat(stdout).toString("utf8"))
    })
  })
}

async function readGitRemoteOriginUrl() {
  try {
    const value = await runCapture(
      "git",
      ["config", "--get", "remote.origin.url"],
      {
        cwd: repoRoot,
      }
    )

    return value.trim() || null
  } catch {
    return null
  }
}

async function resolveDesktopUpdatePublishConfigForBuild() {
  const updateRepository =
    process.env.DESKTOP_UPDATE_REPOSITORY?.trim() ||
    process.env.GITHUB_REPOSITORY?.trim() ||
    (await readGitRemoteOriginUrl())

  return resolveGitHubUpdatePublishConfig({
    ...process.env,
    DESKTOP_UPDATE_REPOSITORY: updateRepository ?? "",
  })
}

function assertDesktopReleaseEnvironment(desktopUpdatePublishConfig) {
  if (shouldBuildReleaseArtifacts && !desktopUpdatePublishConfig) {
    throw new Error(
      "DESKTOP_RELEASE_ARTIFACTS=1 requires a GitHub update repository. Set DESKTOP_UPDATE_REPOSITORY=owner/repo or configure the git origin as a GitHub remote."
    )
  }
}

function createDesktopRuntimeConfig(desktopPackageEnv) {
  return {
    apiBaseUrl:
      resolveConfiguredDesktopApiBaseUrl(desktopPackageEnv) ??
      DEFAULT_RENDERER_URL,
    rendererMode: desktopRendererMode,
    ...(desktopRendererMode === "hosted"
      ? {
          rendererUrl:
            resolveConfiguredRendererUrl(desktopPackageEnv) ??
            DEFAULT_RENDERER_URL,
        }
      : {}),
  }
}

function createStagePackageJson(
  rootPackageJson,
  desktopUpdatePublishConfig,
  stageOutputDir
) {
  const releaseTarget = {
    arch: windowsBuildArchitectures,
    target: "nsis",
  }
  const localTarget = {
    arch: windowsBuildArchitectures,
    target: "dir",
  }

  return {
    name: "recipe-room-desktop",
    version: rootPackageJson.version,
    description: "Recipe Room desktop shell",
    author: "Recipe Room",
    main: "electron/main.cjs",
    type: "module",
    dependencies: {
      "electron-updater":
        rootPackageJson.dependencies["electron-updater"] ??
        rootPackageJson.devDependencies["electron-updater"],
    },
    build: {
      appId: "io.reciperoom.desktop",
      productName: "Recipe Room",
      artifactName: shouldBuildReleaseArtifacts
        ? "Recipe-Room-win-${arch}.${ext}"
        : "Recipe Room-${version}-win-${arch}.${ext}",
      electronVersion: rootPackageJson.devDependencies.electron.replace(
        /^\^/u,
        ""
      ),
      asar: true,
      afterPack: "electron/after-pack.cjs",
      directories: {
        output: stageOutputDir,
        buildResources: "electron",
      },
      files: [
        "desktop-runtime.json",
        "desktop-renderer/**/*",
        "electron/**/*",
        "app-icon.png",
        "package.json",
      ],
      protocols: [
        {
          name: "Recipe Room",
          schemes: [desktopDeepLinkScheme],
        },
      ],
      ...(desktopUpdatePublishConfig
        ? { publish: [desktopUpdatePublishConfig] }
        : {}),
      extraMetadata: {
        main: "electron/main.cjs",
      },
      win: {
        icon: "electron/app-icon.ico",
        target: shouldBuildReleaseArtifacts ? [releaseTarget] : [localTarget],
      },
      nsis: {
        allowToChangeInstallationDirectory: true,
        oneClick: false,
        perMachine: false,
      },
    },
  }
}

async function writeJsonFile(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function copyDesktopStageFiles(stageDir) {
  await fs.mkdir(stageDir, { recursive: true })
  await fs.cp(
    path.join(repoRoot, "electron"),
    path.join(stageDir, "electron"),
    {
      recursive: true,
    }
  )
  await fs.copyFile(
    path.join(repoRoot, "app-icon.png"),
    path.join(stageDir, "app-icon.png")
  )

  if (desktopRendererMode !== "packaged") {
    return
  }

  await fs.access(desktopRendererEntryPath).catch(() => {
    throw new Error(
      `DESKTOP_RENDERER_MODE=packaged requires ${desktopRendererEntryPath}. Build the desktop renderer assets first.`
    )
  })
  await fs.cp(desktopRendererDir, path.join(stageDir, "desktop-renderer"), {
    recursive: true,
  })
}

async function cleanWindowsReleaseArtifacts(targetDir) {
  await fs.mkdir(targetDir, { recursive: true })

  const entries = await fs.readdir(targetDir, { withFileTypes: true })

  await Promise.all(
    entries
      .filter((entry) => {
        if (!entry.isFile()) {
          return false
        }

        return (
          entry.name === "latest.yml" ||
          entry.name.startsWith("Recipe-Room-win-")
        )
      })
      .map((entry) =>
        fs.rm(path.join(targetDir, entry.name), {
          force: true,
        })
      )
  )
}

async function cleanWindowsLocalArtifacts(targetDir) {
  await fs.mkdir(targetDir, { recursive: true })

  const entries = await fs.readdir(targetDir, { withFileTypes: true })

  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith("win") &&
          entry.name.endsWith("unpacked")
      )
      .map((entry) =>
        fs.rm(path.join(targetDir, entry.name), {
          force: true,
          recursive: true,
        })
      )
  )
}

async function copyReleaseArtifacts(
  sourceDir,
  targetDir,
  requiredArchitectures
) {
  const copiedPaths = []
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  await cleanWindowsReleaseArtifacts(targetDir)

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    const sourcePath = path.join(sourceDir, entry.name)
    const extension = path.extname(entry.name)
    const isWindowsUpdateManifest = entry.name === "latest.yml"

    if (
      ![".blockmap", ".exe", ".yml"].includes(extension) ||
      (extension === ".yml" && !isWindowsUpdateManifest)
    ) {
      continue
    }

    const targetPath = path.join(targetDir, entry.name)
    await fs.copyFile(sourcePath, targetPath)
    copiedPaths.push(targetPath)
  }

  const copiedNames = new Set(
    copiedPaths.map((filePath) => path.basename(filePath))
  )

  for (const architecture of requiredArchitectures) {
    const expectedName = `Recipe-Room-win-${architecture}.exe`

    if (!copiedNames.has(expectedName)) {
      throw new Error(`Release artifact build did not produce ${expectedName}.`)
    }
  }

  if (!copiedNames.has("latest.yml")) {
    throw new Error(
      "Release artifact build must produce latest.yml for Windows GitHub updates."
    )
  }

  return copiedPaths
}

async function copyLocalArtifacts(sourceDir, targetDir) {
  const copiedPaths = []
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  await cleanWindowsLocalArtifacts(targetDir)

  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      !entry.name.startsWith("win") ||
      !entry.name.endsWith("unpacked")
    ) {
      continue
    }

    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    await fs.cp(sourcePath, targetPath, { recursive: true })
    copiedPaths.push(targetPath)
  }

  if (copiedPaths.length === 0) {
    throw new Error("Packaged Windows app directory was not created.")
  }

  return copiedPaths
}

async function main() {
  if (windowsBuildArchitectures.length === 0) {
    throw new Error(
      "No Windows architectures selected. Set DESKTOP_WINDOWS_ARCHES to x64, ia32, arm64, or a comma-separated combination."
    )
  }

  const desktopPackageEnv = await loadDesktopPackageEnv()
  const desktopUpdatePublishConfig =
    await resolveDesktopUpdatePublishConfigForBuild()

  assertDesktopReleaseEnvironment(desktopUpdatePublishConfig)

  const rootPackageJsonPath = path.join(repoRoot, "package.json")
  const rootPackageJson = JSON.parse(
    await fs.readFile(rootPackageJsonPath, "utf8")
  )
  const stageRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "recipe-room-desktop-windows-")
  )
  const stageDir = path.join(stageRoot, "app")
  const stageOutputDir = path.join(stageRoot, "out")

  try {
    await copyDesktopStageFiles(stageDir)
    await writeJsonFile(
      path.join(stageDir, "package.json"),
      createStagePackageJson(
        rootPackageJson,
        desktopUpdatePublishConfig,
        stageOutputDir
      )
    )
    await writeJsonFile(
      path.join(stageDir, "desktop-runtime.json"),
      createDesktopRuntimeConfig(desktopPackageEnv)
    )

    await run(
      "pnpm",
      [
        "exec",
        "electron-builder",
        "--projectDir",
        stageDir,
        "--win",
        ...windowsBuildArchitectures.map((architecture) => `--${architecture}`),
        "--publish",
        "never",
      ],
      {
        cwd: repoRoot,
        ...getCommandShimSpawnOptions(),
      }
    )

    const artifactPaths = shouldBuildReleaseArtifacts
      ? await copyReleaseArtifacts(
          stageOutputDir,
          outputDir,
          windowsBuildArchitectures
        )
      : await copyLocalArtifacts(stageOutputDir, outputDir)

    for (const artifactPath of artifactPaths) {
      console.log(`Built desktop artifact: ${artifactPath}`)
    }
  } finally {
    await fs.rm(stageRoot, { force: true, recursive: true })
  }
}

await main()
