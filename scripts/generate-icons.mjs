import { execFile as execFileCallback } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import pngToIco from "png-to-ico"
import sharp from "sharp"

const execFile = promisify(execFileCallback)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const sourceSvgPath = path.join(repoRoot, "app-icon.svg")
const sourceIconSize = 256
const maxRasterSize = 1024
const svgDensity = (72 * maxRasterSize) / sourceIconSize

const svgTargets = [
  path.join(repoRoot, "icon.svg"),
  path.join(repoRoot, "public", "app-icon.svg"),
  path.join(repoRoot, "public", "icon.svg"),
]

const appIconTargets = [
  path.join(repoRoot, "app-icon.png"),
  path.join(repoRoot, "public", "app-icon.png"),
]

const appleIconTargets = [
  path.join(repoRoot, "apple-icon.png"),
  path.join(repoRoot, "public", "apple-icon.png"),
]

const appIconIcoTargets = [
  path.join(repoRoot, "app-icon.ico"),
  path.join(repoRoot, "public", "app-icon.ico"),
]

const faviconTargets = [
  path.join(repoRoot, "favicon.ico"),
  path.join(repoRoot, "public", "favicon.ico"),
]

async function ensureParent(pathname) {
  await fs.mkdir(path.dirname(pathname), { recursive: true })
}

async function renderPng(inputBuffer, size, outputPath) {
  await ensureParent(outputPath)
  await sharp(inputBuffer, { density: svgDensity })
    .resize(size, size)
    .png()
    .toFile(outputPath)
}

async function copyToTargets(sourcePath, targets) {
  await Promise.all(
    targets.map(async (targetPath) => {
      await ensureParent(targetPath)
      await fs.copyFile(sourcePath, targetPath)
    })
  )
}

async function main() {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "recipe-room-icons-")
  )

  try {
    const sourceSvgBuffer = await fs.readFile(sourceSvgPath)
    const rasterSizes = [16, 32, 48, 64, 128, 180, 256, 512, 1024]
    const rasterPaths = new Map()

    for (const size of rasterSizes) {
      const outputPath = path.join(tempDir, `${size}.png`)
      await renderPng(sourceSvgBuffer, size, outputPath)
      rasterPaths.set(size, outputPath)
    }

    await copyToTargets(sourceSvgPath, svgTargets)
    await copyToTargets(rasterPaths.get(512), appIconTargets)
    await copyToTargets(rasterPaths.get(180), appleIconTargets)

    const icoBuffer = await pngToIco([
      rasterPaths.get(16),
      rasterPaths.get(32),
      rasterPaths.get(48),
      rasterPaths.get(64),
      rasterPaths.get(128),
      rasterPaths.get(256),
    ])
    const faviconPath = path.join(tempDir, "favicon.ico")
    await fs.writeFile(faviconPath, icoBuffer)
    await copyToTargets(faviconPath, faviconTargets)
    await copyToTargets(faviconPath, appIconIcoTargets)

    const iconsetDir = path.join(tempDir, "app-icon.iconset")
    await fs.mkdir(iconsetDir, { recursive: true })

    const iconsetMappings = [
      ["icon_16x16.png", 16],
      ["icon_16x16@2x.png", 32],
      ["icon_32x32.png", 32],
      ["icon_32x32@2x.png", 64],
      ["icon_128x128.png", 128],
      ["icon_128x128@2x.png", 256],
      ["icon_256x256.png", 256],
      ["icon_256x256@2x.png", 512],
      ["icon_512x512.png", 512],
      ["icon_512x512@2x.png", 1024],
    ]

    await Promise.all(
      iconsetMappings.map(async ([filename, size]) => {
        await fs.copyFile(
          rasterPaths.get(size),
          path.join(iconsetDir, filename)
        )
      })
    )

    const icnsPath = path.join(repoRoot, "electron", "app-icon.icns")
    await ensureParent(icnsPath)
    await execFile("iconutil", [
      "-c",
      "icns",
      iconsetDir,
      "-o",
      icnsPath,
    ])

    console.log("Generated app icons")
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true })
  }
}

await main()
