import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import pngToIco from "png-to-ico"
import sharp from "sharp"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const sourcePngPath = path.join(
  repoRoot,
  "dist",
  "electron-stage",
  "electron",
  "app-icon.png"
)
const sourceIcnsPath = path.join(
  repoRoot,
  "dist",
  "electron-stage",
  "electron",
  "app-icon.icns"
)

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
      await ensureParent(targetPath)
      await fs.copyFile(sourcePath, targetPath)
    })
  )
}

async function writeSvgTargets(inputBuffer, targets) {
  const embeddedPng = inputBuffer.toString("base64")
  const svgMarkup = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">',
    `  <image width="512" height="512" href="data:image/png;base64,${embeddedPng}" />`,
    "</svg>",
    "",
  ].join("\n")

  await Promise.all(
    targets.map(async (targetPath) => {
      await ensureParent(targetPath)
      await fs.writeFile(targetPath, svgMarkup)
    })
  )
}

async function main() {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "recipe-room-icons-")
  )

  try {
    const sourcePngBuffer = await fs.readFile(sourcePngPath)
    const rasterSizes = [16, 32, 48, 64, 128, 180, 256, 512]
    const rasterPaths = new Map()

    for (const size of rasterSizes) {
      const outputPath = path.join(tempDir, `${size}.png`)
      await renderPng(sourcePngBuffer, size, outputPath)
      rasterPaths.set(size, outputPath)
    }

    await writeSvgTargets(sourcePngBuffer, svgTargets)
    await copyToTargets(sourcePngPath, appIconTargets)
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

    const icnsPath = path.join(repoRoot, "electron", "app-icon.icns")
    await copyToTargets(sourceIcnsPath, [icnsPath])

    console.log("Generated app icons")
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true })
  }
}

await main()
