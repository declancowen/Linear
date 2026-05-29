import fs from "node:fs/promises"
import path from "node:path"

function getMacOutputDirectoryName(arch) {
  return arch ? `mac-${arch}` : null
}

export function getPackageManagerCommand(
  command = "pnpm",
  platform = process.platform
) {
  if (platform === "win32" && !/\.(?:bat|cmd|exe)$/iu.test(command)) {
    return `${command}.cmd`
  }

  return command
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
