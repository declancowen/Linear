import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import pngToIco from "png-to-ico"
import sharp from "sharp"

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const sourcePngPath = path.join(repoRoot, "app-icon.png")
const electronIcnsPath = path.join(repoRoot, "electron", "app-icon.icns")

const appIconSvgMarkup = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256" fill="none">',
  "  <style>",
  "    .mark { fill: #737373; }",
  "    @media (prefers-color-scheme: dark) { .mark { fill: #d4d4d4; } }",
  "  </style>",
  '  <path class="mark" d="M221.87,83.16A104.1,104.1,0,1,1,195.67,49l22.67-22.68a8,8,0,0,1,11.32,11.32l-96,96a8,8,0,0,1-11.32-11.32l27.72-27.72a40,40,0,1,0,17.87,31.09,8,8,0,1,1,16-.9,56,56,0,1,1-22.38-41.65L184.3,60.39a87.88,87.88,0,1,0,23.13,29.67,8,8,0,0,1,14.44-6.9Z" />',
  "</svg>",
  "",
].join("\n")

const svgTargets = [
  path.join(repoRoot, "app-icon.svg"),
  path.join(repoRoot, "icon.svg"),
  path.join(repoRoot, "public", "app-icon.svg"),
  path.join(repoRoot, "public", "icon.svg"),
  path.join(repoRoot, "public", "app-logo.svg"),
]

const appIconTargets = [
  path.join(repoRoot, "app-icon.png"),
  path.join(repoRoot, "public", "app-icon.png"),
  path.join(repoRoot, "electron", "app-icon.png"),
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
  await sharp(inputBuffer).resize(size, size).png().toFile(outputPath)
}

async function copyToTargets(sourcePath, targets) {
  await Promise.all(
    targets.map(async (targetPath) => {
      if (path.resolve(sourcePath) === path.resolve(targetPath)) {
        return
      }

      await ensureParent(targetPath)
      await fs.copyFile(sourcePath, targetPath)
    })
  )
}

async function writeSvgTargets(targets) {
  await Promise.all(
    targets.map(async (targetPath) => {
      await ensureParent(targetPath)
      await fs.writeFile(targetPath, appIconSvgMarkup)
    })
  )
}

async function writeElectronIcns(inputBuffer, tempDir) {
  const iconsetPath = path.join(tempDir, "app.iconset")
  const iconsetEntries = [
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

  await fs.mkdir(iconsetPath, { recursive: true })
  await Promise.all(
    iconsetEntries.map(([filename, size]) =>
      renderPng(inputBuffer, size, path.join(iconsetPath, filename))
    )
  )

  await ensureParent(electronIcnsPath)
  try {
    await execFileAsync("iconutil", [
      "-c",
      "icns",
      iconsetPath,
      "-o",
      electronIcnsPath,
    ])
  } catch (error) {
    if (process.platform === "darwin") {
      throw error
    }

    console.warn("Skipped macOS .icns generation because iconutil is missing")
  }
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "recipe-room-icons-"))

  try {
    const sourcePngBuffer = await sharp(Buffer.from(appIconSvgMarkup))
      .resize(1024, 1024)
      .png()
      .toBuffer()
    const rasterSizes = [16, 32, 48, 64, 128, 180, 256, 512]
    const rasterPaths = new Map()

    await fs.writeFile(sourcePngPath, sourcePngBuffer)

    for (const size of rasterSizes) {
      const outputPath = path.join(tempDir, `${size}.png`)
      await renderPng(sourcePngBuffer, size, outputPath)
      rasterPaths.set(size, outputPath)
    }

    await writeSvgTargets(svgTargets)
    await copyToTargets(sourcePngPath, appIconTargets)
    await copyToTargets(rasterPaths.get(180), appleIconTargets)
    await writeElectronIcns(sourcePngBuffer, tempDir)

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

    console.log("Generated app icons")
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true })
  }
}

await main()
