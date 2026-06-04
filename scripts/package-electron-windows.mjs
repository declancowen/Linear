import fs from "node:fs/promises"
import path from "node:path"

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
  shouldBuildReleaseArtifacts,
} from "./shared/electron-desktop-build.mjs"

const supportedWindowsArchitectures = new Set(["arm64", "ia32", "x64"])

function normalizeWindowsArchitecture(value) {
  const normalized = normalizeDesktopArchitectureAlias(value)

  return supportedWindowsArchitectures.has(normalized) ? normalized : null
}

const windowsBuildArchitectures = parseDesktopBuildArchitectures({
  defaultArchitectures: shouldBuildReleaseArtifacts
    ? ["x64", "ia32", "arm64"]
    : [normalizeWindowsArchitecture(process.arch) ?? "x64"],
  envName: "DESKTOP_WINDOWS_ARCHES",
  normalizeArchitecture: normalizeWindowsArchitecture,
})

function assertDesktopReleaseEnvironment(desktopUpdatePublishConfig) {
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
  const releaseTarget = {
    arch: windowsBuildArchitectures,
    target: "nsis",
  }
  const localTarget = {
    arch: windowsBuildArchitectures,
    target: "dir",
  }

  return createCommonStagePackageJson({
    artifactName: shouldBuildReleaseArtifacts
      ? "Recipe-Room-win-${arch}.${ext}"
      : "Recipe Room-${version}-win-${arch}.${ext}",
    desktopUpdatePublishConfig,
    rootPackageJson,
    stageOutputDir,
    platformBuild: {
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
  await cleanWindowsReleaseArtifacts(targetDir)
  const copiedPaths = await copyDesktopReleaseArtifacts({
    sourceDir,
    targetDir,
    include: (fileName) => {
      const extension = path.extname(fileName)
      const isWindowsUpdateManifest = fileName === "latest.yml"

      return (
        [".blockmap", ".exe", ".yml"].includes(extension) &&
        (extension !== ".yml" || isWindowsUpdateManifest)
      )
    },
  })

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

async function buildWindowsPackage({ stageDir, stageOutputDir }) {
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
}

async function main() {
  if (windowsBuildArchitectures.length === 0) {
    throw new Error(
      "No Windows architectures selected. Set DESKTOP_WINDOWS_ARCHES to x64, ia32, arm64, or a comma-separated combination."
    )
  }

  await runDesktopPackageBuild({
    createStagePackageJson,
    onBeforeStage: assertDesktopReleaseEnvironment,
    onBuild: buildWindowsPackage,
    tempPrefix: "recipe-room-desktop-windows-",
  })
}

await main()
