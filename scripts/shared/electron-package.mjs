import fs from "node:fs/promises"
import path from "node:path"

function getMacOutputDirectoryName(arch) {
  return arch ? `mac-${arch}` : null
}

export function getCommandShimSpawnOptions(platform = process.platform) {
  // Windows needs shell mode to resolve .cmd shims such as pnpm.
  return platform === "win32" ? { shell: true } : {}
}

export async function findBuiltApp(searchDir, options = {}) {
  const outputEntries = await fs.readdir(searchDir, { withFileTypes: true })
  const targetDirectoryName = getMacOutputDirectoryName(options.arch)

  for (const entry of outputEntries) {
    if (!entry.isDirectory() || !entry.name.startsWith("mac")) {
      continue
    }

    if (targetDirectoryName && entry.name !== targetDirectoryName) {
      continue
    }

    const appPath = path.join(searchDir, entry.name, "Recipe Room.app")

    try {
      await fs.access(appPath)
      return {
        appPath,
        archivePath: path.join(searchDir, `Recipe Room-${entry.name}.zip`),
      }
    } catch {}
  }

  throw new Error("Packaged app bundle was not created")
}
