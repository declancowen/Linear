import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  findBuiltApp,
  getCommandShimSpawnOptions,
} from "./shared/electron-package.mjs"
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
const outputAppPath = path.join(outputDir, "Recipe Room.app")
const installDir = path.join(os.homedir(), "Applications")
const installedAppPath = path.join(installDir, "Recipe Room.app")
const shouldInstallBuiltApp = process.env.DESKTOP_INSTALL === "1"
const isReleaseBuild = process.env.DESKTOP_RELEASE === "1"
const shouldForceCodeSigning =
  isReleaseBuild || process.env.DESKTOP_FORCE_CODE_SIGNING === "1"
const shouldUseHardenedRuntime =
  isReleaseBuild || process.env.DESKTOP_HARDENED_RUNTIME === "1"
const shouldNotarize = isReleaseBuild || process.env.DESKTOP_NOTARIZE === "1"
const shouldBuildReleaseArtifacts =
  isReleaseBuild || process.env.DESKTOP_RELEASE_ARTIFACTS === "1"
const configuredMacIdentity = process.env.DESKTOP_MAC_IDENTITY?.trim()
const macIdentity = isReleaseBuild
  ? configuredMacIdentity || undefined
  : configuredMacIdentity || "-"
const desktopDeepLinkScheme = resolveDeepLinkScheme(process.env)
const desktopRendererMode =
  process.env.DESKTOP_RENDERER_MODE === "packaged" ? "packaged" : "hosted"
const desktopRendererDir = path.join(repoRoot, "dist", "desktop-renderer")
const desktopRendererEntryPath = path.join(desktopRendererDir, "index.html")
const supportedMacArchitectures = new Set(["arm64", "x64"])

function normalizeMacArchitecture(value) {
  const normalized = value?.trim().toLowerCase()

  if (normalized === "aarch64") {
    return "arm64"
  }

  if (normalized === "amd64" || normalized === "x86_64") {
    return "x64"
  }

  return supportedMacArchitectures.has(normalized) ? normalized : null
}

function parseMacBuildArchitectures() {
  const configuredArchitectures = process.env.DESKTOP_MAC_ARCHES?.trim()
  const defaultArchitectures = shouldBuildReleaseArtifacts
    ? ["arm64", "x64"]
    : [normalizeMacArchitecture(process.arch) ?? "arm64"]
  const parsedArchitectures = configuredArchitectures
    ? configuredArchitectures
        .split(/[\s,]+/u)
        .map(normalizeMacArchitecture)
        .filter(Boolean)
    : defaultArchitectures

  return [...new Set(parsedArchitectures)]
}

const macBuildArchitectures = parseMacBuildArchitectures()
const primaryMacArchitecture =
  macBuildArchitectures.find(
    (architecture) => architecture === normalizeMacArchitecture(process.arch)
  ) ??
  macBuildArchitectures[0] ??
  "arm64"

function hasNotarizationCredentials(env) {
  return (
    (env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER) ||
    (env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID) ||
    (env.APPLE_KEYCHAIN && env.APPLE_KEYCHAIN_PROFILE)
  )
}

async function loadDesktopPackageEnv() {
  return {
    ...(await readDotenvFile(path.join(repoRoot, VERCEL_PRODUCTION_ENV_FILE))),
    ...process.env,
  }
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

function runForExitCode(command, args, options = {}) {
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

async function collectPaths(rootPath) {
  const paths = [rootPath]

  async function walk(currentPath) {
    let entries

    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name)
      paths.push(entryPath)

      if (entry.isDirectory()) {
        await walk(entryPath)
      }
    }
  }

  await walk(rootPath)

  return paths
}

async function removeMacExtendedAttribute(targetPath, attributeName) {
  const hasAttribute = await runForExitCode(
    "xattr",
    ["-p", attributeName, targetPath],
    { cwd: repoRoot }
  )

  if (hasAttribute === 0) {
    await run("xattr", ["-d", attributeName, targetPath], { cwd: repoRoot })
  }
}

async function stripMacExtendedAttributes(targetPath) {
  if (process.platform !== "darwin") {
    return
  }

  await run("xattr", ["-cr", targetPath], { cwd: repoRoot })

  const paths = await collectPaths(targetPath)
  const codeSigningBlockedAttributes = [
    "com.apple.FinderInfo",
    "com.apple.ResourceFork",
  ]

  for (const currentPath of paths) {
    for (const attributeName of codeSigningBlockedAttributes) {
      await removeMacExtendedAttribute(currentPath, attributeName)
    }
  }
}

async function stripMacFileExtendedAttributes(targetPath) {
  if (process.platform !== "darwin") {
    return
  }

  await run("xattr", ["-c", targetPath], { cwd: repoRoot })
  await removeMacExtendedAttribute(targetPath, "com.apple.FinderInfo")
  await removeMacExtendedAttribute(targetPath, "com.apple.ResourceFork")
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

async function copyReleaseArtifacts(
  sourceDir,
  targetDir,
  requiredArchitectures
) {
  const releaseExtensions = new Set([".blockmap", ".dmg", ".yml", ".zip"])
  const copiedPaths = []
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    const sourcePath = path.join(sourceDir, entry.name)
    const extension = path.extname(entry.name)
    const isMacUpdateManifest = entry.name === "latest-mac.yml"

    if (
      !releaseExtensions.has(extension) ||
      (extension === ".yml" && !isMacUpdateManifest)
    ) {
      continue
    }

    const targetPath = path.join(targetDir, entry.name)
    await fs.copyFile(sourcePath, targetPath)
    await stripMacFileExtendedAttributes(targetPath)
    copiedPaths.push(targetPath)
  }

  const hasDmg = copiedPaths.some((filePath) => filePath.endsWith(".dmg"))
  const hasZip = copiedPaths.some((filePath) => filePath.endsWith(".zip"))
  const hasMacUpdateManifest = copiedPaths.some(
    (filePath) => path.basename(filePath) === "latest-mac.yml"
  )
  const copiedNames = new Set(
    copiedPaths.map((filePath) => path.basename(filePath))
  )

  if (!hasDmg || !hasZip || !hasMacUpdateManifest) {
    throw new Error(
      "Release artifact build must produce a DMG, ZIP, and latest-mac.yml for GitHub updates."
    )
  }

  for (const architecture of requiredArchitectures) {
    for (const extension of ["dmg", "zip"]) {
      const expectedName = `Recipe-Room-mac-${architecture}.${extension}`

      if (!copiedNames.has(expectedName)) {
        throw new Error(
          `Release artifact build did not produce ${expectedName}.`
        )
      }
    }
  }

  return copiedPaths
}

function assertDesktopReleaseEnvironment(desktopUpdatePublishConfig) {
  if (isReleaseBuild && !hasNotarizationCredentials(process.env)) {
    throw new Error(
      "DESKTOP_RELEASE=1 requires Apple notarization credentials. Set APPLE_API_KEY, APPLE_API_KEY_ID, and APPLE_API_ISSUER; or APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID; or APPLE_KEYCHAIN and APPLE_KEYCHAIN_PROFILE."
    )
  }

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
        ? "Recipe-Room-mac-${arch}.${ext}"
        : "Recipe Room-${version}-${arch}.${ext}",
      electronVersion: rootPackageJson.devDependencies.electron.replace(
        /^\^/,
        ""
      ),
      asar: true,
      afterPack: "electron/after-pack.cjs",
      directories: {
        output: stageOutputDir,
        buildResources: "electron",
      },
      forceCodeSigning: shouldForceCodeSigning,
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
      mac: {
        target: shouldBuildReleaseArtifacts ? ["dmg", "zip"] : ["dir"],
        icon: "electron/app-icon.icns",
        category: "public.app-category.productivity",
        identity: macIdentity,
        hardenedRuntime: shouldUseHardenedRuntime,
        notarize: shouldNotarize,
        extendInfo: {
          NSAppTransportSecurity: {
            NSAllowsArbitraryLoads: false,
            NSAllowsLocalNetworking: true,
            NSExceptionDomains: {
              localhost: {
                NSExceptionAllowsInsecureHTTPLoads: true,
                NSIncludesSubdomains: true,
              },
              "127.0.0.1": {
                NSExceptionAllowsInsecureHTTPLoads: true,
                NSIncludesSubdomains: false,
              },
            },
          },
        },
      },
      dmg: {
        contents: [
          {
            x: 150,
            y: 220,
          },
          {
            path: "/Applications",
            type: "link",
            x: 410,
            y: 220,
          },
        ],
        title: "Recipe Room ${version}",
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

async function main() {
  if (macBuildArchitectures.length === 0) {
    throw new Error(
      "No macOS architectures selected. Set DESKTOP_MAC_ARCHES to arm64, x64, or both."
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
    path.join(os.tmpdir(), "recipe-room-desktop-")
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

    await fs.rm(outputDir, { force: true, recursive: true })
    await fs.mkdir(outputDir, { recursive: true })

    await run(
      "pnpm",
      [
        "exec",
        "electron-builder",
        "--projectDir",
        stageDir,
        "--mac",
        ...macBuildArchitectures.map((architecture) => `--${architecture}`),
        "--publish",
        "never",
      ],
      {
        cwd: repoRoot,
        ...getCommandShimSpawnOptions(),
      }
    )

    const { appPath } = await findBuiltApp(stageOutputDir, {
      arch: primaryMacArchitecture,
    })
    await stripMacExtendedAttributes(appPath)

    await fs.rm(outputAppPath, { force: true, recursive: true })
    await run("ditto", ["--noextattr", "--noqtn", appPath, outputAppPath], {
      cwd: repoRoot,
    })
    await stripMacExtendedAttributes(outputAppPath)

    if (shouldInstallBuiltApp) {
      await fs.mkdir(installDir, { recursive: true })
      await fs.rm(installedAppPath, { force: true, recursive: true })
      await run(
        "ditto",
        ["--noextattr", "--noqtn", appPath, installedAppPath],
        { cwd: repoRoot }
      )
      await stripMacExtendedAttributes(installedAppPath)
    }

    let releaseArtifactPaths = []

    if (shouldBuildReleaseArtifacts) {
      releaseArtifactPaths = await copyReleaseArtifacts(
        stageOutputDir,
        outputDir,
        macBuildArchitectures
      )
    } else {
      const archivePath = path.join(
        outputDir,
        `Recipe Room-mac-${primaryMacArchitecture}.zip`
      )
      await run(
        "ditto",
        [
          "-c",
          "-k",
          "--sequesterRsrc",
          "--keepParent",
          "--noextattr",
          "--noqtn",
          appPath,
          archivePath,
        ],
        {
          cwd: repoRoot,
        }
      )
      await stripMacFileExtendedAttributes(archivePath)
      releaseArtifactPaths = [archivePath]
    }

    console.log(`Built desktop app: ${outputAppPath}`)
    if (shouldInstallBuiltApp) {
      console.log(`Installed desktop app: ${installedAppPath}`)
    }
    for (const artifactPath of releaseArtifactPaths) {
      console.log(`Built desktop artifact: ${artifactPath}`)
    }
  } finally {
    await fs.rm(stageRoot, { force: true, recursive: true })
  }
}

await main()
