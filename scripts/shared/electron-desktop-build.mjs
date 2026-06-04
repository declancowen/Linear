import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getCommandShimSpawnOptions } from "./electron-package.mjs"
import { readDotenvFile } from "./dotenv.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const { resolveDeepLinkScheme } = require("../../electron/deep-links.cjs")
const {
  DEFAULT_RENDERER_URL,
  resolveConfiguredDesktopApiBaseUrl,
  resolveConfiguredRendererUrl,
} = require("../../electron/renderer-url-config.cjs")
const {
  resolveGitHubUpdatePublishConfig,
} = require("../../electron/desktop-updates.cjs")

const VERCEL_PRODUCTION_ENV_FILE = ".env.vercel.production.local"

export { getCommandShimSpawnOptions }

export const repoRoot = path.resolve(__dirname, "../..")
export const outputDir = path.join(repoRoot, "dist", "electron")
export const shouldBuildReleaseArtifacts =
  process.env.DESKTOP_RELEASE === "1" ||
  process.env.DESKTOP_RELEASE_ARTIFACTS === "1"
const desktopDeepLinkScheme = resolveDeepLinkScheme(process.env)
const desktopRendererMode =
  process.env.DESKTOP_RENDERER_MODE === "packaged" ? "packaged" : "hosted"

const desktopRendererDir = path.join(repoRoot, "dist", "desktop-renderer")
const desktopRendererEntryPath = path.join(desktopRendererDir, "index.html")

export function normalizeDesktopArchitectureAlias(value) {
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

  return normalized ?? null
}

export function parseDesktopBuildArchitectures({
  defaultArchitectures,
  envName,
  normalizeArchitecture,
}) {
  const configuredArchitectures = process.env[envName]?.trim()
  const parsedArchitectures = configuredArchitectures
    ? configuredArchitectures
        .split(/[\s,]+/u)
        .map(normalizeArchitecture)
        .filter(Boolean)
    : defaultArchitectures

  return [...new Set(parsedArchitectures)]
}

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

export function run(command, args, options = {}) {
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

export function runForExitCode(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      ...options,
    })

    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited with signal ${signal}`))
        return
      }

      resolve(code ?? 1)
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

export function createCommonStagePackageJson({
  artifactName,
  desktopUpdatePublishConfig,
  platformBuild,
  rootPackageJson,
  stageOutputDir,
}) {
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
      artifactName,
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
      ...platformBuild,
    },
  }
}

async function writeJsonFile(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export async function copyDesktopReleaseArtifacts({
  include,
  onAfterCopy,
  sourceDir,
  targetDir,
}) {
  const copiedPaths = []
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile() || !include(entry.name)) {
      continue
    }

    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    await fs.copyFile(sourcePath, targetPath)
    await onAfterCopy?.(targetPath)
    copiedPaths.push(targetPath)
  }

  return copiedPaths
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

export async function runDesktopPackageBuild({
  createStagePackageJson,
  onBeforeStage,
  onBuild,
  tempPrefix,
}) {
  const desktopPackageEnv = await loadDesktopPackageEnv()
  const desktopUpdatePublishConfig =
    await resolveDesktopUpdatePublishConfigForBuild()

  await onBeforeStage?.(desktopUpdatePublishConfig)

  const rootPackageJsonPath = path.join(repoRoot, "package.json")
  const rootPackageJson = JSON.parse(
    await fs.readFile(rootPackageJsonPath, "utf8")
  )
  const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), tempPrefix))
  const stageDir = path.join(stageRoot, "app")
  const stageOutputDir = path.join(stageRoot, "out")

  try {
    await copyDesktopStageFiles(stageDir)
    await writeJsonFile(
      path.join(stageDir, "package.json"),
      createStagePackageJson({
        desktopUpdatePublishConfig,
        rootPackageJson,
        stageOutputDir,
      })
    )
    await writeJsonFile(
      path.join(stageDir, "desktop-runtime.json"),
      createDesktopRuntimeConfig(desktopPackageEnv)
    )

    await onBuild({
      desktopPackageEnv,
      desktopUpdatePublishConfig,
      rootPackageJson,
      stageDir,
      stageOutputDir,
      stageRoot,
    })
  } finally {
    await fs.rm(stageRoot, { force: true, recursive: true })
  }
}
