import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { findBuiltApp } from "./shared/electron-package.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const { DEFAULT_RENDERER_URL, resolveConfiguredRendererUrl } = require(
  "../electron/renderer-url-config.cjs"
)
const repoRoot = path.resolve(__dirname, "..")
const outputDir = path.join(repoRoot, "dist", "electron")
const installDir = path.join(os.homedir(), "Applications")
const installedAppPath = path.join(installDir, "Recipe Room.app")

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

async function main() {
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
    rendererUrl:
      resolveConfiguredRendererUrl(process.env) ?? DEFAULT_RENDERER_URL,
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
        directories: {
          output: stageOutputDir,
          buildResources: "electron",
        },
        files: [
          "desktop-runtime.json",
          "electron/**/*",
          "app-icon.png",
          "package.json",
        ],
        extraMetadata: {
          main: "electron/main.cjs",
        },
        mac: {
          target: ["dir"],
          icon: "electron/app-icon.icns",
          category: "public.app-category.productivity",
          identity: "-",
          hardenedRuntime: false,
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
    await fs.mkdir(installDir, { recursive: true })

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
    await fs.rm(installedAppPath, { force: true, recursive: true })
    await run(
      "ditto",
      ["--noextattr", "--noqtn", appPath, installedAppPath],
      { cwd: repoRoot }
    )

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
        installedAppPath,
        archivePath,
      ],
      {
        cwd: repoRoot,
      }
    )

    console.log(`Built desktop app: ${installedAppPath}`)
    console.log(`Built desktop archive: ${archivePath}`)
  } finally {
    await fs.rm(stageRoot, { force: true, recursive: true })
  }
}

await main()
