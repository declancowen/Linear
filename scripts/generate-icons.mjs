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

const webFaviconSvgMarkup = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256" fill="none">',
  "  <style>",
  "    .bg { fill: #111111; }",
  "    .mark { fill: #ffffff; }",
  "    @media (prefers-color-scheme: dark) { .bg { fill: #f5f5f5; } .mark { fill: #111111; } }",
  "  </style>",
  '  <rect class="bg" x="24" y="24" width="208" height="208" rx="48" />',
  '  <path class="mark" d="M224,104v96a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V104A16,16,0,0,1,48,88H208A16,16,0,0,1,224,104ZM56,72H200a8,8,0,0,0,0-16H56a8,8,0,0,0,0,16ZM72,40H184a8,8,0,0,0,0-16H72a8,8,0,0,0,0,16Z" transform="translate(0 8)" />',
  "</svg>",
  "",
].join("\n")

const appIconSvgTargets = [
  path.join(repoRoot, "app-icon.svg"),
  path.join(repoRoot, "icon.svg"),
  path.join(repoRoot, "public", "app-icon.svg"),
]

const webFaviconSvgTargets = [
  path.join(repoRoot, "favicon.svg"),
  path.join(repoRoot, "public", "favicon.svg"),
  path.join(repoRoot, "public", "icon.svg"),
  path.join(repoRoot, "public", "app-logo.svg"),
]

const appIconTargets = [
  path.join(repoRoot, "app-icon.png"),
  path.join(repoRoot, "public", "app-icon.png"),
  path.join(repoRoot, "electron", "app-icon.png"),
]

const appleTouchIconTargets = [
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

async function writeSvgTargets(targets, markup) {
  await Promise.all(
    targets.map(async (targetPath) => {
      await ensureParent(targetPath)
      await fs.writeFile(targetPath, markup)
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
    const webFaviconPngBuffer = await sharp(Buffer.from(webFaviconSvgMarkup))
      .resize(1024, 1024)
      .png()
      .toBuffer()
    const rasterSizes = [16, 32, 48, 64, 128, 180, 256, 512]
    const rasterPaths = new Map()
    const webFaviconRasterPaths = new Map()

    await fs.writeFile(sourcePngPath, sourcePngBuffer)

    for (const size of rasterSizes) {
      const outputPath = path.join(tempDir, `${size}.png`)
      const webFaviconOutputPath = path.join(tempDir, `favicon-${size}.png`)
      await renderPng(sourcePngBuffer, size, outputPath)
      await renderPng(webFaviconPngBuffer, size, webFaviconOutputPath)
      rasterPaths.set(size, outputPath)
      webFaviconRasterPaths.set(size, webFaviconOutputPath)
    }

    await writeSvgTargets(appIconSvgTargets, appIconSvgMarkup)
    await writeSvgTargets(webFaviconSvgTargets, webFaviconSvgMarkup)
    await copyToTargets(sourcePngPath, appIconTargets)
    await copyToTargets(webFaviconRasterPaths.get(180), appleTouchIconTargets)
    await writeElectronIcns(sourcePngBuffer, tempDir)

    const appIconIcoBuffer = await pngToIco([
      rasterPaths.get(16),
      rasterPaths.get(32),
      rasterPaths.get(48),
      rasterPaths.get(64),
      rasterPaths.get(128),
      rasterPaths.get(256),
    ])
    const faviconIcoBuffer = await pngToIco([
      webFaviconRasterPaths.get(16),
      webFaviconRasterPaths.get(32),
      webFaviconRasterPaths.get(48),
      webFaviconRasterPaths.get(64),
      webFaviconRasterPaths.get(128),
      webFaviconRasterPaths.get(256),
    ])
    const faviconPath = path.join(tempDir, "favicon.ico")
    const appIconIcoPath = path.join(tempDir, "app-icon.ico")
    await fs.writeFile(faviconPath, faviconIcoBuffer)
    await fs.writeFile(appIconIcoPath, appIconIcoBuffer)
    await copyToTargets(faviconPath, faviconTargets)
    await copyToTargets(appIconIcoPath, appIconIcoTargets)

    console.log("Generated app icons")
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true })
  }
}

await main()
