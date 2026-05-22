import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { findBuiltApp } from "./shared/electron-package.mjs"
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
const configuredMacIdentity = process.env.DESKTOP_MAC_IDENTITY?.trim()
const macIdentity = isReleaseBuild
  ? configuredMacIdentity || undefined
  : configuredMacIdentity || "-"
const desktopDeepLinkScheme = resolveDeepLinkScheme(process.env)
const desktopRendererMode =
  process.env.DESKTOP_RENDERER_MODE === "packaged" ? "packaged" : "hosted"
const desktopRendererDir = path.join(repoRoot, "dist", "desktop-renderer")
const desktopRendererEntryPath = path.join(desktopRendererDir, "index.html")

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

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited with signal ${signal}`))
        return
      }

      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`))
        return
      }

      resolve()
    })
  })
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

async function main() {
  const desktopPackageEnv = await loadDesktopPackageEnv()

  if (isReleaseBuild && !hasNotarizationCredentials(process.env)) {
    throw new Error(
      "DESKTOP_RELEASE=1 requires Apple notarization credentials. Set APPLE_API_KEY, APPLE_API_KEY_ID, and APPLE_API_ISSUER; or APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID; or APPLE_KEYCHAIN and APPLE_KEYCHAIN_PROFILE."
    )
  }

  const rootPackageJsonPath = path.join(repoRoot, "package.json")
  const rootPackageJson = JSON.parse(
    await fs.readFile(rootPackageJsonPath, "utf8")
  )
  const stageRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "recipe-room-desktop-")
  )
  const stageDir = path.join(stageRoot, "app")
  const stageOutputDir = path.join(stageRoot, "out")
  const desktopRuntimeConfig = {
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

  try {
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

    if (desktopRendererMode === "packaged") {
      await fs.access(desktopRendererEntryPath).catch(() => {
        throw new Error(
          `DESKTOP_RENDERER_MODE=packaged requires ${desktopRendererEntryPath}. Build the desktop renderer assets first.`
        )
      })
      await fs.cp(desktopRendererDir, path.join(stageDir, "desktop-renderer"), {
        recursive: true,
      })
    }

    const stagePackageJson = {
      name: "recipe-room-desktop",
      version: rootPackageJson.version,
      description: "Recipe Room desktop shell",
      author: "Recipe Room",
      main: "electron/main.cjs",
      type: "module",
      build: {
        appId: "io.reciperoom.desktop",
        productName: "Recipe Room",
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
        extraMetadata: {
          main: "electron/main.cjs",
        },
        mac: {
          target: ["dir"],
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
      },
    }

    await fs.writeFile(
      path.join(stageDir, "package.json"),
      `${JSON.stringify(stagePackageJson, null, 2)}\n`
    )
    await fs.writeFile(
      path.join(stageDir, "desktop-runtime.json"),
      `${JSON.stringify(desktopRuntimeConfig, null, 2)}\n`
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
        "dir",
        "--publish",
        "never",
      ],
      { cwd: repoRoot }
    )

    const { appPath } = await findBuiltApp(stageOutputDir)
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

    const archivePath = path.join(outputDir, "Recipe Room-mac-arm64.zip")
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

    console.log(`Built desktop app: ${outputAppPath}`)
    if (shouldInstallBuiltApp) {
      console.log(`Installed desktop app: ${installedAppPath}`)
    }
    console.log(`Built desktop archive: ${archivePath}`)
  } finally {
    await fs.rm(stageRoot, { force: true, recursive: true })
  }
}

await main()
