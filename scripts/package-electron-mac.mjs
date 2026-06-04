import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { findBuiltApp } from "./shared/electron-package.mjs"
import {
  createCommonStagePackageJson,
  copyDesktopReleaseArtifacts,
  getCommandShimSpawnOptions,
  normalizeDesktopArchitectureAlias,
  outputDir,
  parseDesktopBuildArchitectures,
  repoRoot,
  run,
  runDesktopPackageBuild,
  runForExitCode,
  shouldBuildReleaseArtifacts,
} from "./shared/electron-desktop-build.mjs"

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
const supportedMacArchitectures = new Set(["arm64", "x64"])

function normalizeMacArchitecture(value) {
  const normalized = normalizeDesktopArchitectureAlias(value)

  return supportedMacArchitectures.has(normalized) ? normalized : null
}

const macBuildArchitectures = parseDesktopBuildArchitectures({
  defaultArchitectures: shouldBuildReleaseArtifacts
    ? ["arm64", "x64"]
    : [normalizeMacArchitecture(process.arch) ?? "arm64"],
  envName: "DESKTOP_MAC_ARCHES",
  normalizeArchitecture: normalizeMacArchitecture,
})
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

async function copyReleaseArtifacts(
  sourceDir,
  targetDir,
  requiredArchitectures
) {
  const releaseExtensions = new Set([".blockmap", ".dmg", ".yml", ".zip"])
  const copiedPaths = await copyDesktopReleaseArtifacts({
    sourceDir,
    targetDir,
    include: (fileName) => {
      const extension = path.extname(fileName)
      const isMacUpdateManifest = fileName === "latest-mac.yml"

      return (
        releaseExtensions.has(extension) &&
        (extension !== ".yml" || isMacUpdateManifest)
      )
    },
    onAfterCopy: stripMacFileExtendedAttributes,
  })

  const copiedNames = new Set(
    copiedPaths.map((filePath) => path.basename(filePath))
  )

  if (
    !copiedPaths.some((filePath) => filePath.endsWith(".dmg")) ||
    !copiedPaths.some((filePath) => filePath.endsWith(".zip")) ||
    !copiedNames.has("latest-mac.yml")
  ) {
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

function createStagePackageJson({
  desktopUpdatePublishConfig,
  rootPackageJson,
  stageOutputDir,
}) {
  return createCommonStagePackageJson({
    artifactName: shouldBuildReleaseArtifacts
      ? "Recipe-Room-mac-${arch}.${ext}"
      : "Recipe Room-${version}-${arch}.${ext}",
    desktopUpdatePublishConfig,
    rootPackageJson,
    stageOutputDir,
    platformBuild: {
      forceCodeSigning: shouldForceCodeSigning,
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
  })
}

async function buildMacPackage({ stageDir, stageOutputDir }) {
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
    await run("ditto", ["--noextattr", "--noqtn", appPath, installedAppPath], {
      cwd: repoRoot,
    })
    await stripMacExtendedAttributes(installedAppPath)
  }

  const releaseArtifactPaths = shouldBuildReleaseArtifacts
    ? await copyReleaseArtifacts(stageOutputDir, outputDir, macBuildArchitectures)
    : await createLocalArchive(appPath)

  console.log(`Built desktop app: ${outputAppPath}`)
  if (shouldInstallBuiltApp) {
    console.log(`Installed desktop app: ${installedAppPath}`)
  }
  for (const artifactPath of releaseArtifactPaths) {
    console.log(`Built desktop artifact: ${artifactPath}`)
  }
}

async function createLocalArchive(appPath) {
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

  return [archivePath]
}

async function main() {
  if (macBuildArchitectures.length === 0) {
    throw new Error(
      "No macOS architectures selected. Set DESKTOP_MAC_ARCHES to arm64, x64, or both."
    )
  }

  await runDesktopPackageBuild({
    createStagePackageJson,
    onBeforeStage: assertDesktopReleaseEnvironment,
    onBuild: buildMacPackage,
    tempPrefix: "recipe-room-desktop-",
  })
}

await main()
